import { useMemo, useRef, useState } from "react";
import { Bell, Mail, Search, Save, Plus, Trash2, Bold, Italic, Underline, List, ListOrdered, Link2, RemoveFormatting } from "lucide-react";
import { toast } from "sonner";
import {
  useNotificationSettings, updateNotificationSetting, addNotificationSetting, deleteNotificationSetting,
  CHANNEL_LABELS,
  type NotificationSetting, type NotificationChannel, type ScheduleConfig,
} from "@/lib/notificationSettingsStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NotificationRecipientsPicker from "./NotificationRecipientsPicker";
import NotificationSchedulePicker from "./NotificationSchedulePicker";

const channelIcon: Record<NotificationChannel, React.ComponentType<{ className?: string }>> = {
  in_app: Bell,
  email: Mail,
};

const TEMPLATE_VARS: { v: string; label: string }[] = [
  { v: "employee_name", label: "Əməkdaşın adı" },
  { v: "kpi_name", label: "KPI kartının adı" },
  { v: "goal_name", label: "Hədəfin adı" },
  { v: "target", label: "Hədəf dəyəri" },
  { v: "weight", label: "Hədəfin çəkisi (%)" },
  { v: "evaluator_name", label: "Qiymətləndiricinin adı" },
  { v: "period", label: "Dövr" },
  { v: "date", label: "Tarix" },
  { v: "deadline", label: "Bitmə tarixi" },
  { v: "days_left", label: "Qalan gün sayı" },
  { v: "progress", label: "İcra faizi" },
  { v: "score", label: "Bal" },
  { v: "status", label: "Status" },
];

