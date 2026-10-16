import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { auth } from "../lib/firebase";

type Team = {
  id: string; name: string; league: "A" | "B"; played: number; won: number;
  drawn: number; lost: number; gf: number; ga: number; points: number; notes?: string | null;
  short_name?: string | null; home_ground?: string | null; logo_url?: string | null; participation_status?: string | null; manager_name?: string | null;
};
type Fixture = { id: string; home_team: string; away_team: string; match_date: string | null; venue: string | null; status: string; home_score: number | null; away_score: number | null; leg: string; competition: string };
type Tab = "standings" | "fixtures" | "directory" | "records" | "squad" | "transfers" | "reports" | "tournaments" | "approvals";
const SEASON = "2026";
const baseTabs: { id: Tab; label: string }[] = [
  { id: "standings", label: "Standings" }, { id: "fixtures", label: "Fixtures & results" }, { id: "directory", label: "Teams & players" }, { id: "records", label: "Imported CPL records" },
  { id: "squad", label: "Join a squad" }, { id: "transfers", label: "Transfers" }, { id: "reports", label: "Referee reports" }, { id: "tournaments", label: "Tournaments & payments" },
];

export default function PremierLeague() {
  const [tab, setTab] = useState<Tab>("standings");
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentSeason, setCurrentSeason] = useState(SEASON);
  const [availableSeasons, setAvailableSeasons] = useState<any[]>([]);
  const [seasonToActivate, setSeasonToActivate] = useState(SEASON);
  const [newSeasonForm, setNewSeasonForm] = useState({ season: "2027", name: "CPL 2027", current_leg: "first_leg", make_current: false });
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [cupStats, setCupStats] = useState<any[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [awardDefinitions, setAwardDefinitions] = useState<any[]>([]);
  const [importedRules, setImportedRules] = useState<any[]>([]);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<any[]>([]);
  const [resultCandidates, setResultCandidates] = useState<any[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChairman, setIsChairman] = useState(false);
  const [ownerUid, setOwnerUid] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownershipTransfers, setOwnershipTransfers] = useState<any[]>([]);
  const [managerForm, setManagerForm] = useState({ team_id: "", manager_uid: "", manager_email: "", manager_name: "" });
  const [refereeForm, setRefereeForm] = useState({ fixture_id: "", referee_uid: "", referee_name: "" });
  const [assignedFixtureIds, setAssignedFixtureIds] = useState<string[]>([]);
  const [seasonSettings, setSeasonSettings] = useState({ season: "2026", current_leg: "second_leg", transfers_open: false, match_card_fee: 100, referee_fee_per_team_match: 200, points_win: 3, points_draw: 1, points_loss: 0 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [leagueFilter, setLeagueFilter] = useState<"All" | "A" | "B">("All");
  const [newTeam, setNewTeam] = useState({ name: "", league: "A" as "A" | "B" });
  const [newFixture, setNewFixture] = useState({ home_team_id: "", away_team_id: "", match_date: "", venue: "", competition: "League" });
  const [joinForm, setJoinForm] = useState({ team_id: "", full_name: "", position: "", shirt_number: "" });
  const [transferForm, setTransferForm] = useState({ player_id: "", to_team: "", reason: "" });
  const [reportForm, setReportForm] = useState({ fixture_id: "", home_score: "", away_score: "", goals_cards_notes: "" });
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [myTransfers, setMyTransfers] = useState<any[]>([]);
  const [managedTeamIds, setManagedTeamIds] = useState<string[]>([]);
  const [pendingSquadRequests, setPendingSquadRequests] = useState<any[]>([]);
  const [profileRoles, setProfileRoles] = useState<any[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<any>({ till_number: "", paybill_number: "", account_reference: "CPL", account_name: "Chuka Premier League", payment_instructions: "" });
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentForm, setTournamentForm] = useState({ title: "", description: "", starts_at: "", expires_at: "" });
  const [tournamentImage, setTournamentImage] = useState<File | null>(null);
  const [roleForm, setRoleForm] = useState({ firebase_uid: "", role: "player", team_id: "" });
  const [selectedAccountType, setSelectedAccountType] = useState("fan");
  const [savedAccountType, setSavedAccountType] = useState<string | null>(null);
  const [accountTypeLoading, setAccountTypeLoading] = useState(true);
  const [accountTypeSaving, setAccountTypeSaving] = useState(false);
  const user = auth.currentUser;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [{ data: adminCheck, error: adminCheckError }, { data: chairmanCheck }] = await Promise.all([
      supabase.rpc("cpl_is_admin"), supabase.rpc("cpl_is_chairman"),
    ]);
    const serverAdmin = !adminCheckError && adminCheck === true;
    setIsAdmin(serverAdmin);
    setIsChairman(chairmanCheck === true);
    const [teamResult, fixtureResult, playerResult, seasonResult] = await Promise.all([
      supabase.from("cpl_teams").select("id,season,name,league,played,won,drawn,lost,gf,ga,points,notes,short_name,aliases,logo_url,home_ground,participation_status,manager_name,created_at,updated_at").eq("season", currentSeason).order("league").order("name"),
      supabase.from("cpl_fixtures").select("*").eq("season", currentSeason).order("match_date", { ascending: true, nullsFirst: false }),
      supabase.from("cpl_public_players").select("player_id,full_name,photo_url,position,shirt_number,season,membership_status,match_card_status,team_id,team_name,league").eq("season", currentSeason).order("full_name"),
      supabase.from("cpl_seasons").select("season,name,current_leg,is_current,transfers_open,match_card_fee,referee_fee_per_team_match,points_win,points_draw,points_loss").order("season", { ascending: false }),
    ]);
    if (teamResult.error || fixtureResult.error) {
      setError("CPL data could not be loaded. Apply the CPL database migration and confirm the Supabase project is configured for Firebase authentication.");
    } else {
      setTeams((teamResult.data ?? []) as Team[]);
      setFixtures((fixtureResult.data ?? []) as Fixture[]);
      setPlayers(playerResult.error ? [] : (playerResult.data ?? []));
      if (!seasonResult.error) {
        const seasonRows = seasonResult.data ?? [];
        setAvailableSeasons(seasonRows);
        const activeSeason = seasonRows.find((row: any) => row.is_current) ?? seasonRows.find((row: any) => row.season === currentSeason);
        if (activeSeason) {
          setSeasonSettings(previous => ({ ...previous, ...activeSeason }));
          setSeasonToActivate(activeSeason.season);
          if (activeSeason.season !== currentSeason) setCurrentSeason(activeSeason.season);
        }
      }
    }
    const [profileRoleResult, paymentResult, tournamentResult, preferenceResult] = await Promise.all([
      user ? supabase.from("cpl_profile_roles").select("role,team_id,active").eq("firebase_uid", user.uid).eq("active", true) : Promise.resolve({ data: [], error: null } as any),
      supabase.from("cpl_payment_settings").select("till_number,paybill_number,account_reference,account_name,payment_instructions").eq("singleton", true).maybeSingle(),
      supabase.from("cpl_tournaments").select("id,title,description,image_url,starts_at,expires_at,created_at").eq("status", "active").gt("expires_at", new Date().toISOString()).order("expires_at"),
      user ? supabase.from("cpl_account_preferences").select("account_type").eq("firebase_uid", user.uid).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    ]);
    setProfileRoles(profileRoleResult.data ?? []);
    if (user) {
      const savedType = preferenceResult.error ? null : preferenceResult.data?.account_type ?? null;
      setSavedAccountType(savedType);
      if (savedType) setSelectedAccountType(savedType);
      setAccountTypeLoading(false);
    } else { setSavedAccountType(null); setAccountTypeLoading(false); }
    if (paymentResult.data) setPaymentSettings((prev: any) => ({ ...prev, ...paymentResult.data }));
    setTournaments(tournamentResult.data ?? []);
    const [cupStatsResult, transferHistoryResult, awardsResult, rulesResult, disciplineResult, resultCandidatesResult] = await Promise.all([
      supabase.from("cpl_imported_player_stats").select("*").eq("season", currentSeason).order("competition").order("player_name"),
      supabase.from("cpl_transfer_history").select("*").eq("season", currentSeason).order("source_date", { ascending: false }),
      supabase.from("cpl_award_definitions").select("*").eq("season", currentSeason).order("category").order("title"),
      supabase.from("cpl_imported_rules").select("*").eq("season", currentSeason).order("rule_key"),
      supabase.from("cpl_imported_disciplinary_records").select("*").eq("season", currentSeason).order("notice_date", { ascending: false }),
      supabase.from("cpl_imported_result_candidates").select("*").eq("season", currentSeason).order("match_date", { ascending: false }),
    ]);
    setCupStats(cupStatsResult.error ? [] : (cupStatsResult.data ?? []));
    setTransferHistory(transferHistoryResult.error ? [] : (transferHistoryResult.data ?? []));
    setAwardDefinitions(awardsResult.error ? [] : (awardsResult.data ?? []));
    setImportedRules(rulesResult.error ? [] : (rulesResult.data ?? []));
    setDisciplinaryRecords(disciplineResult.error ? [] : (disciplineResult.data ?? []));
    setResultCandidates(resultCandidatesResult.error ? [] : (resultCandidatesResult.data ?? []));

    if (serverAdmin) {
      const [r, t, q] = await Promise.all([
        supabase.from("cpl_match_reports").select("*, cpl_fixtures(home_team,away_team,match_date)").eq("season", currentSeason).neq("status", "approved").order("created_at", { ascending: false }),
        supabase.from("cpl_transfer_requests").select("*").eq("season", currentSeason).neq("chairman_status", "approved").order("requested_at", { ascending: false }),
        supabase.from("cpl_squad_requests").select("id,season,team_id,full_name,position,shirt_number,status,fee_amount,manager_reviewed_by,manager_reviewed_at,created_at,cpl_teams(name)").eq("season", currentSeason).in("status", ["pending_manager_approval", "pending_league_review"]).order("created_at", { ascending: false }),
      ]);
      setPendingReports(r.data ?? []); setPendingTransfers(t.data ?? []); setPendingSquadRequests(q.data ?? []);
    }
    if (user) {
      const [ownershipResult, transferResult, managerResult, refereeResult, squadResult] = await Promise.all([
        supabase.from("cpl_ownership_transfers").select("*").eq("status", "pending_acceptance").order("requested_at", { ascending: false }),
        supabase.from("cpl_transfer_requests").select("*").order("requested_at", { ascending: false }),
        supabase.from("cpl_team_managers").select("team_id").eq("manager_uid", user.uid).eq("is_active", true),
        supabase.from("cpl_referee_assignments").select("fixture_id").eq("referee_uid", user.uid).eq("active", true),
        supabase.from("cpl_squad_requests").select("id,season,team_id,full_name,position,shirt_number,status,fee_amount,manager_reviewed_by,manager_reviewed_at,created_at,cpl_teams(name)").eq("season", currentSeason).in("status", ["pending_manager_approval", "pending_league_review"]).order("created_at", { ascending: false }),
      ]);
      setOwnershipTransfers(ownershipResult.data ?? []);
      setMyTransfers(transferResult.data ?? []);
      setManagedTeamIds((managerResult.data ?? []).map((row: any) => row.team_id));
      setAssignedFixtureIds((refereeResult.data ?? []).map((row: any) => row.fixture_id));
      setPendingSquadRequests(squadResult.data ?? []);
    } else {
      setAssignedFixtureIds([]); setManagedTeamIds([]); setMyTransfers([]); setOwnershipTransfers([]); setPendingSquadRequests([]);
    }
    setLoading(false);
  }, [user?.uid, currentSeason]);
  useEffect(() => { void load(); }, [load]);

  const rankedTeams = useMemo(() => {
    const rows = teams.filter(t => leagueFilter === "All" || t.league === leagueFilter)
      .map(t => ({ ...t, computedPoints: Number(t.points ?? (t.won * seasonSettings.points_win + t.drawn * seasonSettings.points_draw + t.lost * seasonSettings.points_loss)), gd: t.gf - t.ga }));
    const headToHeadPoints = (teamName: string, opponentName: string) => fixtures
      .filter(f => f.status === "approved" && f.competition === "League" &&
        ((f.home_team.toLowerCase() === teamName.toLowerCase() && f.away_team.toLowerCase() === opponentName.toLowerCase()) ||
         (f.away_team.toLowerCase() === teamName.toLowerCase() && f.home_team.toLowerCase() === opponentName.toLowerCase())))
      .reduce((total, f) => {
        if (f.home_score === null || f.away_score === null) return total;
        const isHome = f.home_team.toLowerCase() === teamName.toLowerCase();
        const own = isHome ? f.home_score : f.away_score;
        const other = isHome ? f.away_score : f.home_score;
        return total + (own > other ? seasonSettings.points_win : own === other ? seasonSettings.points_draw : seasonSettings.points_loss);
      }, 0);
    rows.sort((a, b) => a.league.localeCompare(b.league) || b.computedPoints - a.computedPoints || b.gd - a.gd || b.gf - a.gf ||
      (headToHeadPoints(b.name, a.name) - headToHeadPoints(a.name, b.name)) || a.name.localeCompare(b.name));
    return rows.map((team, index) => ({ ...team, rank: rows.slice(0, index).filter(previous => previous.league === team.league).length + 1 }));
  }, [teams, fixtures, leagueFilter, seasonSettings.points_win, seasonSettings.points_draw, seasonSettings.points_loss]);

  const adminUpdate = async (team: Team, field: keyof Team, raw: string) => {
    if (!isChairman) return;
    const numeric = ["played", "won", "drawn", "lost", "gf", "ga", "points"].includes(String(field));
    const value = numeric ? Number(raw) : raw;
    let reason = "";
    if (numeric) {
      reason = window.prompt(`Reason for correcting ${team.name} — ${String(field)}?`)?.trim() ?? "";
      if (reason.length < 5) { setError("Standing correction cancelled. Enter a reason of at least five characters."); return; }
    }
    setSaving(true); setMessage(""); setError("");
    const result = numeric
      ? await supabase.rpc("cpl_set_standing_override", { p_team_id: team.id, p_field_name: String(field), p_override_value: Number(value), p_reason: reason })
      : await supabase.from("cpl_teams").update({ [field]: value, updated_by_email: user?.email, updated_at: new Date().toISOString() }).eq("id", team.id);
    setSaving(false);
    if (result.error) setError(result.error.message); else { setMessage(numeric ? "Standing correction saved with an audit reason." : "CPL team record updated."); await load(); }
  };

  const addTeam = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman || !newTeam.name.trim()) return;
    setSaving(true); setError(""); setMessage("");
    const { error: insertError } = await supabase.from("cpl_teams").insert({ season: currentSeason, name: newTeam.name.trim(), league: newTeam.league, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, created_by_email: user?.email });
    setSaving(false); if (insertError) setError(insertError.message); else { setNewTeam({ name: "", league: "A" }); setMessage("Team added to the current CPL season."); await load(); }
  };

  const activateSeason = async () => {
    if (!isChairman) return;
    setSaving(true); setError(""); setMessage("");
    const { error: seasonError } = await supabase.rpc("cpl_set_current_season", { p_season: seasonToActivate });
    setSaving(false);
    if (seasonError) setError(seasonError.message); else { setMessage(`Current CPL season changed to ${seasonToActivate}. Historical records were preserved.`); await load(); }
  };

  const createSeason = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman) return;
    setSaving(true); setError(""); setMessage("");
    const { error: seasonError } = await supabase.rpc("cpl_create_season", { p_season: newSeasonForm.season.trim(), p_name: newSeasonForm.name.trim(), p_current_leg: newSeasonForm.current_leg, p_make_current: newSeasonForm.make_current });
    setSaving(false);
    if (seasonError) setError(seasonError.message); else { setMessage("Season created without copying or resetting teams, fixtures, or results. Add only verified season records."); await load(); }
  };

  const addFixture = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman) return;
    const home = teams.find(t => t.id === newFixture.home_team_id);
    const away = teams.find(t => t.id === newFixture.away_team_id);
    if (!home || !away || home.id === away.id) { setError("Select two different registered teams."); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: fixtureError } = await supabase.from("cpl_fixtures").insert({ season: currentSeason, home_team: home.name, away_team: away.name, home_team_id: home.id, away_team_id: away.id, match_date: newFixture.match_date ? new Date(newFixture.match_date).toISOString() : null, venue: newFixture.venue.trim() || null, competition: newFixture.competition, leg: seasonSettings.current_leg, status: "scheduled", source_note: "Entered by CPL chairman; verify against official fixture source" });
    setSaving(false);
    if (fixtureError) setError(fixtureError.message); else { setMessage("Fixture added as scheduled. It has no result until an assigned referee submits a report and the chairman approves it."); setNewFixture({ home_team_id: "", away_team_id: "", match_date: "", venue: "", competition: "League" }); await load(); }
  };

  const saveSeasonSettings = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman) return;
    setSaving(true); setError(""); setMessage("");
    const { error: settingsError } = await supabase.from("cpl_seasons").update({ current_leg: seasonSettings.current_leg, transfers_open: seasonSettings.transfers_open, match_card_fee: Number(seasonSettings.match_card_fee), referee_fee_per_team_match: Number(seasonSettings.referee_fee_per_team_match), points_win: Number(seasonSettings.points_win), points_draw: Number(seasonSettings.points_draw), points_loss: Number(seasonSettings.points_loss), updated_by_uid: user?.uid, updated_at: new Date().toISOString() }).eq("season", currentSeason);
    setSaving(false);
    if (settingsError) setError(settingsError.message); else { setMessage("CPL season rules saved. Transfer requests are blocked whenever the transfer window is closed."); await load(); }
  };

  const assignTeamManager = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman) return;
    setSaving(true); setError(""); setMessage("");
    const { error: assignError } = await supabase.rpc("cpl_assign_team_manager", { p_team_id: managerForm.team_id, p_manager_uid: managerForm.manager_uid.trim(), p_manager_email: managerForm.manager_email.trim() || null, p_manager_name: managerForm.manager_name.trim() || null });
    setSaving(false);
    if (assignError) setError(assignError.message); else { setMessage("Team manager assigned. The manager can now review that team's squad requests and approve/reject transfers."); setManagerForm({ team_id: "", manager_uid: "", manager_email: "", manager_name: "" }); await load(); }
  };

  const assignReferee = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman) return;
    setSaving(true); setError(""); setMessage("");
    const { error: assignError } = await supabase.rpc("cpl_assign_referee", { p_fixture_id: refereeForm.fixture_id, p_referee_uid: refereeForm.referee_uid.trim(), p_referee_name: refereeForm.referee_name.trim() || null });
    setSaving(false);
    if (assignError) setError(assignError.message); else { setMessage("Referee assigned to the fixture."); setRefereeForm({ fixture_id: "", referee_uid: "", referee_name: "" }); await load(); }
  };

  const requestOwnershipTransfer = async (event: FormEvent) => {
    event.preventDefault();
    if (!isChairman) { setError("Only the current CPL chairman can transfer ownership."); return; }
    if (!ownerUid.trim() || ownerUid.trim() === user?.uid) { setError("Enter the Firebase UID of a different existing Chuka Comrades account."); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: transferError } = await supabase.rpc("cpl_request_ownership_transfer", { new_owner_uid: ownerUid.trim(), new_owner_email: ownerEmail.trim() || null });
    setSaving(false);
    if (transferError) setError(transferError.message);
    else { setMessage("Ownership transfer requested. The proposed chairman must sign in to their own Chuka Comrades account and accept it."); setOwnerUid(""); setOwnerEmail(""); await load(); }
  };

  const acceptOwnershipTransfer = async (transferId: string) => {
    if (!user) return;
    setSaving(true); setError(""); setMessage("");
    const { error: acceptError } = await supabase.rpc("cpl_accept_ownership_transfer", { transfer_id: transferId });
    setSaving(false);
    if (acceptError) setError(acceptError.message); else { setMessage("CPL ownership transferred. Sign in again if the updated permissions do not appear immediately."); await load(); }
  };

  const submitJoin = async (event: FormEvent) => {
    event.preventDefault(); if (!user) { setError("Sign in to Chuka Comrades first."); return; }
    if (!joinForm.team_id || !joinForm.full_name.trim()) return;
    setSaving(true); setError(""); setMessage("");
    const { error: insertError } = await supabase.from("cpl_squad_requests").insert({ season: currentSeason, team_id: joinForm.team_id, full_name: joinForm.full_name.trim(), position: joinForm.position || null, shirt_number: joinForm.shirt_number || null, firebase_uid: user.uid, email: user.email, status: "pending_manager_approval", fee_amount: 0 });
    setSaving(false); if (insertError) setError(insertError.message); else { setMessage("Squad request submitted. Joining is free for this season; your team manager must approve it."); setJoinForm({ team_id: "", full_name: "", position: "", shirt_number: "" }); }
  };

  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault(); if (!user) { setError("Sign in to Chuka Comrades first."); return; }
    if (!transferForm.player_id || !transferForm.to_team) { setError("Select a registered player and a different destination team."); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: insertError } = await supabase.rpc("cpl_submit_transfer", { p_player_id: transferForm.player_id, p_to_team_id: transferForm.to_team, p_reason: transferForm.reason.trim() || null });
    setSaving(false);
    if (insertError) setError(insertError.message);
    else { setMessage("Transfer request recorded. Player consent, both team-manager approvals, and chairman approval are required before the squad changes."); setTransferForm({ player_id: "", to_team: "", reason: "" }); await load(); }
  };

  const approvePlayerTransfer = async (transferId: string) => {
    setSaving(true); setError(""); setMessage("");
    const { error: approvalError } = await supabase.rpc("cpl_player_approve_transfer", { p_transfer_id: transferId });
    setSaving(false);
    if (approvalError) setError(approvalError.message); else { setMessage("Player consent recorded."); await load(); }
  };

  const approveTeamTransfer = async (transferId: string, decision: "approved" | "rejected") => {
    setSaving(true); setError(""); setMessage("");
    const { error: approvalError } = await supabase.rpc("cpl_approve_transfer_as_team_manager", { p_transfer_id: transferId, p_decision: decision });
    setSaving(false);
    if (approvalError) setError(approvalError.message); else { setMessage(decision === "approved" ? "Team approval recorded." : "Transfer rejected by a team manager."); await load(); }
  };

  const reviewRecord = async (table: string, id: string, changes: Record<string, unknown>, success: string) => {
    if (!isChairman) return; setSaving(true); setError(""); setMessage("");
    const { error: reviewError } = await supabase.from(table).update(changes).eq("id", id);
    setSaving(false); if (reviewError) setError(reviewError.message); else { setMessage(success); await load(); }
  };

  const reviewSquadRequest = async (requestId: string, decision: "approved" | "rejected") => {
    if (!user) return;
    setSaving(true); setError(""); setMessage("");
    const { error: reviewError } = await supabase.rpc("cpl_review_squad_request", { p_request_id: requestId, p_decision: decision });
    setSaving(false);
    if (reviewError) setError(reviewError.message);
    else { setMessage(decision === "approved" ? "Player registered to the squad. No current-season squad fee was charged." : "Squad request rejected. The player can request another eligible team."); await load(); }
  };

  const submitReport = async (event: FormEvent) => {
    event.preventDefault(); if (!user) { setError("Sign in to Chuka Comrades first."); return; }
    if (!reportForm.fixture_id || reportForm.home_score === "" || reportForm.away_score === "") { setError("Choose a fixture and enter both scores."); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: insertError } = await supabase.from("cpl_match_reports").insert({ season: currentSeason, fixture_id: reportForm.fixture_id, home_score: Number(reportForm.home_score), away_score: Number(reportForm.away_score), event_notes: reportForm.goals_cards_notes.trim() || null, submitted_by_uid: user.uid, submitted_by_email: user.email, status: "pending_chairman_approval" });
    setSaving(false); if (insertError) setError(insertError.message); else { setMessage("Match report submitted for chairman approval. Standings will not change until it is approved."); setReportForm({ fixture_id: "", home_score: "", away_score: "", goals_cards_notes: "" }); }
  };

  const savePaymentSettings = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman) return;
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("cpl_payment_settings").upsert({ singleton: true, ...paymentSettings, updated_by_uid: user?.uid, updated_at: new Date().toISOString() }, { onConflict: "singleton" });
    setSaving(false); if (saveError) setError(saveError.message); else setMessage("Payment instructions saved.");
  };

  const createTournament = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman || !user) return;
    if (!tournamentForm.title.trim() || !tournamentForm.expires_at) { setError("Enter a tournament name and expiry date."); return; }
    const expires = new Date(tournamentForm.expires_at);
    if (Number.isNaN(expires.getTime()) || expires <= new Date()) { setError("Tournament expiry must be in the future."); return; }
    setSaving(true); setError(""); setMessage("");
    let imagePath: string | null = null; let imageUrl: string | null = null;
    if (tournamentImage) {
      if (!/^image\/(jpeg|png|webp)$/.test(tournamentImage.type) || tournamentImage.size > 5 * 1024 * 1024) { setSaving(false); setError("Use a JPG, PNG or WebP image up to 5 MB."); return; }
      imagePath = `${user.uid}/${crypto.randomUUID()}-${tournamentImage.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const uploaded = await supabase.storage.from("cpl-tournament-images").upload(imagePath, tournamentImage, { upsert: false, contentType: tournamentImage.type });
      if (uploaded.error) { setSaving(false); setError(`Tournament image upload failed: ${uploaded.error.message}`); return; }
      imageUrl = supabase.storage.from("cpl-tournament-images").getPublicUrl(imagePath).data.publicUrl;
    }
    const { error: insertError } = await supabase.from("cpl_tournaments").insert({ title: tournamentForm.title.trim(), description: tournamentForm.description.trim() || null, starts_at: tournamentForm.starts_at ? new Date(tournamentForm.starts_at).toISOString() : null, expires_at: expires.toISOString(), image_path: imagePath, image_url: imageUrl, created_by_uid: user.uid });
    setSaving(false);
    if (insertError) { if (imagePath) await supabase.storage.from("cpl-tournament-images").remove([imagePath]); setError(insertError.message); }
    else { setTournamentForm({ title: "", description: "", starts_at: "", expires_at: "" }); setTournamentImage(null); setMessage("Tournament published. Its database record expires at the selected time; configure the scheduled cleanup job to permanently remove expired records and image files."); await load(); }
  };

  const assignProfileRole = async (event: FormEvent) => {
    event.preventDefault(); if (!isChairman || !roleForm.firebase_uid.trim()) return;
    setSaving(true); setError(""); setMessage("");
    const { error: roleError } = await supabase.from("cpl_profile_roles").upsert({ firebase_uid: roleForm.firebase_uid.trim(), role: roleForm.role, team_id: roleForm.team_id || null, active: true, assigned_by_uid: user?.uid }, { onConflict: "firebase_uid,role,team_id" });
    setSaving(false); if (roleError) setError(roleError.message); else { setMessage("Role assigned. The person must sign in with their existing Chuka Comrades account."); setRoleForm({ firebase_uid: "", role: "player", team_id: "" }); }
  };

  const saveAccountType = async () => {
    if (!user) { setError("Sign in with Google to choose your CPL account type."); return; }
    if (!["fan", "player", "team_manager", "referee"].includes(selectedAccountType)) {
      setError("Chairman and Secretary accounts can only be assigned by the authorized CPL administrator."); return;
    }
    setAccountTypeSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("cpl_account_preferences").upsert({ firebase_uid: user.uid, account_type: selectedAccountType, updated_at: new Date().toISOString() }, { onConflict: "firebase_uid" });
    setAccountTypeSaving(false);
    if (saveError) { setError(`Could not save your CPL account type. ${saveError.message}`); return; }
    setSavedAccountType(selectedAccountType);
    setMessage(`Your CPL account preference is saved as ${selectedAccountType.replaceAll("_", " ")}. This does not grant official permissions.`);
    if (selectedAccountType === "player") setTab("squad");
    else if (selectedAccountType === "fan") setTab("standings");
  };

  return <section className="feature-page cpl-page">
    <div className="homepage-heading"><span className="eyebrow">CHUKA COMRADES · LEAGUE CENTRE</span><h2>🏆 Chuka Premier League</h2><p>{currentSeason} season · {String(seasonSettings.current_leg).replaceAll("_", " ")} · Opened through your existing Chuka Comrades sign-in.</p></div>
    <div className="cpl-notice"><strong>Current-season squad joining is free.</strong><span>Requests still require team-manager approval. Official results and transfers only take effect after the required approvals.</span></div>
    {accountTypeLoading ? <div className="cpl-profile-summary"><strong>Checking your CPL account…</strong><span>Please wait while we check whether you have already chosen an account type.</span></div> : !savedAccountType ? <div className="cpl-account-setup"><div className="cpl-account-setup-mark">⚽</div><span className="eyebrow">FIRST-TIME CPL SETUP</span><h3>Choose how you want to use the league</h3><p>You're signed in with your Chuka Comrades Google account. Choose your account type once to personalize your CPL experience.</p><div className="cpl-account-options">{[{value:"fan",icon:"👀",title:"Fan",description:"Follow standings, fixtures and results."},{value:"player",icon:"🥅",title:"Player",description:"Request to join a team and build your player record."},{value:"team_manager",icon:"🧢",title:"Team manager",description:"Request manager access; team authority needs approval."},{value:"referee",icon:"🟨",title:"Referee",description:"Get assigned to fixtures after verification."}].map(option => <button type="button" key={option.value} className={`cpl-account-option${selectedAccountType===option.value?" selected":""}`} onClick={() => setSelectedAccountType(option.value)} aria-pressed={selectedAccountType===option.value}><span>{option.icon}</span><strong>{option.title}</strong><small>{option.description}</small></button>)}</div><button type="button" className="button button-primary" disabled={accountTypeSaving} onClick={() => void saveAccountType()}>{accountTypeSaving ? "Saving preference…" : "Continue to Chuka Premier League →"}</button><small className="cpl-account-security">Chairman and Secretary roles are assigned only by {"sidneywafula30@gmail.com"}. Selecting an account type never grants official permissions.</small></div> : <div className="cpl-profile-summary"><strong>Your CPL profile</strong><span>{profileRoles.length ? profileRoles.map((r: any) => r.role.replaceAll("_", " ")).join(" · ") : savedAccountType.replaceAll("_", " ")}</span><small>Your saved account preference can be changed below. Official permissions are assigned and verified separately.</small><div className="cpl-account-inline"><label>Account type<select value={selectedAccountType} onChange={e => setSelectedAccountType(e.target.value)}><option value="fan">Fan</option><option value="player">Player</option><option value="team_manager">Team manager — approval required</option><option value="referee">Referee — assignment required</option></select></label><button type="button" disabled={accountTypeSaving || selectedAccountType===savedAccountType} onClick={() => void saveAccountType()}>{accountTypeSaving ? "Saving…" : "Save preference"}</button></div><small>Chairman and Secretary accounts are assigned only by {"sidneywafula30@gmail.com"}.</small></div>}
    {savedAccountType && <>
    {isAdmin && <div className="cpl-admin-banner"><strong>Initial CPL administrator</strong><span>Signed in as {user?.email}. Your permissions were confirmed by the database. Use the ownership transfer workflow below when the real chairman is ready.</span></div>}
    {message && <p className="form-feedback" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <div className="league-tabs" role="tablist">{[...baseTabs, ...(isChairman ? [{ id: "approvals" as Tab, label: "Chairman approvals" }] : [])].map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id}>{item.label}</button>)}</div>
    {loading ? <p>Loading CPL season records…</p> : <>
      {tab === "standings" && <>
        <div className="cpl-toolbar"><label>Division <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value as "All" | "A" | "B")}><option value="All">All divisions</option><option value="A">League A</option><option value="B">League B</option></select></label><button type="button" onClick={() => void load}>Refresh records</button></div>
        {rankedTeams.length && rankedTeams.every(team => team.played === 0 && team.points === 0) && <p className="cpl-notice"><strong>Standings awaiting verification.</strong><span>The WhatsApp export did not contain a complete verified standings table. Team records and fixtures were imported, but these zeroed stats are placeholders—not the official league positions. Confirm results and approve match reports before relying on the table.</span></p>}{rankedTeams.length ? <div className="league-table-wrap"><table className="league-table"><thead><tr><th>#</th><th>Team</th><th>Div.</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>{rankedTeams.map(team => <tr key={team.id}><td>{team.rank}</td><td>{isChairman ? <input aria-label={`${team.name} name`} className="cpl-cell-input cpl-team-name" defaultValue={team.name} onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== team.name) void adminUpdate(team, "name", e.target.value.trim()); }} /> : team.name}</td><td>{isChairman ? <select aria-label={`${team.name} division`} value={team.league} onChange={e => void adminUpdate(team, "league", e.target.value)}><option value="A">A</option><option value="B">B</option></select> : team.league}</td>{(["played", "won", "drawn", "lost", "gf", "ga"] as const).map(field => <td key={field}>{isChairman ? <input className="cpl-cell-input" aria-label={`${team.name} ${field}`} type="number" min="0" defaultValue={team[field]} onBlur={e => { if (Number(e.target.value) !== team[field]) void adminUpdate(team, field, e.target.value); }} /> : team[field]}</td>)}<td>{team.gd}</td><td>{isChairman ? <input className="cpl-cell-input" aria-label={`${team.name} points`} type="number" defaultValue={team.computedPoints} onBlur={e => { if (Number(e.target.value) !== team.computedPoints) void adminUpdate(team, "points", e.target.value); }} /> : team.computedPoints}</td></tr>)}</tbody></table></div> : <div className="cpl-empty"><h3>No verified standings loaded yet</h3><p>The previous demo table has been removed. Apply the CPL migration, then the chairman can enter and verify the latest official second-leg standings.</p></div>}
        {isChairman && <form className="cpl-inline-form" onSubmit={addTeam}><h3>Add or register a team</h3><input value={newTeam.name} onChange={e => setNewTeam(v => ({ ...v, name: e.target.value }))} placeholder="Official team name" required /><select value={newTeam.league} onChange={e => setNewTeam(v => ({ ...v, league: e.target.value as "A" | "B" }))}><option value="A">League A</option><option value="B">League B</option></select><button disabled={saving}>{saving ? "Saving…" : "Add team"}</button></form>}
        {saving && <p className="cpl-muted">Saving changes…</p>}
      </>}
      {tab === "fixtures" && <><h3>Official fixtures and approved results</h3><p>Imported first-leg fixtures are marked scheduled. Only chairman-approved referee reports count as official results.</p>{fixtures.length ? <div className="feature-grid">{fixtures.map(f => <article className="feature-card" key={f.id}><span className="feature-icon">⚽</span><p>{f.competition} · {f.leg}</p><h3>{f.home_team} {f.status === "approved" ? `${f.home_score ?? "–"} – ${f.away_score ?? "–"}` : "vs"} {f.away_team}</h3><p>{f.match_date ? new Date(f.match_date).toLocaleString() : "Date to be confirmed"}</p><p>{f.venue || "Venue to be confirmed"} · {f.status}</p></article>)}</div> : <div className="cpl-empty"><h3>No fixtures loaded</h3><p>Apply the CPL fixture migration or have the chairman add a verified schedule.</p></div>}</>}
      {tab === "directory" && <><h3>Teams and registered players</h3><p>Only approved, public player profiles appear here. Contact details and payment records are never displayed.</p><label className="cpl-search-label">Search by team, player, player ID, or position<input value={directorySearch} onChange={e => setDirectorySearch(e.target.value)} placeholder="Search CPL directory" /></label><div className="feature-grid">{teams.filter(t => [t.name, t.short_name, t.league, t.home_ground].some(v => String(v ?? "").toLowerCase().includes(directorySearch.toLowerCase()))).map(t => <article className="feature-card" key={t.id}>{t.logo_url && <img className="cpl-team-logo" src={t.logo_url} alt={`${t.name} logo`} loading="lazy" />}<span className="feature-icon">⚽</span><p>League {t.league}</p><h3>{t.name}</h3><p>{t.home_ground || "Home ground not listed"}</p><p>{t.participation_status || "active"}</p><p>{players.filter(p => p.team_id === t.id).length} public registered player(s)</p></article>)}</div><div className="cpl-player-directory">{players.filter(p => [p.full_name,p.player_id,p.position,p.team_name,p.league].some(v => String(v ?? "").toLowerCase().includes(directorySearch.toLowerCase()))).map(p => <article className="cpl-review-card" key={p.player_id}>{p.photo_url && <img className="cpl-player-photo" src={p.photo_url} alt={`${p.full_name} profile`} loading="lazy" />}<strong>{p.full_name}</strong><p>Player ID: {p.player_id} · {p.team_name || "Unattached"} · League {p.league || "—"}</p><p>{p.position || "Position not listed"}{p.shirt_number ? ` · #${p.shirt_number}` : ""} · Match card: {p.match_card_status}</p></article>)}</div>{players.length === 0 && <p className="cpl-muted">No verified public player profiles have been registered yet.</p>}</>}
      {tab === "records" && <><h3>Imported CPL records · {currentSeason}</h3><p>These records were extracted from official CPL documents and WhatsApp posts. Anything marked pending or submitted is not treated as an approved result, roster change, payment, or award winner.</p>
        <div className="cpl-review-section"><h4>Reported match results awaiting verification ({resultCandidates.length})</h4>{resultCandidates.length ? <div className="feature-grid">{resultCandidates.map((x: any) => <article className="feature-card" key={x.id}><p>{x.competition}{x.league ? ` · League ${x.league}` : ""} · {x.match_date}</p><h3>{x.home_team} {x.home_score} – {x.away_score} {x.away_team}</h3><strong>{x.status.replaceAll("_", " ")}</strong><p>Source: {x.source_author} · {x.source_message}</p><p>{x.notes}</p></article>)}</div> : <p>No result candidates imported.</p>}</div>
        <div className="cpl-review-section"><h4>CPL Cup goals and assists ({cupStats.length} source entries)</h4>{cupStats.length ? <div className="feature-grid">{cupStats.map((x: any) => <article className="feature-card" key={x.id}><span className="feature-icon">⚽</span><p>{x.competition} · {x.verification_status.replaceAll("_", " ")}</p><h3>{x.player_name}</h3><p>{x.team_name}</p><p>Goals: {x.goals} · Assists: {x.assists}</p><small>Source: {x.source_document}</small>{x.notes && <p>{x.notes}</p>}</article>)}</div> : <p>No imported Cup stats found. Apply the WhatsApp data migration to load the source sheets.</p>}</div>
        <div className="cpl-review-section"><h4>Transfer history and submissions ({transferHistory.length})</h4>{transferHistory.length ? <div className="feature-grid">{transferHistory.map((x: any) => <article className="feature-card" key={x.id}><p>{x.record_type.replaceAll("_", " ")} · {x.source_date || "Date not listed"}</p><h3>{x.player_name}</h3><p>{x.from_team} → {x.to_team}</p><strong>{x.status.replaceAll("_", " ")}</strong><p>{x.note}</p><small>{x.source_document}</small></article>)}</div> : <p>No imported transfer history found.</p>}</div>
        <div className="cpl-review-section"><h4>Official award criteria ({awardDefinitions.length})</h4>{awardDefinitions.length ? <div className="feature-grid">{awardDefinitions.map((x: any) => <article className="feature-card" key={x.id}><p>{x.category}</p><h3>{x.title}</h3><p>{x.criteria}</p>{x.minimum_eligibility && <p><strong>Eligibility:</strong> {x.minimum_eligibility}</p>}{x.tie_breakers_or_notes && <p>{x.tie_breakers_or_notes}</p>}</article>)}</div> : <p>No imported award criteria found.</p>}</div>
        <div className="cpl-review-section"><h4>Rules and fee evidence ({importedRules.length})</h4>{importedRules.length ? <div className="feature-grid">{importedRules.map((x: any) => <article className="feature-card" key={x.id}><p>{x.verification_status.replaceAll("_", " ")}</p><h3>{x.rule_key.replaceAll("_", " ")}</h3><p>{x.value_text}</p><p>{x.notes}</p><small>{x.source_document}</small></article>)}</div> : <p>No imported rule evidence found.</p>}</div>
        <div className="cpl-review-section"><h4>Disciplinary notices and reported arrears ({disciplinaryRecords.length})</h4>{disciplinaryRecords.length ? <div className="feature-grid">{disciplinaryRecords.map((x: any) => <article className="feature-card" key={x.id}><p>{x.reference} · {x.notice_date}</p><h3>{x.club}</h3><p>KSh {Number(x.amount_ksh).toLocaleString()} · {x.status.replaceAll("_", " ")}</p><p>{x.reason}</p><p>{x.notes}</p><small>{x.source_document}</small></article>)}</div> : <p>No imported disciplinary records found.</p>}</div>
      </>}
      {tab === "squad" && <><h3>Join a CPL squad</h3><p>Free for the 2026 season. Your request goes to the selected team's manager for approval.</p><form className="cpl-form" onSubmit={submitJoin}><label>Team<select required value={joinForm.team_id} onChange={e => setJoinForm(v => ({ ...v, team_id: e.target.value }))}><option value="">Select team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name} · League {t.league}</option>)}</select></label><label>Player full name<input required value={joinForm.full_name} onChange={e => setJoinForm(v => ({ ...v, full_name: e.target.value }))} /></label><label>Playing position<select value={joinForm.position} onChange={e => setJoinForm(v => ({ ...v, position: e.target.value }))}><option value="">Select position</option>{["Goalkeeper", "Centre-back", "Full-back / Wing-back", "Defensive midfielder", "Central midfielder", "Attacking midfielder", "Winger", "Striker", "Other"].map(p => <option key={p}>{p}</option>)}</select></label><label>Preferred shirt number<input type="number" min="1" max="99" value={joinForm.shirt_number} onChange={e => setJoinForm(v => ({ ...v, shirt_number: e.target.value }))} /></label><button disabled={saving || !user}>{saving ? "Submitting…" : "Request to join squad · Free"}</button>{!user && <small>Sign in to Chuka Comrades to submit your request.</small>}</form>{managedTeamIds.length > 0 && <div className="cpl-review-section"><h4>Requests for your team(s)</h4>{pendingSquadRequests.filter((q: any) => managedTeamIds.includes(q.team_id)).map((q: any) => <article className="cpl-review-card" key={q.id}><strong>{q.full_name}</strong><p>{q.cpl_teams?.name || "Team"} · {q.position || "Position not specified"} · Free for this season</p><div className="cpl-review-actions"><button disabled={saving} onClick={() => void reviewSquadRequest(q.id, "approved")}>Approve player</button><button className="secondary" disabled={saving} onClick={() => void reviewSquadRequest(q.id, "rejected")}>Reject</button></div></article>)}{pendingSquadRequests.filter((q: any) => managedTeamIds.includes(q.team_id)).length === 0 && <p>No pending requests for your teams.</p>}</div>}</>}
      {tab === "transfers" && <><h3>Request a player transfer</h3><p>Choose a registered player. The player must consent, the releasing and receiving team managers must approve, and the chairman makes the final decision. The roster does not change while the transfer is pending. Current window: {seasonSettings.transfers_open ? "OPEN" : "CLOSED"}.</p><form className="cpl-form" onSubmit={submitTransfer}><label>Registered player<select required value={transferForm.player_id} onChange={e => setTransferForm(v => ({ ...v, player_id: e.target.value }))}><option value="">Select registered player</option>{players.filter(p => p.team_id).map(p => <option key={p.player_id} value={p.player_id}>{p.full_name} · {p.team_name || "Team"} · {p.player_id}</option>)}</select></label><label>Requested new team<select required value={transferForm.to_team} onChange={e => setTransferForm(v => ({ ...v, to_team: e.target.value }))}><option value="">Select destination</option>{teams.filter(t => t.id !== players.find(p => p.player_id === transferForm.player_id)?.team_id && t.participation_status !== "retired" && t.participation_status !== "suspended").map(t => <option key={t.id} value={t.id}>{t.name} · League {t.league}</option>)}</select></label><label>Reason (optional)<textarea value={transferForm.reason} onChange={e => setTransferForm(v => ({ ...v, reason: e.target.value }))} rows={3} /></label><button disabled={saving || !user || !seasonSettings.transfers_open}>{saving ? "Submitting…" : seasonSettings.transfers_open ? "Submit transfer request" : "Transfer window closed"}</button></form><div className="cpl-review-section"><h4>Transfer requests visible to your account ({myTransfers.length})</h4>{myTransfers.length ? myTransfers.map((t: any) => <article className="cpl-review-card" key={t.id}><strong>{t.player_name}</strong><p>Status: {t.status} · Player consent: {t.player_approved ? "Yes" : "Pending"} · Releasing team: {t.releasing_team_approved ? "Approved" : "Pending"} · Receiving team: {t.receiving_team_approved ? "Approved" : "Pending"}</p><p>{t.reason || "No reason supplied"}</p>{t.player_uid === user?.uid && !t.player_approved && <button disabled={saving} onClick={() => void approvePlayerTransfer(t.id)}>I approve this transfer</button>}{((managedTeamIds.includes(t.from_team_id) && !t.releasing_team_approved) || (managedTeamIds.includes(t.to_team_id) && !t.receiving_team_approved)) && <><button disabled={saving} onClick={() => void approveTeamTransfer(t.id, "approved")}>Approve as team manager</button><button className="secondary" disabled={saving} onClick={() => void approveTeamTransfer(t.id, "rejected")}>Reject transfer</button></>}</article>) : <p>No transfer requests are visible to this account.</p>}</div></>}
      {tab === "approvals" && isChairman && <><div className="cpl-review-section"><h3>Assign CPL profile roles</h3><p>Use the Firebase UID of the person's existing Chuka Comrades account. One user can hold multiple roles.</p><form className="cpl-form" onSubmit={assignProfileRole}><label>Firebase UID<input required value={roleForm.firebase_uid} onChange={e => setRoleForm(v => ({ ...v, firebase_uid: e.target.value }))} /></label><label>Role<select value={roleForm.role} onChange={e => setRoleForm(v => ({ ...v, role: e.target.value }))}><option value="fan">Fan</option><option value="player">Player</option><option value="team_manager">Team Manager</option><option value="referee">Referee</option><option value="secretary">Secretary</option><option value="chairman">Chairman</option><option value="initial_admin">Initial administrator (display-only)</option></select></label>{roleForm.role === "team_manager" && <label>Authorized team<select value={roleForm.team_id} onChange={e => setRoleForm(v => ({ ...v, team_id: e.target.value }))}><option value="">Choose team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}<button disabled={saving}>{saving ? "Saving…" : "Assign role"}</button></form></div><h3>Chairman review queue</h3><p>Review submitted reports, transfer decisions and squad requests. Approval actions are restricted to the configured CPL administrator until ownership is transferred.</p><div className="cpl-review-section"><h4>Match reports awaiting decision ({pendingReports.length})</h4>{pendingReports.length ? pendingReports.map((r: any) => <article className="cpl-review-card" key={r.id}><strong>{r.cpl_fixtures?.home_team ?? "Home"} {r.home_score} – {r.away_score} {r.cpl_fixtures?.away_team ?? "Away"}</strong><p>Submitted by {r.submitted_by_email || "referee"} · {r.status}</p><p>{r.event_notes || "No additional notes"}</p><div className="cpl-review-actions"><button onClick={() => void reviewRecord("cpl_match_reports", r.id, { status: "approved", reviewed_by_email: user?.email, reviewed_at: new Date().toISOString() }, "Report approved. The database has recorded the official result and recalculated league standings.")}>Approve report</button><button className="secondary" onClick={() => void reviewRecord("cpl_match_reports", r.id, { status: "returned_for_correction" }, "Report returned for correction.")}>Return for correction</button></div></article>) : <p>No pending match reports.</p>}</div><div className="cpl-review-section"><h4>Transfer requests awaiting decision ({pendingTransfers.length})</h4>{pendingTransfers.length ? pendingTransfers.map((t: any) => <article className="cpl-review-card" key={t.id}><strong>{t.player_name}</strong><p>Request status: {t.status} · Player approval: {t.player_approved ? "Yes" : "No"} · Releasing team: {t.releasing_team_approved ? "Yes" : "No"} · Receiving team: {t.receiving_team_approved ? "Yes" : "No"}</p><p>{t.reason || "No reason supplied"}</p><div className="cpl-review-actions"><button disabled={!t.player_approved || !t.releasing_team_approved || !t.receiving_team_approved} onClick={() => void reviewRecord("cpl_transfer_requests", t.id, { chairman_status: "approved", chairman_approved_by: user?.email, chairman_approved_at: new Date().toISOString(), status: "approved" }, "Transfer approved. The registered player was moved to the receiving team after all approvals.")}>Final approve</button><button className="secondary" onClick={() => void reviewRecord("cpl_transfer_requests", t.id, { chairman_status: "rejected", status: "rejected" }, "Transfer rejected.")}>Reject</button></div></article>) : <p>No pending transfer requests.</p>}</div><div className="cpl-review-section"><h4>Squad requests ({pendingSquadRequests.length})</h4>{pendingSquadRequests.length ? pendingSquadRequests.map((q: any) => <article className="cpl-review-card" key={q.id}><strong>{q.full_name}</strong><p>{q.cpl_teams?.name || "Team"} · {q.position || "Position not specified"} · Free registration</p><p>{q.status} · Free current-season squad joining</p><div className="cpl-review-actions"><button onClick={() => void reviewSquadRequest(q.id, "approved")}>Approve</button><button className="secondary" onClick={() => void reviewSquadRequest(q.id, "rejected")}>Reject</button></div></article>) : <p>No pending squad requests.</p>}</div><div className="cpl-review-section"><h4>Current season</h4><div className="cpl-form"><label>Make a configured season current<select value={seasonToActivate} onChange={e => setSeasonToActivate(e.target.value)}>{availableSeasons.map((s: any) => <option key={s.season} value={s.season}>{s.name || s.season}</option>)}</select></label><button type="button" disabled={saving || seasonToActivate === currentSeason} onClick={() => void activateSeason()}>Set current season</button></div><form className="cpl-form" onSubmit={createSeason}><h4>Create a new season</h4><label>Season code<input required value={newSeasonForm.season} onChange={e => setNewSeasonForm(v => ({ ...v, season: e.target.value }))} /></label><label>Display name<input required value={newSeasonForm.name} onChange={e => setNewSeasonForm(v => ({ ...v, name: e.target.value }))} /></label><label>Starting stage<select value={newSeasonForm.current_leg} onChange={e => setNewSeasonForm(v => ({ ...v, current_leg: e.target.value }))}><option value="first_leg">First leg</option><option value="second_leg">Second leg</option><option value="playoffs">Playoffs</option><option value="completed">Completed</option></select></label><label><input type="checkbox" checked={newSeasonForm.make_current} onChange={e => setNewSeasonForm(v => ({ ...v, make_current: e.target.checked }))} /> Make this season current immediately</label><button disabled={saving}>{saving ? "Saving…" : "Create season"}</button></form></div><div className="cpl-review-section"><h4>Add an official fixture · {currentSeason}</h4><form className="cpl-form" onSubmit={addFixture}><label>Home team<select required value={newFixture.home_team_id} onChange={e => setNewFixture(v => ({ ...v, home_team_id: e.target.value }))}><option value="">Select home team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name} · League {t.league}</option>)}</select></label><label>Away team<select required value={newFixture.away_team_id} onChange={e => setNewFixture(v => ({ ...v, away_team_id: e.target.value }))}><option value="">Select away team</option>{teams.filter(t => t.id !== newFixture.home_team_id).map(t => <option key={t.id} value={t.id}>{t.name} · League {t.league}</option>)}</select></label><label>Match date and time (optional)<input type="datetime-local" value={newFixture.match_date} onChange={e => setNewFixture(v => ({ ...v, match_date: e.target.value }))} /></label><label>Venue (optional)<input value={newFixture.venue} onChange={e => setNewFixture(v => ({ ...v, venue: e.target.value }))} /></label><label>Competition<select value={newFixture.competition} onChange={e => setNewFixture(v => ({ ...v, competition: e.target.value }))}><option value="League">League</option><option value="CPL Cup">CPL Cup</option></select></label><button disabled={saving || teams.length < 2}>{saving ? "Saving…" : "Add scheduled fixture"}</button></form></div><div className="cpl-review-section"><h4>Season rules · {seasonSettings.season}</h4><form className="cpl-form" onSubmit={saveSeasonSettings}><label>Current leg<select value={seasonSettings.current_leg} onChange={e => setSeasonSettings(v => ({ ...v, current_leg: e.target.value }))}><option value="first_leg">First leg</option><option value="second_leg">Second leg</option><option value="playoffs">Playoffs</option><option value="completed">Completed</option></select></label><label>Transfer window<select value={seasonSettings.transfers_open ? "open" : "closed"} onChange={e => setSeasonSettings(v => ({ ...v, transfers_open: e.target.value === "open" }))}><option value="closed">Closed — no new transfers</option><option value="open">Open — allow transfer requests</option></select></label><label>Match-card fee (KSh)<input type="number" min="0" value={seasonSettings.match_card_fee} onChange={e => setSeasonSettings(v => ({ ...v, match_card_fee: Number(e.target.value) }))} /></label><label>Team referee expense per match (KSh)<input type="number" min="0" value={seasonSettings.referee_fee_per_team_match} onChange={e => setSeasonSettings(v => ({ ...v, referee_fee_per_team_match: Number(e.target.value) }))} /></label><div className="cpl-score-inputs"><label>Points for win<input type="number" min="0" value={seasonSettings.points_win} onChange={e => setSeasonSettings(v => ({ ...v, points_win: Number(e.target.value) }))} /></label><label>Points for draw<input type="number" min="0" value={seasonSettings.points_draw} onChange={e => setSeasonSettings(v => ({ ...v, points_draw: Number(e.target.value) }))} /></label><label>Points for loss<input type="number" min="0" value={seasonSettings.points_loss} onChange={e => setSeasonSettings(v => ({ ...v, points_loss: Number(e.target.value) }))} /></label></div><button disabled={saving}>{saving ? "Saving…" : "Save season rules"}</button></form></div><div className="cpl-review-section"><h4>Assign a team manager</h4><form className="cpl-form" onSubmit={assignTeamManager}><label>Team<select required value={managerForm.team_id} onChange={e => setManagerForm(v => ({ ...v, team_id: e.target.value }))}><option value="">Select team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name} · League {t.league}</option>)}</select></label><label>Manager Firebase UID<input required value={managerForm.manager_uid} onChange={e => setManagerForm(v => ({ ...v, manager_uid: e.target.value }))} /></label><label>Manager full name<input value={managerForm.manager_name} onChange={e => setManagerForm(v => ({ ...v, manager_name: e.target.value }))} /></label><label>Manager email (optional)<input type="email" value={managerForm.manager_email} onChange={e => setManagerForm(v => ({ ...v, manager_email: e.target.value }))} /></label><button disabled={saving}>{saving ? "Saving…" : "Assign team manager"}</button></form></div><div className="cpl-review-section"><h4>Assign a referee</h4><form className="cpl-form" onSubmit={assignReferee}><label>Fixture<select required value={refereeForm.fixture_id} onChange={e => setRefereeForm(v => ({ ...v, fixture_id: e.target.value }))}><option value="">Select fixture</option>{fixtures.map(f => <option key={f.id} value={f.id}>{f.home_team} vs {f.away_team} · {f.match_date || "Date TBC"}</option>)}</select></label><label>Referee Firebase UID<input required value={refereeForm.referee_uid} onChange={e => setRefereeForm(v => ({ ...v, referee_uid: e.target.value }))} /></label><label>Referee full name<input value={refereeForm.referee_name} onChange={e => setRefereeForm(v => ({ ...v, referee_name: e.target.value }))} /></label><button disabled={saving}>{saving ? "Saving…" : "Assign referee"}</button></form></div><div className="cpl-review-section"><h4>Chairman ownership transfer</h4>{isChairman && <form className="cpl-form" onSubmit={requestOwnershipTransfer}><p>Enter the Firebase UID of the new chairman's existing Chuka Comrades account. The new chairman must sign in and accept before permissions transfer.</p><label>New chairman Firebase UID<input value={ownerUid} onChange={e => setOwnerUid(e.target.value)} required /></label><label>Account email (for the audit record, optional)<input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} /></label><button disabled={saving}>{saving ? "Submitting…" : "Request ownership transfer"}</button></form>}{ownershipTransfers.length ? ownershipTransfers.map((x: any) => <article className="cpl-review-card" key={x.id}><strong>Pending ownership transfer</strong><p>Requested for {x.proposed_owner_email || "the selected account"} · {new Date(x.requested_at).toLocaleString()}</p>{x.proposed_owner_uid === user?.uid && <button disabled={saving} onClick={() => void acceptOwnershipTransfer(x.id)}>{saving ? "Saving…" : "Accept chairman ownership"}</button>}</article>) : <p>No pending ownership transfer requests visible to this account.</p>}</div></>}
      {tab === "tournaments" && <>
        <h3>Current tournaments</h3><p>Only active tournaments are listed. Each tournament has an expiry date; expired records are removed by the scheduled cleanup process.</p>
        {tournaments.length ? <div className="feature-grid">{tournaments.map((t: any) => <article className="feature-card" key={t.id}>{t.image_url && <img className="cpl-tournament-image" src={t.image_url} alt={`${t.title} tournament poster`} loading="lazy" />}<h4>{t.title}</h4>{t.description && <p>{t.description}</p>}<small>Expires {new Date(t.expires_at).toLocaleString()}</small></article>)}</div> : <p className="cpl-muted">No active tournaments published.</p>}
        <div className="cpl-review-section"><h3>Payment instructions</h3><p>Use only the official details shown here. Confirm the till or Paybill number with CPL officials before making a payment.</p><div className="cpl-payment-panel"><p><strong>Account:</strong> {paymentSettings.account_name || "Chuka Premier League"}</p><p><strong>M-PESA Till number:</strong> {paymentSettings.till_number || "Not configured by the chairman yet"}</p><p><strong>Paybill number:</strong> {paymentSettings.paybill_number || "Not configured"}</p><p><strong>Account/reference:</strong> {paymentSettings.account_reference || "CPL"}</p>{paymentSettings.payment_instructions && <p>{paymentSettings.payment_instructions}</p>}</div>
        {isChairman && <form className="cpl-form" onSubmit={savePaymentSettings}><h4>Configure official payment details</h4><label>Till number<input value={paymentSettings.till_number || ""} onChange={e => setPaymentSettings((v: any) => ({ ...v, till_number: e.target.value }))} placeholder="Enter verified M-PESA till number" /></label><label>Paybill number (optional)<input value={paymentSettings.paybill_number || ""} onChange={e => setPaymentSettings((v: any) => ({ ...v, paybill_number: e.target.value }))} /></label><label>Account/reference<input value={paymentSettings.account_reference || "CPL"} onChange={e => setPaymentSettings((v: any) => ({ ...v, account_reference: e.target.value }))} /></label><label>Account name<input value={paymentSettings.account_name || "Chuka Premier League"} onChange={e => setPaymentSettings((v: any) => ({ ...v, account_name: e.target.value }))} /></label><label>Instructions<textarea rows={3} value={paymentSettings.payment_instructions || ""} onChange={e => setPaymentSettings((v: any) => ({ ...v, payment_instructions: e.target.value }))} placeholder="What reference should the payer enter?" /></label><button disabled={saving}>{saving ? "Saving…" : "Save payment details"}</button></form>}</div>
        {isChairman && <div className="cpl-review-section"><h3>Create tournament</h3><p>Upload a poster (JPG, PNG or WebP, max 5 MB), set an expiry date and time. Public display stops after expiry.</p><form className="cpl-form" onSubmit={createTournament}><label>Tournament name<input required value={tournamentForm.title} onChange={e => setTournamentForm(v => ({ ...v, title: e.target.value }))} /></label><label>Description<textarea rows={3} value={tournamentForm.description} onChange={e => setTournamentForm(v => ({ ...v, description: e.target.value }))} /></label><label>Starts at (optional)<input type="datetime-local" value={tournamentForm.starts_at} onChange={e => setTournamentForm(v => ({ ...v, starts_at: e.target.value }))} /></label><label>Expires at<input required type="datetime-local" value={tournamentForm.expires_at} onChange={e => setTournamentForm(v => ({ ...v, expires_at: e.target.value }))} /></label><label>Tournament poster<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setTournamentImage(e.target.files?.[0] ?? null)} /></label>{tournamentImage && <small>Selected: {tournamentImage.name}</small>}<button disabled={saving}>{saving ? "Publishing…" : "Publish tournament"}</button></form></div>}
      </>}
      {tab === "reports" && <><h3>Referee match report</h3><p>Assigned referees can submit a score and match details. Reports remain pending until the chairman approves them.</p><form className="cpl-form" onSubmit={submitReport}><label>Fixture<select required value={reportForm.fixture_id} onChange={e => setReportForm(v => ({ ...v, fixture_id: e.target.value }))}><option value="">Select fixture</option>{fixtures.filter(f => assignedFixtureIds.includes(f.id)).map(f => <option key={f.id} value={f.id}>{f.home_team} vs {f.away_team} · {f.match_date || "Date TBC"}</option>)}</select></label>{assignedFixtureIds.length === 0 && <small>The chairman must assign a fixture to your referee account before you can submit a report.</small>}<div className="cpl-score-inputs"><label>Home score<input required type="number" min="0" value={reportForm.home_score} onChange={e => setReportForm(v => ({ ...v, home_score: e.target.value }))} /></label><label>Away score<input required type="number" min="0" value={reportForm.away_score} onChange={e => setReportForm(v => ({ ...v, away_score: e.target.value }))} /></label></div><label>Goalscorers, cards, substitutions and incident notes<textarea rows={4} value={reportForm.goals_cards_notes} onChange={e => setReportForm(v => ({ ...v, goals_cards_notes: e.target.value }))} placeholder="Enter match events and relevant notes" /></label><button disabled={saving || !user}>{saving ? "Submitting…" : "Submit for chairman approval"}</button></form></>}
    </>}
    </>}
    <p className="cpl-footer-note">CPL is part of Chuka Comrades. Your existing sign-in is reused. Only chairman-approved results affect official standings. {isAdmin ? "Admin changes are recorded in the CPL data store." : "Public records show only approved league information."}</p>
  </section>;
}
