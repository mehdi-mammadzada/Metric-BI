import { useEffect, useMemo, useState } from "react";
import { Search, X, ChevronRight, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getEmployees, getStructures, type OrgStructure } from "@/lib/orgStore";
import { getAllPositions } from "@/lib/usePositions";
import { getTeams } from "@/lib/teamsStore";
import { useRoles } from "@/lib/rolesStore";
import { fetchRolesForOrg } from "@/lib/rolesService";
import { useAuth } from "@/contexts/AuthContext";
import { LEGACY_RECIPIENT_LABELS } from "@/lib/notificationSettingsStore";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

type TabId = "person" | "position" | "structure" | "team" | "role";

const TAB_LABELS: Record<TabId, string> = {
  person: "Şəxs",
  position: "Vəzifə",
  structure: "Struktur",
  team: "Komanda",
  role: "Sistem rolu",
};

const CheckRow = ({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) => (
  <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60 cursor-pointer rounded-md">
    <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 accent-primary shrink-0" />
    <span className="truncate">{label}</span>
  </label>
);

const SimpleList = ({
  items, tokenPrefix, value, onChange, emptyText = "Nəticə tapılmadı",
}: {
  items: { key: string; label: string }[];
  tokenPrefix: string;
  value: string[];
  onChange: (v: string[]) => void;
  emptyText?: string;
}) => {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => items.filter(i => i.label.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );
  const toggle = (token: string) => {
    onChange(value.includes(token) ? value.filter(v => v !== token) : [...value, token]);
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Axtar..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
        />
      </div>
      <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border/60 bg-background">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">{emptyText}</p>
        ) : filtered.map(i => (
          <CheckRow
            key={i.key}
            label={i.label}
            checked={value.includes(`${tokenPrefix}:${i.key}`)}
            onToggle={() => toggle(`${tokenPrefix}:${i.key}`)}
          />
        ))}
      </div>
    </div>
  );
};

// ── Struktur tree ───────────────────────────────────────────────
const collectDescendantIds = (node: OrgStructure, acc: string[] = []): string[] => {
  acc.push(String(node.id));
  node.children.forEach(c => collectDescendantIds(c, acc));
  return acc;
};

const StructureTree = ({ nodes, value, onChange }: {
  nodes: OrgStructure[]; value: string[]; onChange: (v: string[]) => void;
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set(nodes.map(n => n.id)));
  const toggleExpand = (id: number) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const isChecked = (id: number) => value.includes(`structure:${id}`);
  const toggleNode = (node: OrgStructure) => {
    const ids = collectDescendantIds(node);
    const tokens = ids.map(i => `structure:${i}`);
    const anyOn = tokens.some(t => value.includes(t));
    if (anyOn) onChange(value.filter(v => !tokens.includes(v)));
    else onChange(Array.from(new Set([...value, ...tokens])));
  };

  const render = (list: OrgStructure[], depth = 0) => list.map(n => {
    const hasChildren = n.children.length > 0;
    const open = expanded.has(n.id);
    return (
      <div key={n.id}>
        <div className="flex items-center gap-1 pr-2 hover:bg-secondary/60 rounded-md" style={{ paddingLeft: 8 + depth * 16 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(n.id)} className="p-0.5 text-muted-foreground">
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : <span className="w-4" />}
          <label className="flex items-center gap-2 py-1.5 flex-1 cursor-pointer">
            <input type="checkbox" checked={isChecked(n.id)} onChange={() => toggleNode(n)} className="w-4 h-4 accent-primary" />
            <span className="text-sm truncate">{n.name}</span>
            <span className="text-[10px] text-muted-foreground">({n.type})</span>
          </label>
        </div>
        {hasChildren && open && render(n.children, depth + 1)}
      </div>
    );
  });

  return <div className="max-h-64 overflow-y-auto border border-border rounded-lg bg-background py-1">{render(nodes)}</div>;
};

