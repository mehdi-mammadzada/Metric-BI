// Bildiriş sazlamaları — hər bildiriş növü üçün kanallar, cədvəl və alıcılar.
import { useEffect, useState } from "react";

export type NotificationChannel = "in_app" | "email";

/** Alıcı tokenləri: "person:<AdSoyad>", "position:<Ad>", "structure:<UnitId>",
 *  "team:<TeamId>", "role:<RoleName>" və ya köhnə sistem açarları ("owner" və s.). */
export type RecipientRole = string;

export type FrequencyKind =
  | "on_event"
  | "on_date"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type MonthlyMode = "dayOfMonth" | "weekOfMonth";
export type WeekOfMonth = "first" | "second" | "third" | "fourth" | "last";
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Bazar ertəsi ... 7=Bazar
export type CustomUnit = "day" | "week" | "month";

export interface ScheduleConfig {
  kind: FrequencyKind;
  time?: string; // HH:MM
  date?: string; // ISO yyyy-mm-dd
  startDate?: string;
  endDate?: string;
  weekdays?: Weekday[];
  monthlyMode?: MonthlyMode;
  dayOfMonth?: number; // 1..31
  weekOfMonth?: WeekOfMonth;
  weekday?: Weekday;
  quarter?: 1 | 2 | 3 | 4;
  month?: number; // 1..12
  day?: number; // 1..31 (for yearly/quarterly)
  repeatEvery?: number;
  customUnit?: CustomUnit;
  cron?: string;
}

export interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  channels: NotificationChannel[];
  /** Geriyə uyğunluq üçün saxlanılır — cədvəl `schedule` sahəsindədir. */
  frequency: FrequencyKind;
  /** Köhnə sahə — cədvəl `schedule.time`-dan oxunur. */
  sendTime: string;
  /** Yeni cədvəl konfiqurasiyası. */
  schedule: ScheduleConfig;
  /** Alıcılar */
  recipients: RecipientRole[];
  /** Bildiriş başlığı */
  subject?: string;
  /** Şablon mətn */
  template: string;
}

const KEY = "kpi_notification_settings_v2";
const LEGACY_KEY = "kpi_notification_settings_v1";
const EVT = "notification-settings-updated";
const RECIPIENT_RESET_KEY = "kpi_notification_recipients_default_cleared_v1";

const mkSchedule = (kind: FrequencyKind, time = "09:00"): ScheduleConfig => ({
  kind, time,
});

const SEED: NotificationSetting[] = [
  {
    id: "kpi_assignment",
    title: "KPI təyin etmə",
    description: "Yeni KPI əməkdaşa təyin edildikdə bildiriş göndərilir.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "on_event",
    sendTime: "09:00",
    schedule: mkSchedule("on_event", "09:00"),
    recipients: [],
    template: "Sizə yeni KPI təyin olundu: {kpi_name}. Hədəf: {target}.",
  },
  {
    id: "kpi_evaluation",
    title: "KPI qiymətləndirmə",
    description: "Qiymətləndirmə dövrü başlayanda xatırlatma.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "on_event",
    sendTime: "10:00",
    schedule: mkSchedule("on_event", "10:00"),
    recipients: [],
    template: "{kpi_name} üçün qiymətləndirmə dövrü {date} tarixində başlayır.",
  },
  {
    id: "kpi_deadline_approaching",
    title: "KPI deadline yaxınlaşır",
    description: "KPI dövrünün bitməsinə az qaldıqda xəbərdarlıq.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "daily",
    sendTime: "09:00",
    schedule: mkSchedule("daily", "09:00"),
    recipients: [],
    template: "{kpi_name} KPI-sının bitməsinə {days_left} gün qalıb. Cari icra: {progress}%.",
  },
  {
    id: "kpi_overdue",
    title: "KPI gecikmiş (overdue)",
    description: "KPI dövrü bitib, lakin nəticə daxil edilməyib.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "daily",
    sendTime: "09:00",
    schedule: mkSchedule("daily", "09:00"),
    recipients: [],
    template: "{kpi_name} KPI-sı {date} tarixində bitib, nəticə hələ daxil edilməyib.",
  },
  {
    id: "bonus_calculation",
    title: "Bonus hesablanması",
    description: "Bonus hesablama dövrünün başlaması haqqında bildiriş.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "on_event",
    sendTime: "10:00",
    schedule: mkSchedule("on_event", "10:00"),
    recipients: [],
    template: "{period} dövrü üçün bonus hesablanması başlayır.",
  },
  {
    id: "kpi_review_reminder",
    title: "KPI Review xatırladıcısı",
    description: "Planlaşdırılmış review tarixində iştirakçılara xatırlatma.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "on_event",
    sendTime: "09:00",
    schedule: mkSchedule("on_event", "09:00"),
    recipients: [],
    template: "{kpi_name} üçün review iclası {date} tarixində keçiriləcək.",
  },
  {
    id: "sub_kpi_assign",
    title: "Hədəf təyin etmə (KPI Set)",
    description: "Rəhbər KPI Set modulundan hədəf təyin etdikdə əməkdaşa bildiriş.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "on_event",
    sendTime: "09:00",
    schedule: mkSchedule("on_event", "09:00"),
    recipients: [],
    template: "Sizə yeni hədəf təyin olundu: {goal_name}.",
  },
  {
    id: "approval_pending",
    title: "Təsdiq gözləyən KPI",
    description: "Təsdiq mərhələsində olan KPI haqqında təsdiqləyiciyə bildiriş.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "daily",
    sendTime: "09:00",
    schedule: mkSchedule("daily", "09:00"),
    recipients: [],
    template: "Təsdiq gözləyən KPI mövcuddur: {kpi_name}.",
  },
  {
    id: "evaluation_result",
    title: "Qiymətləndirmə nəticəsi",
    description: "Əməkdaşa öz qiymətləndirmə nəticəsinin paylaşılması.",
    enabled: true,
    channels: ["in_app", "email"],
    frequency: "on_event",
    sendTime: "10:00",
    schedule: mkSchedule("on_event", "10:00"),
    recipients: [],
    template: "{kpi_name} üzrə qiymətləndirmə nəticəniz hazırdır: {score} bal.",
  },
  {
    id: "monthly_report",
    title: "Aylıq performans hesabatı",
    description: "Hər ayın sonunda ümumi performans icmalı.",
    enabled: false,
    channels: ["email"],
    frequency: "monthly",
    sendTime: "08:00",
    schedule: { kind: "monthly", monthlyMode: "dayOfMonth", dayOfMonth: 1, time: "08:00" },
    recipients: [],
    template: "{period} üzrə aylıq performans hesabatı hazırdır.",
  },
];

