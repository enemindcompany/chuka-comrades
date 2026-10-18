import { useCallback, useEffect, useState, type FormEvent } from "react";
import { auth } from "../lib/firebase";
import { getPaidRequestPayments, submitPaidRequestPayment, type PaidRequestPayment } from "../lib/communityApi";
import PaymentInstructions from "./PaymentInstructions";
import { getRoommateProfiles, saveRoommateProfile, sendConnectionProposal, respondToConnectionProposal, type ConnectionProposal, type HousingStatus, type RoommateProfile } from "../lib/hostelApi";

type Draft = {
  display_name: string; course: string; year_of_study: string; gender: "Woman" | "Man" | "Non-binary" | "Prefer not to say"; housing_status: HousingStatus;
  preferred_area: string; monthly_budget_ksh: string; hostel_name: string; bio: string; contact_phone: string;
};
const emptyDraft: Draft = {
  display_name: "", course: "", year_of_study: "", gender: "Prefer not to say", housing_status: "looking",
  preferred_area: "Ndagani", monthly_budget_ksh: "5000", hostel_name: "", bio: "", contact_phone: "",
};

export default function RoommateFinder() {
  const [profiles, setProfiles] = useState<RoommateProfile[]>([]);
  const [proposals, setProposals] = useState<ConnectionProposal[]>([]);
  const [busyProposal, setBusyProposal] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<HousingStatus | "all">("all");
  const [genderFilter, setGenderFilter] = useState("All genders");
  const [paidRequests, setPaidRequests] = useState<PaidRequestPayment[]>([]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [hasOwnProfile, setHasOwnProfile] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [result, paymentResult] = await Promise.all([getRoommateProfiles(), getPaidRequestPayments()]);
      setPaidRequests(paymentResult.requests);
      setProfiles(result.profiles);
      setProposals(result.proposals);
      setHasOwnProfile(!!result.ownProfile);
      if (result.ownProfile) {
        const own = result.ownProfile;
        setDraft({ display_name: own.display_name, course: "", year_of_study: "", gender: own.gender ?? "Prefer not to say",
          housing_status: own.housing_status, preferred_area: own.preferred_area,
          monthly_budget_ksh: String(own.monthly_budget_ksh), hostel_name: own.hostel_name ?? "",
          bio: own.bio, contact_phone: own.contact_phone ?? "" });
      }
    }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load roommate profiles."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const budget = Number(draft.monthly_budget_ksh);
    if (!Number.isSafeInteger(budget) || budget < 0) { setError("Enter a valid monthly budget."); return; }
    setSaving(true);
    try {
      await saveRoommateProfile({ ...draft, course: "", year_of_study: "", monthly_budget_ksh: budget, hostel_name: draft.hostel_name.trim() || null });
      setNotice("Your profile is saved. Your phone number and extended details stay private until a connection proposal is accepted.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save your profile."); }
    finally { setSaving(false); }
  }

  async function submitRoommatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPaymentSaving(true); setError(""); setNotice("");
    try {
      const payment = await submitPaidRequestPayment({ request_type: "roommate_finder", payment_reference: paymentReference.trim().toUpperCase() });
      setPaidRequests((current) => [payment, ...current.filter((item) => item.id !== payment.id)]); setPaymentReference("");
      setNotice("KSh 100 reference submitted. Your roommate request can be published after admin verification.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit roommate payment."); }
    finally { setPaymentSaving(false); }
  }

  async function sendProposal(targetUid: string) {
    const confirmed = window.confirm("SAFETY & PRIVACY FIRST\n\nOnly send a proposal if you genuinely want to connect. Never share your password, M-PESA PIN, ID documents, live location, intimate images, or money with someone you just met. Meet in a public place, tell a trusted person, arrange your own transport, and leave if uncomfortable. Your phone number and extended profile details are shared only after the recipient accepts. Acceptance is not consent to anything beyond sharing contact details.\n\nDo you want to send this connection proposal?");
    if (!confirmed) return;
    setBusyProposal(targetUid); setError(""); setNotice("");
    try { await sendConnectionProposal(targetUid, true); setNotice("Proposal sent. Your contact details remain private unless they accept."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not send proposal."); }
    finally { setBusyProposal(""); }
  }

  async function respondProposal(id: string, decision: "accepted" | "declined") {
    const confirmed = window.confirm(decision === "accepted"
      ? "SAFETY REMINDER: Accepting shares your phone number and extended profile details with the other person. Only proceed if you consent. Meet publicly, tell a trusted person, and never send money or private documents. Accept this proposal?"
      : "Decline this proposal? The sender will not receive your contact details.");
    if (!confirmed) return;
    setBusyProposal(id); setError(""); setNotice("");
    try { await respondToConnectionProposal(id, decision, true); setNotice(decision === "accepted" ? "Proposal accepted. You can now view each other's contact details." : "Proposal declined. Contact details remain private."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not respond to proposal."); }
    finally { setBusyProposal(""); }
  }

  const currentUid = auth.currentUser?.uid ?? "";
  const roommatePayment = paidRequests.find((item) => item.request_type === "roommate_finder" && item.status === "pending") ?? paidRequests.find((item) => item.request_type === "roommate_finder" && item.status === "approved" && !item.used_at);
  const roommatePaymentReady = paidRequests.some((item) => item.request_type === "roommate_finder" && item.status === "approved" && !item.used_at);
  const visible = profiles.filter(p => (filter === "all" || p.housing_status === filter) && (genderFilter === "All genders" || p.gender === genderFilter));
  return <section className="roommate-panel">
    <div className="section-heading">
      <div><span className="eyebrow">FIND YOUR CAMPUS ROOMMATE</span><h2>Roommate finder 🤝</h2><p>Find a potential roommate or send a respectful connection proposal. Profiles are private by default: phone numbers, bios and hostel details are revealed only after the recipient accepts.</p></div>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}
    <section className="roommate-payment-card"><div><span className="eyebrow">ROOMMATE REQUEST ACTIVATION</span><h3>KSh 100 one-time request fee</h3><p>{hasOwnProfile ? "Your existing roommate profile can be updated without paying again." : roommatePayment?.status === "pending" ? "Your M-Pesa reference is awaiting admin verification." : roommatePaymentReady ? "Payment approved. You can now publish your roommate request." : "Pay and submit your M-Pesa reference. Your request will be publishable after admin verification."}</p>{roommatePayment?.status === "pending" && <span className="status-pill status-pending">Payment under review</span>}{roommatePaymentReady && <span className="status-pill status-active">Payment approved</span>}</div>
      <PaymentInstructions amount={100} purpose="Roommate finder request" />
      {!hasOwnProfile && !roommatePaymentReady && roommatePayment?.status !== "pending" && <form className="activation-payment-form" onSubmit={event => void submitRoommatePayment(event)}><label className="form-field"><span>M-Pesa transaction code *</span><input required minLength={4} maxLength={80} value={paymentReference} onChange={event => setPaymentReference(event.target.value.toUpperCase())} placeholder="Enter the M-Pesa code" /></label><button className="button button-primary" disabled={paymentSaving}>{paymentSaving ? "Submitting…" : "Submit KSh 100 payment reference"}</button></form>}
    </section>
    {(hasOwnProfile || roommatePaymentReady) && <form className="roommate-form" onSubmit={event => void submit(event)}>
      <label className="form-field"><span>Your name *</span><input value={draft.display_name} onChange={e => setDraft({...draft, display_name:e.target.value})} required minLength={2} maxLength={80} placeholder="Name students know you by" /></label>
      <label className="form-field"><span>Gender *</span><select value={draft.gender} onChange={e => setDraft({...draft, gender:e.target.value as Draft["gender"]})} required><option>Prefer not to say</option><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
      <label className="form-field"><span>Accommodation status *</span><select value={draft.housing_status} onChange={e => setDraft({...draft, housing_status:e.target.value as HousingStatus})}><option value="looking">I have not found a hostel yet</option><option value="have_hostel">I already have a hostel / room</option></select></label>
      <label className="form-field"><span>Hostel / room name (optional)</span><input value={draft.hostel_name} onChange={e => setDraft({...draft, hostel_name:e.target.value})} maxLength={100} placeholder="Hostel name or area, if known" /></label>
      <label className="form-field"><span>Preferred area *</span><input value={draft.preferred_area} onChange={e => setDraft({...draft, preferred_area:e.target.value})} required maxLength={100} placeholder="e.g. Ndagani, Chuka town" /></label>
      <label className="form-field"><span>Monthly budget (KSh) *</span><input type="number" min="0" max="100000" step="1" value={draft.monthly_budget_ksh} onChange={e => setDraft({...draft, monthly_budget_ksh:e.target.value})} required /></label>
      <label className="form-field"><span>Contact phone *</span><input value={draft.contact_phone} onChange={e => setDraft({...draft, contact_phone:e.target.value})} required minLength={9} maxLength={20} placeholder="07xx xxx xxx" /></label>
      <label className="form-field roommate-wide"><span>About you / what roommate you need</span><textarea value={draft.bio} onChange={e => setDraft({...draft, bio:e.target.value})} rows={3} maxLength={500} placeholder="Share your preferred move-in date, study habits, or room-sharing plans." /></label>
      <div className="roommate-wide roommate-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving profile..." : "Save / update my profile"}</button><span className="small-note">Privacy: your phone number is never shown on public cards. Extended details are shared only after both people agree by accepting a proposal. You can leave any interaction at any time.</span></div>
    </form>
    }
    <div className="roommate-list-heading"><div><h3>People open to connecting</h3><p>Send a proposal first. No one can see your phone number until they accept.</p></div><div className="roommate-filter-controls"><select aria-label="Filter roommate profiles by accommodation" value={filter} onChange={e => setFilter(e.target.value as HousingStatus | "all")}><option value="all">All profiles</option><option value="looking">Still looking</option><option value="have_hostel">Already have a hostel</option></select><select aria-label="Filter roommate profiles by gender" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}><option>All genders</option><option>Woman</option><option>Man</option><option>Non-binary</option><option>Prefer not to say</option></select></div></div>
    <div className="connection-safety-note"><strong>🛡️ Safety and privacy before connecting</strong><p>Keep phone numbers, hostel details and personal stories private until a proposal is accepted. Meet in public, tell a trusted person, use your own transport, never share PINs/passwords/ID documents or send money to strangers, and report pressure or harassment. An accepted proposal only permits contact sharing; it does not imply consent to a date, sex, or anything else.</p></div>
    {proposals.some(p => p.target_uid === currentUid && p.status === "pending") && <div className="connection-proposals"><h3>Incoming proposals</h3>{proposals.filter(p => p.target_uid === currentUid && p.status === "pending").map(proposal => { const sender = profiles.find(p => p.firebase_uid === proposal.requester_uid); return <div className="connection-proposal-row" key={proposal.id}><span><strong>{sender?.display_name ?? "A student"}</strong> wants to connect. Your contact details stay private until you accept.</span><span className="connection-proposal-actions"><button className="button button-primary" type="button" disabled={busyProposal === proposal.id} onClick={() => void respondProposal(proposal.id, "accepted")}>Accept</button><button className="button button-outline" type="button" disabled={busyProposal === proposal.id} onClick={() => void respondProposal(proposal.id, "declined")}>Decline</button></span></div>; })}</div>}
    {loading ? <p className="form-feedback">Loading roommate profiles...</p> : visible.length === 0 ? <div className="hostel-empty-state"><span>🤝</span><h3>No profiles yet</h3><p>Be the first to create a profile and help other students connect.</p></div> : <div className="roommate-grid">{visible.map(p => { return <article className="roommate-card" key={p.firebase_uid}><div className="roommate-card-top"><span className={`roommate-status ${p.housing_status}`}>{p.housing_status === "have_hostel" ? "Has a hostel" : "Still looking"}</span>{p.connected && <span className="roommate-budget">Up to KSh {p.monthly_budget_ksh.toLocaleString()}/mo</span>}</div><h3>{p.display_name}</h3><p className="roommate-meta">Gender: {p.gender || "Prefer not to say"}</p>{p.connected ? <><p><strong>Area:</strong> {p.preferred_area}</p><p><strong>Budget:</strong> Up to KSh {p.monthly_budget_ksh.toLocaleString()}/month</p><p><strong>Hostel:</strong> {p.hostel_name || "Not provided"}</p>{p.bio && <p className="roommate-bio">{p.bio}</p>}<div className="roommate-contact"><span>Contact: <strong>{p.contact_phone}</strong></span>{p.contact_phone && <a className="button button-outline" href={`tel:${p.contact_phone.replace(/[^+\d]/g, "")}`}>Call</a>}</div><p className="small-note">Connection accepted — contact details shared by mutual consent.</p></> : <><p className="small-note">🔒 Budget, area, bio, hostel details and phone number are private until proposal acceptance.</p>{(() => { const proposal = proposals.find(item => ((item.requester_uid === currentUid && item.target_uid === p.firebase_uid) || (item.requester_uid === p.firebase_uid && item.target_uid === currentUid)) && (item.status === "pending" || item.status === "accepted")); if (!proposal) return <button className="button button-primary" type="button" disabled={busyProposal === p.firebase_uid} onClick={() => void sendProposal(p.firebase_uid)}>{busyProposal === p.firebase_uid ? "Sending..." : "Send connection proposal"}</button>; if (proposal.status === "accepted") return <p className="small-note">Connected — refresh if details are not shown yet.</p>; return <p className="small-note">{proposal.target_uid === currentUid ? "This person sent you a proposal; review it above." : "Proposal sent — waiting for their response."}</p>; })()}</>}</article>; })}</div>}
  </section>;
}