const NotificationSettingsTab = () => {
  const settings = useNotificationSettings();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(settings[0]?.id ?? null);
  const [draft, setDraft] = useState<NotificationSetting | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: "", description: "" });

  const filtered = useMemo(
    () => settings.filter(s => s.title.toLowerCase().includes(search.toLowerCase())),
    [settings, search],
  );

  const selected = settings.find(s => s.id === selectedId) ?? null;
  const current = draft && draft.id === selectedId ? draft : selected;

  const startEdit = (s: NotificationSetting) => {
    setSelectedId(s.id);
    setDraft({ ...s });
  };

  const toggleChannel = (c: NotificationChannel) => {
    if (!current) return;
    const next = current.channels.includes(c)
      ? current.channels.filter(x => x !== c)
      : [...current.channels, c];
    setDraft({ ...current, channels: next });
  };

  const templateRef = useRef<HTMLTextAreaElement>(null);
  const insertVariable = (token: string) => {
    if (!current) return;
    const el = templateRef.current;
    const text = current.template ?? "";
    const start = el ? el.selectionStart ?? text.length : text.length;
    const end = el ? el.selectionEnd ?? text.length : text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setDraft({ ...current, template: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const applyEdit = (next: string, selStart: number, selEnd: number) => {
    if (!current) return;
    setDraft({ ...current, template: next });
    requestAnimationFrame(() => {
      const el = templateRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };
  const getSel = () => {
    const el = templateRef.current;
    const text = current?.template ?? "";
    return { text, s: el?.selectionStart ?? text.length, e: el?.selectionEnd ?? text.length };
  };
  const wrapSel = (pre: string, post: string) => {
    const { text, s, e } = getSel();
    const next = text.slice(0, s) + pre + text.slice(s, e) + post + text.slice(e);
    applyEdit(next, s + pre.length, e + pre.length);
  };
  const prefixLines = (fn: (i: number) => string) => {
    const { text, s, e } = getSel();
    const ls = text.lastIndexOf("\n", s - 1) + 1;
    let le = text.indexOf("\n", e);
    if (le === -1) le = text.length;
    const block = text.slice(ls, le).split("\n").map((l, i) => fn(i) + l).join("\n");
    applyEdit(text.slice(0, ls) + block + text.slice(le), ls, ls + block.length);
  };
  const clearFormat = () => {
    const { text, s, e } = getSel();
    const from = s === e ? 0 : s;
    const to = s === e ? text.length : e;
    const cleaned = text.slice(from, to)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__/g, "")
      .replace(/(^|\s)_(\S[^_]*)_/g, "$1$2")
      .replace(/^(\s*)(- |\d+\. )/gm, "$1");
    applyEdit(text.slice(0, from) + cleaned + text.slice(to), from, from + cleaned.length);
  };

  const save = () => {
    if (!current) return;
    updateNotificationSetting(current.id, {
      ...current,
      frequency: current.schedule.kind,
      sendTime: current.schedule.time || "09:00",
    });
    toast.success("Bildiriş sazlaması yadda saxlanıldı");
    setDraft(null);
  };

  const handleCreate = () => {
    const title = newNotif.title.trim();
    const desc = newNotif.description.trim();
    if (!title) { toast.error("Bildiriş adı daxil edin"); return; }
    const created = addNotificationSetting(title, desc);
    setSelectedId(created.id);
    setDraft(null);
    setNewNotif({ title: "", description: "" });
    setCreateOpen(false);
    toast.success("Yeni bildiriş yaradıldı");
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`"${title}" bildirişini silmək istəyirsiniz?`)) return;
    deleteNotificationSetting(id);
    if (selectedId === id) { setSelectedId(null); setDraft(null); }
    toast.success("Bildiriş silindi");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border space-y-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Yeni bildiriş yarat
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bildiriş axtar..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
          {filtered.map(s => {
            const active = s.id === selectedId;
            const isCustom = s.id.startsWith("custom_");
            return (
              <div key={s.id} className={`relative group ${active ? "bg-primary/10" : "hover:bg-secondary/50"} transition-colors`}>
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="w-full text-left px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-2 pr-6">
                    <span className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>{s.title}</span>
                    <span className={`w-2 h-2 rounded-full ${s.enabled ? "bg-success" : "bg-muted-foreground/40"}`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.title)}
                    className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-opacity"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nəticə tapılmadı</p>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        {!current ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Soldan bildiriş növü seçin.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{current.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{current.description}</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <span className="text-muted-foreground">Aktiv</span>
                <button
                  type="button"
                  onClick={() => setDraft({ ...current, enabled: !current.enabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${current.enabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${current.enabled ? "translate-x-5" : ""}`} />
                </button>
              </label>
            </div>

            {/* Channels */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Göndərmə kanalı</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map(c => {
                  const Icon = channelIcon[c];
                  const on = current.channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChannel(c)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
                    >
                      <Icon className="w-4 h-4" />
                      {CHANNEL_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Cədvəl</label>
              <NotificationSchedulePicker
                value={current.schedule}
                onChange={(schedule: ScheduleConfig) => setDraft({ ...current, schedule })}
              />
            </div>

            {/* Recipients */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Alıcılar</label>
              <NotificationRecipientsPicker
                value={current.recipients}
                onChange={(recipients) => setDraft({ ...current, recipients })}
              />
            </div>

            {/* Template */}
            <div className="rounded-xl border border-border p-4 space-y-4">
              <h4 className="text-base font-semibold text-foreground">Şablon mətni</h4>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Bildiriş başlığı *</label>
                <div className="relative">
                  <input
                    value={current.subject ?? current.title}
                    maxLength={100}
                    onChange={(e) => setDraft({ ...current, subject: e.target.value })}
                    className="w-full pl-3 pr-16 py-2 text-sm border border-border rounded-lg bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
                    {(current.subject ?? current.title).length}/100
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Bildiriş mətni *</label>
                <div className="border border-border rounded-lg bg-background overflow-hidden">
                  <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-secondary/30">
                    {[
                      { icon: Bold, t: "Qalın", a: () => wrapSel("**", "**") },
                      { icon: Italic, t: "Kursiv", a: () => wrapSel("_", "_") },
                      { icon: Underline, t: "Altdan xətt", a: () => wrapSel("__", "__"), sep: true },
                      { icon: List, t: "Siyahı", a: () => prefixLines(() => "- ") },
                      { icon: ListOrdered, t: "Nömrəli siyahı", a: () => prefixLines(i => `${i + 1}. `), sep: true },
                      { icon: Link2, t: "Link", a: () => { const url = prompt("Link ünvanı:", "https://"); if (url) wrapSel("[", `](${url})`); } },
                      { icon: RemoveFormatting, t: "Formatı təmizlə", a: clearFormat },
                    ].map(({ icon: I, t, a, sep }) => (
                      <span key={t} className="flex items-center">
                        <button type="button" title={t} onMouseDown={(e) => e.preventDefault()} onClick={a}
                          className="p-1.5 rounded hover:bg-secondary text-foreground">
                          <I className="w-4 h-4" />
                        </button>
                        {sep && <span className="w-px h-5 bg-border mx-1" />}
                      </span>
                    ))}
                  </div>
                  <textarea
                    ref={templateRef}
                    value={current.template}
                    onChange={(e) => setDraft({ ...current, template: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 text-sm bg-background resize-none outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground mt-2">
                  <span>Dəyişənlər:</span>
                  {TEMPLATE_VARS.map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertVariable(`{${v}}`)}
                      title={label}
                      className="px-1.5 py-0.5 rounded bg-secondary hover:bg-primary/10 hover:text-primary font-mono transition-colors"
                    >
                      {`{${v}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border bg-card hover:bg-secondary"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={save}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="w-4 h-4" /> Yadda saxla
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Yeni bildiriş yarat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Bildiriş adı</label>
              <input
                value={newNotif.title}
                onChange={e => setNewNotif(p => ({ ...p, title: e.target.value }))}
                placeholder="Məsələn: Həftəlik komanda hesabatı"
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Qısa təsvir</label>
              <textarea
                value={newNotif.description}
                onChange={e => setNewNotif(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Bu bildirişin nə vaxt və nə üçün göndərildiyini yazın"
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground bg-secondary/40 rounded-lg p-2.5">
              Yaradıldıqdan sonra sağ paneldə kanalları, cədvəli, alıcıları və şablon mətnini tənzimləyin.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCreate}
                className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium"
              >
                Yadda saxla
              </button>
              <button
                onClick={() => setCreateOpen(false)}
                className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card"
              >
                Ləğv et
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationSettingsTab;
