import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import UserLayout from "@/components/layout/UserLayout";
import RouteGuard from "@/components/layout/RouteGuard";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import InvitationsPage from "./pages/InvitationsPage";
import AuditLogPage from "./pages/AuditLogPage";
import HomePage from "./pages/HomePage";
import KpiCardsPage from "./pages/KpiCardsPage";
import KpiHubPage from "./pages/KpiHubPage";
import KpiScoresPage from "./pages/KpiScoresPage";
import ManagerResponsibleCardsPage from "./pages/manager/ManagerResponsibleCardsPage";
import ManagerResultsPage from "./pages/manager/ManagerResultsPage";
import ManagerBonusPage from "./pages/manager/ManagerBonusPage";
import ManagerKpiTrackingPage from "./pages/manager/ManagerKpiTrackingPage";
import KpiLifecyclePage from "./pages/KpiLifecyclePage";
import CascadeMatrixPage from "./pages/CascadeMatrixPage";
import CascadingPage from "./pages/CascadingPage";
import CascadingHubPage from "./pages/CascadingHubPage";
import GoalTrackingPage from "./pages/GoalTrackingPage";

import ReportsPage from "./pages/ReportsPage";
import TeamsPage from "./pages/TeamsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SettingsPage from "./pages/SettingsPage";
import FormulasHubPage from "./pages/FormulasHubPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import MatrixPage from "./pages/MatrixPage";
import OrganizationPage from "./pages/OrganizationPage";
import SalaryPage from "./pages/SalaryPage";
import BonusPage from "./pages/BonusPage";
import EvaluationPage from "./pages/EvaluationPage";
import WhistleblowerPage from "./pages/WhistleblowerPage";
import UserWhistleblowerPage from "./pages/user/UserWhistleblowerPage";
import UserHomePage from "./pages/user/UserHomePage";
import UserKpiCardsPage from "./pages/user/UserKpiCardsPage";
import UserApprovalsPage from "./pages/user/UserApprovalsPage";
import UserReportsPage from "./pages/user/UserReportsPage";
import UserTeamsPage from "./pages/user/UserTeamsPage";
import UserSettingsPage from "./pages/user/UserSettingsPage";
import UserEvaluationPage from "./pages/user/UserEvaluationPage";
import SuperAdminLayout from "./components/layout/SuperAdminLayout";
import SuperAdminCompaniesPage from "./pages/SuperAdminCompaniesPage";
import ManagerLayout from "./components/layout/ManagerLayout";
import ManagerHomePage from "./pages/manager/ManagerHomePage";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { bootstrapDemoReviews } from "@/lib/peerReviewStore";
import { MOCK_HR_USER_ID, MOCK_USER_ID } from "@/data/mockData";
import { runDevResetOnce } from "@/lib/devReset";
import { getDefaultPath } from "@/lib/navigation";

// Bir dəfəlik brauzer təmizliyi — bütün istifadəçi tərəfindən yaradılan
// localStorage məlumatlarını silir; default seed-lər yenidən yüklənəcək.
runDevResetOnce();

const queryClient = new QueryClient();

// Yüklənmə zamanı ağ ekran yerinə görünən indikator.
const AuthLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Yüklənir…</p>
    </div>
  </div>
);

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  const path = getDefaultPath(user);
  return <Navigate to={path ?? "/user"} replace />;
};

const LoginGuard = () => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (user) {
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
    const path = getDefaultPath(user);
    return <Navigate to={path ?? "/user"} replace />;
  }
  return <LoginPage />;
};

// Force users with a temporary password to visit /change-password first.
const RequirePasswordChanged = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
};


const ChangePasswordGuard = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) {
    const path = getDefaultPath(user);
    return path ? <Navigate to={path} replace /> : null;
  }
  return <ChangePasswordPage />;
};

