// Cloud-backed notifications with realtime streaming per organization.
import { supabase } from "@/integrations/supabase/client";
import type { NotificationItem, NotificationType } from "./notificationsStore";

let currentOrgId: string | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

const EVT = "kpi-notifications-updated";
const CACHE_KEY = "kpi_notifications_v1";

const emit = () => window.dispatchEvent(new Event(EVT));

const writeCache = (list: NotificationItem[]) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch {}
  emit();
};

const readCache = (): NotificationItem[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

type Row = {
  id: string;
  organization_id: string;
  to_employee_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const toItem = (r: Row): NotificationItem => ({
  id: r.id,
  toEmployeeId: r.to_employee_id,
  type: r.type as NotificationType,
  title: r.title,
  body: r.body ?? undefined,
  link: r.link ?? undefined,
  read: r.read,
  createdAt: r.created_at,
});

export const hydrateNotifications = async (orgId: string) => {
  currentOrgId = orgId;
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) { console.warn("[notifications] hydrate failed", error); return; }
  writeCache((data ?? []).map(toItem));
};

export const activateNotificationsSync = (orgId: string) => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  currentOrgId = orgId;
  void hydrateNotifications(orgId);
  realtimeChannel = supabase
    .channel(`notifications:${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `organization_id=eq.${orgId}` },
      () => { void hydrateNotifications(orgId); }
    )
    .subscribe();
};

export const deactivateNotificationsSync = () => {
  currentOrgId = null;
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  writeCache([]);
};

export const pushNotificationCloud = async (
  input: Omit<NotificationItem, "id" | "read" | "createdAt">
) => {
  if (!currentOrgId) {
    // Fallback: cache-only when unauthenticated.
    const list = readCache();
    list.unshift({ ...input, id: crypto.randomUUID(), read: false, createdAt: new Date().toISOString() });
    writeCache(list);
    return;
  }
  await supabase.from("notifications").insert({
    organization_id: currentOrgId,
    to_employee_id: input.toEmployeeId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
};

export const markReadCloud = async (id: string) => {
  const list = readCache().map(n => n.id === id ? { ...n, read: true } : n);
  writeCache(list);
  if (!currentOrgId) return;
  await supabase.from("notifications").update({ read: true }).eq("id", id);
};

export const markAllReadCloud = async (employeeId: string) => {
  const list = readCache().map(n => n.toEmployeeId === employeeId ? { ...n, read: true } : n);
  writeCache(list);
  if (!currentOrgId) return;
  await supabase.from("notifications")
    .update({ read: true })
    .eq("organization_id", currentOrgId)
    .eq("to_employee_id", employeeId)
    .eq("read", false);
};

export const deleteNotificationCloud = async (id: string) => {
  writeCache(readCache().filter(n => n.id !== id));
  if (!currentOrgId) return;
  await supabase.from("notifications").delete().eq("id", id);
};

export const deleteAllNotificationsCloud = async (employeeId: string) => {
  writeCache(readCache().filter(n => n.toEmployeeId !== employeeId));
  if (!currentOrgId) return;
  await supabase.from("notifications")
    .delete()
    .eq("organization_id", currentOrgId)
    .eq("to_employee_id", employeeId);
};