// ── Chip labels ─────────────────────────────────────────────────
export const labelForRecipientToken = (token: string, structIdx?: Map<number, string>): string => {
  if (token.startsWith("person:")) return token.slice(7);
  if (token.startsWith("position:")) return `Vəzifə: ${token.slice(9)}`;
  if (token.startsWith("team:")) return `Komanda #${token.slice(5)}`;
  if (token.startsWith("role:")) return token.slice(5);
  if (token.startsWith("structure:")) {
    const id = Number(token.slice(10));
    const name = structIdx?.get(id);
    return name ? `Struktur: ${name}` : `Struktur #${id}`;
  }
  return LEGACY_RECIPIENT_LABELS[token] ?? token;
};

const NotificationRecipientsPicker = ({ value, onChange }: Props) => {
  const [tab, setTab] = useState<TabId>("person");

  const employees = useMemo(
    () => getEmployees().map(e => ({ key: `${e.firstName} ${e.lastName}`.trim(), label: `${e.firstName} ${e.lastName}` })),
    [],
  );
  const positions = useMemo(() => getAllPositions().map(p => ({ key: p, label: p })), []);
  const structures = useMemo(() => getStructures(), []);
  const teams = useMemo(() => getTeams().map(t => ({ key: String(t.id), label: t.name })), []);
  const rolesList = useRoles();
  const { user } = useAuth();
  const orgId = user?.currentOrgId ?? "";
  const [dbRoleNames, setDbRoleNames] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId) { setDbRoleNames([]); return; }
    let cancelled = false;
    fetchRolesForOrg(orgId)
      .then(rows => {
        if (!cancelled) setDbRoleNames(rows.filter(r => r.is_active).map(r => r.name));
      })
      .catch(() => { if (!cancelled) setDbRoleNames([]); });
    return () => { cancelled = true; };
  }, [orgId]);

  const roleItems = useMemo(() => {
    const names = Array.from(new Set([...dbRoleNames, ...rolesList.map(r => r.name)].filter(Boolean)));
    names.sort((a, b) => a.localeCompare(b, "az"));
    return names.map(n => ({ key: n, label: n }));
  }, [dbRoleNames, rolesList]);

  // struct id → name (chip display)
  const structIdx = useMemo(() => {
    const m = new Map<number, string>();
    const walk = (list: OrgStructure[]) => list.forEach(n => { m.set(n.id, n.name); walk(n.children); });
    walk(structures);
    return m;
  }, [structures]);

  const chips = value.map(t => ({ token: t, label: labelForRecipientToken(t, structIdx) }));

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={v => setTab(v as TabId)}>
        <TabsList className="grid grid-cols-5 w-full">
          {(Object.keys(TAB_LABELS) as TabId[]).map(k => (
            <TabsTrigger key={k} value={k} className="text-xs">{TAB_LABELS[k]}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="person" className="mt-3">
          <SimpleList items={employees} tokenPrefix="person" value={value} onChange={onChange} />
        </TabsContent>
        <TabsContent value="position" className="mt-3">
          <SimpleList items={positions} tokenPrefix="position" value={value} onChange={onChange} />
        </TabsContent>
        <TabsContent value="structure" className="mt-3">
          <StructureTree nodes={structures} value={value} onChange={onChange} />
        </TabsContent>
        <TabsContent value="team" className="mt-3">
          <SimpleList items={teams} tokenPrefix="team" value={value} onChange={onChange} />
        </TabsContent>
        <TabsContent value="role" className="mt-3">
          <SimpleList items={roleItems} tokenPrefix="role" value={value} onChange={onChange} />
        </TabsContent>
      </Tabs>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Seçilmiş alıcılar ({chips.length})</span>
          {chips.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-primary hover:underline"
            >
              Hamısını təmizlə
            </button>
          )}
        </div>
        {chips.length === 0 ? (
          <p className="text-xs text-muted-foreground">Hələ alıcı seçilməyib.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(c => (
              <span key={c.token} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]">
                {c.label}
                <button type="button" onClick={() => onChange(value.filter(v => v !== c.token))} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationRecipientsPicker;
