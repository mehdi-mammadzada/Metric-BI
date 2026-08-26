// Lightweight in-browser notification feed. All panels read from the same source,
// scoped by recipient employee id. Used to surface approval requests, goal updates, etc.

import { useEffect, useState } from "react";

export type NotificationType =
  | "approval_request"
  | "approval_result"
  | "goal_assigned"
  | "execution_update"
  | "whistleblower";

export interface NotificationItem {
  id: string;
  toEmployeeId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const KEY = "kpi_notifications_v1";
const EVT = "kpi-notifications-updated";

const load = (): NotificationItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const save = (list: NotificationItem[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const getNotifications = (): NotificationItem[] => load();

export const pushNotification = (input: Omit<NotificationItem, "id" | "read" | "createdAt">) => {
  // Fire-and-forget cloud write; cache updates via realtime hydrate.
  import("./notificationsService").then(m => { void m.pushNotificationCloud(input); });
  // Optimistic local append so the UI reflects immediately if offline.
  const list = load();
  list.unshift({ ...input, id: crypto.randomUUID(), read: false, createdAt: new Date().toISOString() });
  save(list);
};

export const markRead = (id: string) => {
  const list = load().map(n => n.id === id ? { ...n, read: true } : n);
  save(list);
  import("./notificationsService").then(m => { void m.markReadCloud(id); });
};

export const markAllRead = (employeeId: string) => {
  const list = load().map(n => n.toEmployeeId === employeeId ? { ...n, read: true } : n);
  save(list);
  import("./notificationsService").then(m => { void m.markAllReadCloud(employeeId); });
};

export const deleteNotification = (id: string) => {
  const list = load().filter(n => n.id !== id);
  save(list);
  import("./notificationsService").then(m => { void m.deleteNotificationCloud(id); });
};

export const deleteAllNotifications = (employeeId: string) => {
  const list = load().filter(n => n.toEmployeeId !== employeeId);
  save(list);
  import("./notificationsService").then(m => { void m.deleteAllNotificationsCloud(employeeId); });
};


export const useNotificationsFor = (employeeId: string | null): NotificationItem[] => {
  const [rows, setRows] = useState<NotificationItem[]>(() => load());
  useEffect(() => {
    const h = () => setRows(load());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  if (!employeeId) return [];
  return rows.filter(n => n.toEmployeeId === employeeId);
};
