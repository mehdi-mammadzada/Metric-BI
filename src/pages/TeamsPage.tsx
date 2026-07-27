import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import { Search, Plus, Trophy, TrendingUp, Users, X, Check, ChevronDown, Sparkles, ArrowLeft, Crown } from "lucide-react";

import { PageHero } from "@/components/ui/page-hero";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTeams, addTeam, type Team, type TeamMember } from "@/lib/teamsStore";
import { toast } from "sonner";
import DropdownMultiSelect from "@/components/kpi/DropdownMultiSelect";
import { getStructures, getEmployees as getLiveEmployees, type OrgStructure } from "@/lib/orgStore";
import { useAuth } from "@/contexts/AuthContext";
import PeriodPicker, { currentPeriod, periodLabel, type PeriodValue , periodCategoriesToDate } from "@/components/common/PeriodPicker";


// Legacy demo people — kept so an empty-tenant demo still has enough names
// to render. Live DB employees are unioned in at render time inside the
// component (see `allPeople` below).
const demoStaticPeople: TeamMember[] = [];

const liveOrgPeople = (_structures: OrgStructure[]): TeamMember[] => {
  const emps = getLiveEmployees();
  return emps.map((e) => {
    const fullName = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || (e.email ?? "—");
    return {
      name: fullName,
      role: e.positionName || "Əməkdaş",
      kpiScore: 0,
      avatar: (e.firstName?.[0] ?? fullName[0] ?? "?").toUpperCase(),
    };
  });
};


const TeamsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isRehberRoute = /\/(rehber|manager)\//.test(location.pathname);
  const isManager = user?.role === "MANAGER" || isRehberRoute;
  const [teams, setTeams] = useState<Team[]>(() => getTeams());

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [searchText, setSearchText] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [orgStructures, setOrgStructures] = useState<OrgStructure[]>(() => getStructures());

  // Create team form state
  const [newTeamName, setNewTeamName] = useState("");
  const [structures, setStructures] = useState<string[]>([]);
  const [subStructures, setSubStructures] = useState<string[]>([]);
  const [structSearch, setStructSearch] = useState("");
  const [subStructSearch, setSubStructSearch] = useState("");
  const [memberListSearch, setMemberListSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [leaderName, setLeaderName] = useState<string>("");

  useEffect(() => {
    const refresh = () => setTeams(getTeams());
    const refreshOrg = () => setOrgStructures(getStructures());
    window.addEventListener("teams-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("org-updated", refreshOrg);
    return () => {
      window.removeEventListener("teams-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("org-updated", refreshOrg);
    };
  }, []);

  // Selectable people for team creation — DB-synced live employees unioned
  // with legacy demo names so an empty tenant still has options. Dedup by
  // display name (case-insensitive).
  const allPeople: TeamMember[] = useMemo(() => {
    const live = liveOrgPeople(orgStructures);
    const seen = new Set(live.map(p => p.name.toLowerCase()));
    const demo = demoStaticPeople.filter(p => !seen.has(p.name.toLowerCase()));
    return [...live, ...demo];
  }, [orgStructures]);

  // Top-level structures from organization module
  const STRUCTURES = orgStructures.map(s => s.name);
  // Sub-structures are children of the selected top-level structures; fallback to all children
  const SUB_STRUCTURES = (() => {
    const source = structures.length
      ? orgStructures.filter(s => structures.includes(s.name))
      : orgStructures;
    const names = source.flatMap(s => s.children.map(c => c.name));
    return Array.from(new Set(names));
  })();

  const scopedTeams = isManager
    ? teams.filter(t => t.leader === user?.name || t.members.some(m => m.name === user?.name))
    : teams;

  const avgPerformance = scopedTeams.length ? (scopedTeams.reduce((s, t) => s + t.kpiResult, 0) / scopedTeams.length).toFixed(1) : "0";
  const totalMembers = scopedTeams.reduce((s, t) => s + t.members.length + 1, 0);
  const bestTeam = scopedTeams.length ? scopedTeams.reduce((b, t) => (t.kpiResult > b.kpiResult ? t : b), scopedTeams[0]) : null;

  const chartData = scopedTeams.map(t => ({
    name: t.name.length > 12 ? t.name.substring(0, 12) + "..." : t.name,
    "KPI Nəticəsi": t.kpiResult,
    "Tamamlanmış": Math.round((t.completedKpi / Math.max(1, t.totalKpi)) * 100),
  }));

  // Chart period filter — İl / Rüb / Ay
  const [chartPeriod, setChartPeriod] = useState<PeriodValue>(() => currentPeriod("year"));

  // Gələcək dövrlər üçün heç bir sütun formalaşdırılmır; keçmiş/cari dövr üçün real dəyərlər.
  const comparisonData = useMemo(() => {
    if (periodCategoriesToDate(chartPeriod).length === 0) return [];
    return chartData;
  }, [chartData, chartPeriod]);



  const filteredTeams = scopedTeams.filter(t =>
    t.name.toLowerCase().includes(searchText.toLowerCase()) ||
    t.leader.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredMembers = selectedTeam?.members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.role.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredCandidates = allPeople.filter(p =>
    p.name.toLowerCase().includes(memberListSearch.toLowerCase()) ||
    p.role.toLowerCase().includes(memberListSearch.toLowerCase())
  );

  const filteredStructures = STRUCTURES.filter(s => s.toLowerCase().includes(structSearch.toLowerCase()));
  const filteredSubStructures = SUB_STRUCTURES.filter(s => s.toLowerCase().includes(subStructSearch.toLowerCase()));

  const toggleMember = (name: string) => {
    setSelectedMembers(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      if (!next.includes(leaderName)) setLeaderName("");
      return next;
    });
  };

  const toggleAllMembers = () => {
    if (selectedMembers.length === filteredCandidates.length) {
      setSelectedMembers([]);
      setLeaderName("");
    } else {
      setSelectedMembers(filteredCandidates.map(p => p.name));
    }
  };

  const toggleStructure = (s: string) =>
    setStructures(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  const toggleSubStructure = (s: string) =>
    setSubStructures(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));

  const resetCreateForm = () => {
    setNewTeamName("");
    setStructures([]);
    setSubStructures([]);
    setStructSearch("");
    setSubStructSearch("");
    setMemberListSearch("");
    setSelectedMembers([]);
    setLeaderName("");
    setShowCreateTeam(false);
  };

  const saveNewTeam = () => {
    if (!newTeamName.trim()) {
      toast.error("Komanda adı daxil edin");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Ən azı bir üzv seçin");
      return;
    }
    if (!leaderName) {
      toast.error("Komanda lideri seçin");
      return;
    }
    const leader = allPeople.find(p => p.name === leaderName);
    if (!leader) { toast.error("Seçilən lider siyahıda tapılmadı"); return; }

    const memberObjs = allPeople.filter(p => selectedMembers.includes(p.name) && p.name !== leader.name);
    const branch = subStructures[0] || structures[0] || "Satış Departamenti";
    const team: Team = {
      id: Date.now(),
      name: newTeamName.trim(),
      leader: leader.name,
      leaderAvatar: leader.avatar,
      kpiResult: 0,
      branch,
      activeKpi: 0,
      completedKpi: 0,
      totalKpi: 0,
      members: memberObjs,
      createdAt: new Date().toISOString(),
    };
    addTeam(team);
    setTeams(getTeams());
    toast.success("Komanda yaradıldı");
    resetCreateForm();
  };

  const allSelected = filteredCandidates.length > 0 && selectedMembers.length === filteredCandidates.length;

  return (
    <div className="min-h-screen">
      <Header title="Komandalar" />
      <main className="p-6 pb-24">
        {!isManager && (
          <button
            onClick={() => navigate("/teskilati-struktur")}
            className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
        )}
        <PageHero

          badge={isManager ? "Rəhbər Paneli" : "Komanda İdarəsi"}
          icon={Sparkles}
          title={isManager ? "Komandam" : "Komandalar"}
          subtitle={isManager ? "Rəhbərlik etdiyiniz komanda və üzvləri" : "Komandaları yaradın, redaktə edin və performansı izləyin"}
          right={
            !isManager ? (
              <button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                <Plus className="w-4 h-4" /> Yeni komanda yarat
              </button>
            ) : undefined
          }
        />



        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Komanda axtar..."
            className="w-full max-w-lg pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg bg-card"
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {bestTeam && (
            <div className="bg-card rounded-xl p-5 border border-border relative">
              <span className="absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full bg-zone-green-bg text-zone-green-text">Ən Yaxşı</span>
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-3"><Trophy className="w-5 h-5 text-primary" /></div>
              <p className="text-xs text-muted-foreground">Ən Yaxşı Komanda</p>
              <p className="text-lg font-bold text-primary mt-1">{bestTeam.name}</p>
              <p className="text-sm text-muted-foreground">KPI Nəticə: <span className="text-success font-semibold">{bestTeam.kpiResult}%</span></p>
            </div>
          )}
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-3"><TrendingUp className="w-5 h-5 text-primary" /></div>
            <p className="text-xs text-muted-foreground">ORTALAMA</p>
            <p className="text-xs text-muted-foreground">Orta Performans</p>
            <p className="text-3xl font-bold text-foreground mt-1">{avgPerformance}%</p>
            <p className="text-xs text-muted-foreground">{teams.length} komanda üzrə</p>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border relative">
            <span className="absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full bg-zone-green-bg text-zone-green-text">Aktiv</span>
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-3"><Users className="w-5 h-5 text-primary" /></div>
            <p className="text-xs text-muted-foreground">Ümumi Komandalar</p>
            <p className="text-3xl font-bold text-foreground mt-1">{teams.length}</p>
            <p className="text-xs text-muted-foreground">{totalMembers} komanda üzvü</p>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="font-semibold text-foreground">Komanda Müqayisəsi</h3>
            <PeriodPicker value={chartPeriod} onChange={setChartPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="KPI Nəticəsi" fill="hsl(230 70% 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Tamamlanmış" fill="hsl(145 65% 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-2">Seçilmiş dövr: <span className="font-medium text-foreground">{periodLabel(chartPeriod)}</span></p>
        </div>

        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const leaderMember = team.members.find(m => m.name === team.leader);
            const leaderInitial = (leaderMember?.avatar || team.leaderAvatar || team.leader.charAt(0)).toUpperCase();
            return (
              <div key={team.id} onClick={() => { setSelectedTeam(team); setMemberSearch(""); }} className="bg-card rounded-xl p-5 border border-border flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">{leaderInitial}</div>
                  <div>
                    <h4 className="font-semibold text-foreground">{team.name}</h4>
                    <p className="text-sm text-muted-foreground">{team.leader} · {team.branch}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {team.members.length + 1} üzv</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Team detail dialog — real Organization data ilə */}
      <Dialog open={!!selectedTeam} onOpenChange={() => setSelectedTeam(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="text-xl uppercase">{selectedTeam?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">Komanda təfərrüatları və üzvlər</p>
          </DialogHeader>
          {selectedTeam && (() => {
            const liveEmps = getLiveEmployees();
            const findEmp = (displayName: string) => {
              const key = displayName.trim().toLowerCase();
              return liveEmps.find(e => `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim().toLowerCase() === key);
            };
            const deptOf = (path?: string) => {
              if (!path) return "—";
              const first = path.split("›")[0]?.trim();
              return first || "—";
            };
            type Row = { name: string; position: string; department: string; avatar: string; isLeader: boolean };
            const rows: Row[] = [];
            const leaderEmp = findEmp(selectedTeam.leader);
            rows.push({
              name: selectedTeam.leader,
              position: leaderEmp?.positionName || "Komanda Lideri",
              department: deptOf(leaderEmp?.structurePath),
              avatar: (selectedTeam.leaderAvatar || selectedTeam.leader.charAt(0)).toUpperCase(),
              isLeader: true,
            });
            for (const m of selectedTeam.members) {
              if (m.name === selectedTeam.leader) continue;
              const e = findEmp(m.name);
              rows.push({
                name: m.name,
                position: e?.positionName || m.role || "—",
                department: deptOf(e?.structurePath),
                avatar: (m.avatar || m.name.charAt(0)).toUpperCase(),
                isLeader: false,
              });
            }
            const q = memberSearch.trim().toLowerCase();
            const visible = q
              ? rows.filter(r =>
                  r.name.toLowerCase().includes(q) ||
                  r.position.toLowerCase().includes(q) ||
                  r.department.toLowerCase().includes(q))
              : rows;
            return (
              <div className="flex flex-col overflow-hidden flex-1 px-6 pb-6 min-h-0">
                <div className="grid grid-cols-2 gap-3 shrink-0">
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Üzv sayı</p>
                    <p className="font-semibold text-foreground mt-1 text-lg">{rows.length}</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Yaradılma</p>
                    <p className="font-semibold text-foreground mt-1 text-lg">
                      {selectedTeam.createdAt ? new Date(selectedTeam.createdAt).toISOString().slice(0, 10) : "—"}
                    </p>
                  </div>
                </div>
                <div className="border border-border rounded-lg flex flex-col overflow-hidden mt-4 flex-1 min-h-0">
                  <div className="p-4 shrink-0 space-y-3">
                    <h4 className="font-semibold text-foreground">Komanda Üzvləri</h4>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Üzv axtar..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-border overflow-y-auto flex-1 min-h-0 px-4 max-h-[240px]">
                    {visible.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 py-3">
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${r.isLeader ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {r.avatar}
                          </div>
                          {r.isLeader && (
                            <Crown className="absolute -top-1.5 -right-1.5 w-4 h-4 text-amber-500 drop-shadow" fill="currentColor" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{r.name}</p>
                            {r.isLeader && (
                              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold">Lider</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.position}</p>
                          <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg>
                            <span>Departament: <span className="text-foreground font-medium">{r.department}</span></span>
                          </p>
                        </div>
                      </div>
                    ))}
                    {visible.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Uyğun üzv tapılmadı</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Create team dialog */}
      <Dialog open={showCreateTeam} onOpenChange={(open) => { if (!open) resetCreateForm(); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Komanda Yarat</DialogTitle>
            <p className="text-sm text-muted-foreground">Yeni komanda üçün məlumatları daxil edin</p>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground">Komanda adı</label>
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Komanda adı" className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:outline-none" />
            </div>

            {/* Struktur (dropdown multiselect) */}
            <div>
              <label className="text-sm font-medium text-foreground">Struktur (multiselect)</label>
              <DropdownMultiSelect
                options={STRUCTURES}
                selected={structures}
                onToggle={toggleStructure}
                placeholder="Struktur seçin"
                searchPlaceholder="Struktur axtar..."
              />
            </div>

            {/* Sub-struktur (dropdown multiselect) */}
            <div>
              <label className="text-sm font-medium text-foreground">Sub-struktur (multiselect)</label>
              <DropdownMultiSelect
                options={SUB_STRUCTURES}
                selected={subStructures}
                onToggle={toggleSubStructure}
                placeholder="Sub-struktur seçin"
                searchPlaceholder="Sub-struktur axtar..."
              />
              {(structures.length > 1 || subStructures.length > 1) && (
                <p className="text-[11px] text-primary mt-1.5">✓ Qarışıq komanda yarada bilərsiniz</p>
              )}
            </div>

            {/* Members */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">Komanda üzvləri</span>
                <button type="button" onClick={toggleAllMembers} className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-secondary transition-colors">
                  {allSelected ? "Seçimləri sıfırla" : "Hamısını seç"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">Komanda üzvlərini seçin.</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={memberListSearch} onChange={e => setMemberListSearch(e.target.value)} placeholder="Üzv axtar..." className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background" />
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto border border-border rounded-lg p-1.5">
                {filteredCandidates.map((p) => {
                  const checked = selectedMembers.includes(p.name);
                  return (
                    <div key={p.name} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${checked ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary"}`}>
                      <div onClick={() => toggleMember(p.name)} className="flex items-center gap-3 flex-1 cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">{p.avatar}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.role}</p>
                        </div>
                      </div>
                      <div onClick={() => toggleMember(p.name)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${checked ? "bg-primary border-primary" : "border-border"}`}>
                        {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected members - vertical wrap after 3, with search + scroll */}
            {selectedMembers.length > 0 && (
              <div className="border border-border rounded-lg p-3 bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Seçilmiş üzvlər ({selectedMembers.length})</p>
                </div>
                {selectedMembers.length > 3 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Seçilmişlərdə axtar..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background" />
                  </div>
                )}
                <div className={selectedMembers.length <= 3 ? "flex gap-2 flex-wrap" : "flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1"}>
                  {selectedMembers
                    .filter(name => selectedMembers.length <= 3 || name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(name => {
                      const p = allPeople.find(x => x.name === name);
                      if (!p) return null;
                      return (
                        <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-card border border-border">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-semibold shrink-0">{p.avatar}</div>
                          <span className="text-xs font-medium text-foreground truncate flex-1">{p.name}</span>
                          <X className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-destructive shrink-0" onClick={() => toggleMember(name)} />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            {/* Komanda lideri */}
            {selectedMembers.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground">Komanda lideri</label>
                <select
                  value={leaderName}
                  onChange={e => setLeaderName(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  <option value="">— Lider seçin —</option>
                  {selectedMembers.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}


            <div className="flex gap-3 pt-2">
              <button onClick={saveNewTeam} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">💾 Yadda Saxla</button>
              <button onClick={resetCreateForm} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary transition-colors">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsPage;