const App = () => {
  useEffect(() => {
    bootstrapDemoReviews([MOCK_HR_USER_ID, MOCK_USER_ID]);
  }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/change-password" element={<ChangePasswordGuard />} />
            <Route path="/access-denied" element={<RootRedirect />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />

            {/* HR Panel — Super Admin bura giriş edə bilməz */}
            <Route element={<RouteGuard blockRoles={["SUPER_ADMIN"]}><RequirePasswordChanged><AppLayout /></RequirePasswordChanged></RouteGuard>}>
              <Route path="/hr" element={<RouteGuard requiredPermissions={["home"]}><HomePage /></RouteGuard>} />
              <Route path="/kpi-kartlari" element={<RouteGuard requiredPermissions={["kpi"]}><KpiHubPage /></RouteGuard>} />
              <Route path="/kpi-qiymetleri" element={<RouteGuard requiredPermissions={["kpi_scores"]}><KpiScoresPage /></RouteGuard>} />
              
              <Route path="/hedef-tayin-izleme" element={<RouteGuard requiredPermissions={["goal_tracking"]}><GoalTrackingPage /></RouteGuard>} />
              <Route path="/kpi-lifecycle" element={<RouteGuard requiredPermissions={["kpi_lifecycle"]}><KpiLifecyclePage /></RouteGuard>} />
              <Route path="/cascading" element={<RouteGuard requiredPermissions={["cascading"]}><CascadingHubPage /></RouteGuard>} />
              <Route path="/cascade-matrisi" element={<RouteGuard requiredPermissions={["cascading", "matrix"]}><CascadeMatrixPage /></RouteGuard>} />

              <Route path="/sistem-tesdiq" element={<RouteGuard requiredPermissions={["approvals"]}><UserApprovalsPage /></RouteGuard>} />
              <Route path="/tesdiqleme-matrisi" element={<RouteGuard requiredPermissions={["matrix"]}><MatrixPage /></RouteGuard>} />
              <Route path="/hesabat" element={<RouteGuard requiredPermissions={["reporting"]}><ReportsPage /></RouteGuard>} />
              <Route path="/komandalar" element={<RouteGuard requiredPermissions={["teams"]}><TeamsPage /></RouteGuard>} />
              <Route path="/hesablama-dusturlari" element={<RouteGuard requiredPermissions={["formulas"]}><FormulasHubPage /></RouteGuard>} />
              <Route path="/inteqrasiyalar" element={<RouteGuard requiredPermissions={["integrations"]}><IntegrationsPage /></RouteGuard>} />
              <Route path="/teskilati-struktur" element={<RouteGuard requiredPermissions={["organization"]}><OrganizationPage /></RouteGuard>} />
              <Route path="/emekhaqqi-bazasi" element={<RouteGuard requiredPermissions={["salary"]}><SalaryPage /></RouteGuard>} />
              <Route path="/bonus" element={<RouteGuard requiredPermissions={["bonus"]}><BonusPage /></RouteGuard>} />
              <Route path="/qiymetlendirme" element={<RouteGuard requiredPermissions={["evaluation"]}><EvaluationPage /></RouteGuard>} />
              <Route path="/whistleblower" element={<RouteGuard requiredPermissions={["whistleblower"]}><WhistleblowerPage /></RouteGuard>} />
              <Route path="/ayarlar" element={<RouteGuard requiredPermissions={["settings"]}><SettingsPage /></RouteGuard>} />
              <Route path="/dahvetler" element={<RouteGuard requiredPermissions={["admin_users"]}><InvitationsPage /></RouteGuard>} />
              <Route path="/audit-jurnali" element={<RouteGuard requiredPermissions={["audit"]}><AuditLogPage /></RouteGuard>} />

              {/* HR daxilindəki Rəhbər sub-modulları */}
              <Route path="/hr/rehber" element={<RouteGuard requiredPermissions={["teams", "approvals", "kpi", "goal_tracking", "kpi_scores", "bonus"]}><ManagerHomePage /></RouteGuard>} />
              <Route path="/hr/rehber/sistem-tesdiq" element={<RouteGuard requiredPermissions={["approvals"]}><UserApprovalsPage /></RouteGuard>} />
              <Route path="/hr/rehber/mesul-kartlar" element={<RouteGuard requiredPermissions={["kpi"]}><ManagerResponsibleCardsPage /></RouteGuard>} />
              <Route path="/hr/rehber/komandam" element={<RouteGuard requiredPermissions={["teams"]}><TeamsPage /></RouteGuard>} />
              <Route path="/hr/rehber/kpi-izleme" element={<RouteGuard requiredPermissions={["goal_tracking"]}><ManagerKpiTrackingPage /></RouteGuard>} />
              <Route path="/hr/rehber/neticelerim" element={<RouteGuard requiredPermissions={["kpi_scores"]}><ManagerResultsPage /></RouteGuard>} />
              <Route path="/hr/rehber/bonuslarim" element={<RouteGuard requiredPermissions={["bonus"]}><ManagerBonusPage /></RouteGuard>} />
            </Route>

            {/* Super Admin Panel — yalnız HR (Admin) idarəetməsi */}
            <Route element={<RouteGuard requiredRole="SUPER_ADMIN"><RequirePasswordChanged><SuperAdminLayout /></RequirePasswordChanged></RouteGuard>}>
              <Route path="/super-admin" element={<SuperAdminCompaniesPage />} />
            </Route>

            {/* User Panel — Super Admin bura giriş edə bilməz */}
            <Route element={<RouteGuard blockRoles={["SUPER_ADMIN"]}><RequirePasswordChanged><UserLayout /></RequirePasswordChanged></RouteGuard>}>
              <Route path="/user" element={<RouteGuard requiredPermissions={["home"]}><UserHomePage /></RouteGuard>} />
              <Route path="/user/kpi-kartlari" element={<RouteGuard requiredPermissions={["kpi"]}><UserKpiCardsPage /></RouteGuard>} />
              <Route path="/user/sistem-tesdiq" element={<RouteGuard requiredPermissions={["approvals"]}><UserApprovalsPage /></RouteGuard>} />
              <Route path="/user/hesabat" element={<RouteGuard requiredPermissions={["reporting"]}><UserReportsPage /></RouteGuard>} />
              <Route path="/user/komandalar" element={<RouteGuard requiredPermissions={["teams", "teams_compare"]}><UserTeamsPage /></RouteGuard>} />
              <Route path="/user/qiymetlendirme" element={<RouteGuard requiredPermissions={["evaluation"]}><UserEvaluationPage /></RouteGuard>} />
              <Route path="/user/whistleblower" element={<RouteGuard requiredPermissions={["whistleblower"]}><UserWhistleblowerPage /></RouteGuard>} />
              <Route path="/user/ayarlar" element={<RouteGuard requiredPermissions={["settings"]}><UserSettingsPage /></RouteGuard>} />
            </Route>

            {/* Manager (Rəhbər) Panel */}
            <Route element={<RouteGuard blockRoles={["SUPER_ADMIN"]}><RequirePasswordChanged><ManagerLayout /></RequirePasswordChanged></RouteGuard>}>
              <Route path="/manager" element={<RouteGuard requiredPermissions={["teams", "approvals", "kpi", "goal_tracking", "kpi_scores", "bonus", "reporting"]}><ManagerHomePage /></RouteGuard>} />
              <Route path="/manager/sistem-tesdiq" element={<RouteGuard requiredPermissions={["approvals"]}><UserApprovalsPage /></RouteGuard>} />
              <Route path="/manager/mesul-kartlar" element={<RouteGuard requiredPermissions={["kpi"]}><ManagerResponsibleCardsPage /></RouteGuard>} />
              <Route path="/manager/komandam" element={<RouteGuard requiredPermissions={["teams"]}><TeamsPage /></RouteGuard>} />
              <Route path="/manager/kpi-izleme" element={<RouteGuard requiredPermissions={["goal_tracking"]}><ManagerKpiTrackingPage /></RouteGuard>} />
              <Route path="/manager/neticelerim" element={<RouteGuard requiredPermissions={["kpi_scores"]}><ManagerResultsPage /></RouteGuard>} />
              <Route path="/manager/bonuslarim" element={<RouteGuard requiredPermissions={["bonus"]}><ManagerBonusPage /></RouteGuard>} />
              <Route path="/manager/hesabat" element={<RouteGuard requiredPermissions={["reporting"]}><ReportsPage /></RouteGuard>} />
              <Route path="/manager/whistleblower" element={<RouteGuard requiredPermissions={["whistleblower"]}><UserWhistleblowerPage /></RouteGuard>} />
              <Route path="/manager/ayarlar" element={<RouteGuard requiredPermissions={["settings"]}><SettingsPage /></RouteGuard>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
