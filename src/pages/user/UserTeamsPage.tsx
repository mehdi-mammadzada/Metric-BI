import { useState } from "react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Trophy, TrendingUp, Users, Sparkles, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHero, FancyStatCard, FancyCard } from "@/components/ui/page-hero";

interface TeamMember { name: string; role: string; kpiScore: number; avatar: string; }
interface Team {
  id: number; name: string; leader: string; leaderAvatar: string; kpiResult: number;
  department: string; activeKpi: number; completedKpi: number; totalKpi: number; members: TeamMember[];
}

// Demo — user tables normally would come from teamsStore scoped to current user.
const allTeams: Team[] = [];

const UserTeamsPage = () => {
  const { user } = useAuth();
  const [openDetail, setOpenDetail] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Yalnız istifadəçinin aid olduğu komanda(lar).
  const myTeams = allTeams.filter(t => t.leader === user?.name || t.members.some(m => m.name === user?.name));
  const primary = myTeams[0] || allTeams[0]; // fallback for demo

  const filteredMembers = primary?.members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.role.toLowerCase().includes(memberSearch.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen">
      <Header title="Mənim Komandam" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Komandam"
          icon={Sparkles}
          title="Mənim Komandam"
          subtitle={primary ? `${primary.name} — ${primary.members.length + 1} üzv` : "Komanda tapılmadı"}
        />

        {primary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-4">
              <FancyStatCard icon={Trophy} label="Komanda KPI Nəticəsi" value={`${primary.kpiResult}%`} sub={primary.name} accent="amber" />
              <FancyStatCard icon={TrendingUp} label="Tamamlanmış KPI" value={`${primary.completedKpi}/${primary.totalKpi}`} sub={`${primary.activeKpi} aktiv`} accent="primary" />
              <FancyStatCard icon={Users} label="Komanda Üzvləri" value={primary.members.length + 1} sub={`Lider: ${primary.leader}`} accent="emerald" />
            </div>

            <FancyCard title="Komanda İcmalı" subtitle="Rəhbər və üzvlərin performansı" className="mb-6">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Üzv axtar..." className="w-full max-w-md pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card" />
              </div>
              <div className="space-y-2">
                {(primary.leader.toLowerCase().includes(memberSearch.toLowerCase())) && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">{primary.leaderAvatar}</div>
                        <Crown className="w-3.5 h-3.5 text-amber-500 absolute -top-1 -right-1" fill="currentColor" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{primary.leader}</p>
                        <p className="text-xs text-muted-foreground">Komanda Lideri</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${primary.kpiResult >= 85 ? 'bg-zone-green-bg text-zone-green-text' : 'bg-zone-yellow-bg text-zone-yellow-text'}`}>{primary.kpiResult}%</span>
                  </div>
                )}
                {filteredMembers.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">{m.avatar}</div>
                      <div><p className="text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${m.kpiScore >= 85 ? 'bg-zone-green-bg text-zone-green-text' : 'bg-zone-yellow-bg text-zone-yellow-text'}`}>{m.kpiScore}%</span>
                  </div>
                ))}
              </div>
            </FancyCard>
          </>
        )}
      </main>
    </div>
  );
};

export default UserTeamsPage;