const BUILT_IN_SETTING_IDS = new Set(SEED.map(s => s.id));

const migrate = (raw: any): NotificationSetting => {
  const channels: NotificationChannel[] = Array.isArray(raw.channels)
    ? raw.channels.filter((c: string) => c === "in_app" || c === "email")
    : ["in_app"];
  if (channels.length === 0) channels.push("in_app");

  const rawFreq = String(raw.frequency ?? "on_event");
  let freq: FrequencyKind = rawFreq as FrequencyKind;
  if (rawFreq === "once") freq = "on_date";
  if (!["on_event", "on_date", "daily", "weekly", "monthly", "quarterly", "yearly", "custom"].includes(freq)) {
    freq = "on_event";
  }
  const time = raw.sendTime || raw.schedule?.time || "09:00";
  const schedule: ScheduleConfig = raw.schedule && raw.schedule.kind
    ? { ...raw.schedule }
    : mkSchedule(freq, time);
  delete (schedule as any).timezone;

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    enabled: raw.enabled !== false,
    channels,
    frequency: freq,
    sendTime: time,
    schedule,
    recipients: Array.isArray(raw.recipients) ? raw.recipients : [],
    template: String(raw.template ?? "").replace(/\{sub_kpi_name\}/g, "{goal_name}"),
  };
};

const load = (): NotificationSetting[] => {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as any[];
      const migrated = parsed.map(migrate);
      const ids = new Set(migrated.map(p => p.id));
      const missing = SEED.filter(s => !ids.has(s.id));
      let next = missing.length ? [...migrated, ...missing] : migrated;
      if (!localStorage.getItem(RECIPIENT_RESET_KEY)) {
        next = next.map(n => BUILT_IN_SETTING_IDS.has(n.id) ? { ...n, recipients: [] } : n);
        localStorage.setItem(RECIPIENT_RESET_KEY, "1");
      }
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    }
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(SEED));
  localStorage.setItem(RECIPIENT_RESET_KEY, "1");
  return SEED;
};

const persist = (list: NotificationSetting[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const getNotificationSettings = (): NotificationSetting[] => load();

export const updateNotificationSetting = (id: string, patch: Partial<NotificationSetting>) => {
  persist(load().map(n => n.id === id ? { ...n, ...patch } : n));
};

export const addNotificationSetting = (title: string, description: string): NotificationSetting => {
  const id = `custom_${Date.now()}`;
  const created: NotificationSetting = {
    id, title, description,
    enabled: true,
    channels: ["in_app"],
    frequency: "on_event",
    sendTime: "09:00",
    schedule: mkSchedule("on_event", "09:00"),
    recipients: [],
    template: "",
  };
  persist([...load(), created]);
  return created;
};

export const deleteNotificationSetting = (id: string) => {
  persist(load().filter(n => n.id !== id));
};

export const useNotificationSettings = (): NotificationSetting[] => {
  const [list, setList] = useState<NotificationSetting[]>(() => load());
  useEffect(() => {
    const r = () => setList(load());
    window.addEventListener(EVT, r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener(EVT, r);
      window.removeEventListener("storage", r);
    };
  }, []);
  return list;
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "Sistem daxili",
  email: "Email",
};

export const FREQUENCY_LABELS: Record<FrequencyKind, string> = {
  on_event: "Hadisə baş verdikdə",
  on_date: "Müəyyən tarixdə",
  daily: "Gündəlik",
  weekly: "Həftəlik",
  monthly: "Aylıq",
  quarterly: "Rüblük",
  yearly: "İllik",
  custom: "Xüsusi cədvəl",
};

/** Köhnə sistem alıcı açarları — geriyə uyğunluq üçün etiketlər. */
export const LEGACY_RECIPIENT_LABELS: Record<string, string> = {
  owner: "KPI sahibi",
  evaluator: "Qiymətləndirici",
  assigner: "KPI təyin edən",
  manager: "Rəhbər",
  hr: "HR",
  team: "Komanda üzvləri",
};
