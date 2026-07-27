import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Eye, EyeOff, LogIn, Moon, Sun, Globe, ChevronDown } from "lucide-react";
import loginHero from "@/assets/login-hero.png.asset.json";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { CODE_TO_UI, UI_TO_CODE, type SupportedLang } from "@/i18n";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() => getStoredTheme() === "dark");
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const lang = CODE_TO_UI[(i18n.language?.split("-")[0] as SupportedLang) || "az"] ?? "AZ";

  useEffect(() => { applyTheme(dark ? "dark" : "light"); }, [dark]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const chooseLang = (l: "AZ" | "ENG" | "RU") => {
    i18n.changeLanguage(UI_TO_CODE[l]);
    try { localStorage.setItem("kpi_lang", l); } catch { /* noop */ }
    setLangOpen(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (!email || !password) {
      setError(t("login.both_required"));
      return;
    }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        // Root route handles role-based redirect (super admin, HR, manager, user).
        navigate("/");
      } else {
        setError(result.error || t("login.failed"));
      }
    } catch (err: any) {
      setError(err?.message || t("login.error"));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Left – form */}
      <div className="relative flex items-center justify-center p-6 lg:p-10">
        {/* subtle grid bg */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />


        {/* Compact control panel — theme + language */}
        <div ref={langRef} className="absolute bottom-5 left-5 z-10 flex items-center gap-1.5 rounded-xl border border-border bg-card/80 backdrop-blur px-1.5 py-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setDark(!dark)}
            aria-label={dark ? t("common.light_mode") : t("common.dark_mode")}
            title={dark ? t("common.light_mode") : t("common.dark_mode")}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            {dark ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </button>
          <span className="w-px h-5 bg-border" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(o => !o)}
              className="h-8 px-2 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label={t("common.language")}
            >
              <Globe className="w-4 h-4" /> {lang}
              <ChevronDown className="w-3 h-3" />
            </button>
            {langOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-28 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                {(["AZ", "ENG", "RU"] as const).map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => chooseLang(l)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-secondary ${
                      lang === l ? "text-primary font-semibold" : "text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
              <LogIn className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("login.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("login.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">
                {t("login.email")} <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t("login.email_ph")}
                className="w-full mt-1 px-4 py-3 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition"
                autoComplete="email"
              />
              {touched && !email && (
                <p className="text-xs text-destructive font-medium mt-1.5">{t("login.email_required")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                {t("login.password")} <span className="text-destructive">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t("login.password_ph")}
                  className="w-full pr-10 px-4 py-3 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {touched && !password && (
                <p className="text-xs text-destructive font-medium mt-1.5">{t("login.password_required")}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                {t("login.forgot")}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>
        </div>
      </div>

      {/* Right – KPI ecosystem illustration */}
      <div className="hidden lg:flex relative items-center justify-center overflow-hidden bg-background">
        <img
          src={loginHero.url}
          alt="KPI ekosistemi — Hədəflər, Qiymətləndirmə, Performans, Bonus, Kaskadlama, Komandalar, Hesabatlar"
          className="w-full h-full object-cover"
          style={{ mixBlendMode: "multiply" }}
        />
      </div>
    </div>
  );
};

export default LoginPage;
