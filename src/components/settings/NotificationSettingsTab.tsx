import { useMemo, useRef, useState } from "react";
import { Bell, Mail, Search, Save, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  useNotificationSettings, updateNotificationSetting, addNotificationSetting, deleteNotificationSetting,
  CHANNEL_LABELS,
  type NotificationSetting, type NotificationChannel, type ScheduleConfig,
} from "@/lib/notificationSettingsStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NotificationRecipientsPicker from "./NotificationRecipientsPicker";
import NotificationSchedulePicker from "./NotificationSchedulePicker";
import RichTemplateEditor, { type RichTemplateEditorHandle } from "./RichTemplateEditor";

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

  const editing = !!draft && draft.id === selectedId;
  const startEdit = (s: NotificationSetting) => {
    setSelectedId(s.id);
    setDraft(null);
  };

  const toggleChannel = (c: NotificationChannel) => {
    if (!current) return;
    const next = current.channels.includes(c)
      ? current.channels.filter(x => x !== c)
      : [...current.channels, c];
    setDraft({ ...current, channels: next });
  };

  const editorRef = useRef<RichTemplateEditorHandle>(null);
  const insertVariable = (token: string) => editorRef.current?.insertText(token);

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
              <div className="flex items-center gap-3">
              {!editing && (
                <button type="button" onClick={() => selected && setDraft({ ...selected })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary">
                  <Pencil className="w-4 h-4" /> Redaktə et
                </button>
              )}
              <label className={`flex items-center gap-2 text-sm ${editing ? "cursor-pointer" : "pointer-events-none opacity-70"}`}>
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
            </div>

            <fieldset disabled={!editing} className={`space-y-5 ${editing ? "" : "pointer-events-none opacity-80"}`}>
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
                <RichTemplateEditor
                  key={`${current.id}-${editing}`}
                  ref={editorRef}
                  value={current.template}
                  onChange={(html) => setDraft(d => ({ ...(d && d.id === current.id ? d : current), template: html }))}
                />
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

            </fieldset>

            {editing && (
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
            )}
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
