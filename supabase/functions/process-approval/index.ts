// Deterministic approval queue decision processor.
// Advances a queue row based on the current matrix mode + decisions map.
// Auth: caller must be an active member of the queue row's organization.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  queueLocalId: z.string().min(1),
  organizationId: z.string().uuid(),
  approverId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().max(2000).optional(),
});

type MatrixMode = "sequential" | "parallel" | "any" | undefined;

const nextStatus = (
  mode: MatrixMode,
  approverIds: string[],
  decisions: Record<string, { decision: string; comment?: string; at?: string }>,
  stepsChain: string[] | null,
  currentStep: number | null,
): { status: "pending" | "approved" | "rejected"; currentStep: number | null } => {
  const values = Object.values(decisions).map(d => d.decision);
  if (values.includes("rejected")) return { status: "rejected", currentStep: currentStep ?? null };

  if (mode === "sequential" && stepsChain && stepsChain.length > 0) {
    const step = (currentStep ?? 0);
    const approvedCount = values.filter(v => v === "approved").length;
    if (approvedCount >= stepsChain.length) return { status: "approved", currentStep: step };
    return { status: "pending", currentStep: approvedCount };
  }

  if (mode === "any") {
    if (values.includes("approved")) return { status: "approved", currentStep: currentStep ?? null };
    return { status: "pending", currentStep: currentStep ?? null };
  }

  // parallel / default: everyone must approve
  const approvedCount = values.filter(v => v === "approved").length;
  if (approvedCount >= approverIds.length && approverIds.length > 0) {
    return { status: "approved", currentStep: currentStep ?? null };
  }
  return { status: "pending", currentStep: currentStep ?? null };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { queueLocalId, organizationId, approverId, decision, comment } = parsed.data;

    if (decision === "approved" && (!comment || !comment.trim())) {
      return new Response(JSON.stringify({ error: "Təsdiq şərhi məcburidir" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Membership check
    const { data: membership } = await admin
      .from("organization_members")
      .select("id")
      .eq("user_id", userRes.user.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load queue row
    const { data: row, error: rowErr } = await admin
      .from("approval_queue")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("local_id", queueLocalId)
      .maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Queue row not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.status !== "pending") {
      return new Response(JSON.stringify({ error: `Queue already ${row.status}` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve matrix mode
    let mode: MatrixMode = undefined;
    if (row.matrix_local_id) {
      const { data: matrix } = await admin
        .from("approval_matrices")
        .select("mode")
        .eq("organization_id", organizationId)
        .eq("local_id", row.matrix_local_id)
        .maybeSingle();
      mode = (matrix?.mode as MatrixMode) ?? undefined;
    }

    const decisions = { ...(row.decisions as Record<string, any> ?? {}) };
    decisions[approverId] = { decision, comment: comment ?? "", at: new Date().toISOString() };

    const next = nextStatus(
      mode,
      (row.approver_ids as string[]) ?? [],
      decisions,
      (row.steps_chain as string[] | null) ?? null,
      row.current_step as number | null,
    );

    const { data: updated, error: updErr } = await admin
      .from("approval_queue")
      .update({
        decisions,
        status: next.status,
        current_step: next.currentStep,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort audit
    await admin.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: userRes.user.id,
      action: decision,
      module: "approvals",
      entity_type: "approval_queue",
      entity_id: row.id,
      metadata: { queueLocalId, newStatus: next.status },
    });

    return new Response(JSON.stringify({ ok: true, row: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
