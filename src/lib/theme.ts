// Tək mənbədən idarə olunan Dark/Light rejimi (localStorage-da saxlanılır).
export type ThemeMode = "light" | "dark";

const KEY = "kpi_theme";

export const getStoredTheme = (): ThemeMode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark" || v === "light") return v;
  } catch { /* noop */ }
  return "light";
};

export const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try { localStorage.setItem(KEY, mode); } catch { /* noop */ }
};

export const initTheme = () => applyTheme(getStoredTheme());
