import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getHookupPageData, saveHookupProfile, submitHookupPayment, type HookupProfile, type HookupSubscription } from "../lib/communityApi";

const mpesaTill = String(import.meta.env.VITE_MPESA_TILL ?? "").trim() || "6817863";
const mpesaPaybill = String(import.meta.env.VITE_MPESA_PAYBILL ?? "").trim();
const mpesaAccount = String(import.meta.env.VITE_MPESA_ACCOUNT ?? "").trim();
type Gender = HookupProfile["gender"];
type LookingFor = HookupProfile["looking_for"];
type ProfileDraft = Omit<HookupProfile, "firebase_uid" | "updated_at">;
const blankProfile: ProfileDraft = { display_name: "", age: 18, gender: "Prefer not to say", looking_for: "Everyone", preferred_age_min: 18, preferred_age_max: 99, preferred_area: "Ndagani", interests: "", about: "" };
function genderMatches(preference: LookingFor, gender: Gender) {
  if (preference === "Everyone") return true;
  if (preference === "Women") return gender === "Woman";
  return gender === "Man";
}

export default function AnonymousCommunity() {
  const [subscription, setSubscription] = useState<HookupSubscription | null>(null);
  const [ownProfile, setOwnProfile] = useState<HookupProfile | null>(null);
  const [profiles, setProfiles] = useState<HookupProfile[]>([]);
  const [draft, setDraft] = useState<ProfileDraft>(blankProfile);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [genderFilter, setGenderFilter] = useState("All genders");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await getHookupPageData();
      setSubscription(data.subscription); setOwnProfile(data.ownProfile); setProfiles(data.profiles);
      if (data.ownProfile) setDraft({ display_name: data.ownProfile.display_name, age: data.ownProfile.age, gender: data.ownProfile.gender, looking_for: data.ownProfile.looking_for, preferred_age_min: data.ownProfile.preferred_age_min, preferred_age_max: data.ownProfile.preferred_age_max, preferred_area: data.ownProfile.preferred_area, interests: data.ownProfile.interests ?? "", about: data.ownProfile.about ?? "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load Hookup access."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const active = subscription?.status === "active" && !!subscription.expires_at && new Date(subscription.expires_at) > new Date();

  async function submitPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { const result = await submitHookupPayment(reference); setSubscription(result); setReference(""); setNotice("M-Pesa reference submitted. Hookup access will activate after admin verification."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not submit payment."); }
    finally { setSaving(false); }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    if (draft.age < 18 || draft.preferred_age_min < 18 || draft.preferred_age_max < draft.preferred_age_min || draft.preferred_age_max > 99) { setError("Hookup is for adults aged 18+. Check your age and preferred age range."); setSaving(false); return; }
    try { const saved = await saveHookupProfile({ ...draft, display_name: draft.display_name.trim(), preferred_area: draft.preferred_area.trim(), interests: draft.interests.trim(), about: draft.about.trim() }); setOwnProfile(saved); setNotice("Your Hookup profile and preferences have been saved."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save your Hookup profile."); }
    finally { setSaving(false); }
  }
  const matchingProfiles = useMemo(() => profiles.filter(p => {
    const ageFits = p.age >= draft.preferred_age_min && p.age <= draft.preferred_age_max && p.preferred_age_min <= draft.age && p.preferred_age_max >= draft.age;
    const genderFits = genderMatches(draft.looking_for, p.gender);
    const preferenceFits = !ownProfile || genderMatches(p.looking_for, ownProfile.gender);
    return !!ownProfile && ageFits && genderFits && preferenceFits && (genderFilter === "All genders" || p.gender === genderFilter);
  }), [profiles, draft.preferred_age_min, draft.preferred_age_max, draft.looking_for, ownProfile, genderFilter]);

  return <section className="feature-page">
    <div className="homepage-heading"><span className="eyebrow">WEEKLY ACCESS</span><h1>ðŸ’— Hookup</h1><p>Create a profile, choose who you would like to meet, and browse compatible adult profiles. Hookup is separate from Hostels & Roommates.</p></div>
    <section className="activation-card"><div><span className="eyebrow">HOOKUP PAGE ACCESS</span><h2>KSh 50 Â· 7 days</h2><p>{loading ? "Checking your accessâ€¦" : active ? `Your Hookup access is active until ${new Date(subscription!.expires_at!).toLocaleString()}.` : subscription?.status === "pending" ? "Your M-Pesa reference is waiting for admin verification." : subscription?.status === "rejected" ? "Your previous payment was rejected. Check the M-Pesa code and submit it again." : "Submit a KSh 50 M-Pesa payment reference. Access starts only after an admin approves it and lasts seven days."}</p>{active && <span className="status-pill status-active">Access active</span>}{subscription?.status === "pending" && <span className="status-pill status-pending">Payment under review</span>}</div>
      {!active && subscription?.status !== "pending" && <form className="activation-payment-form" onSubmit={e => void submitPayment(e)}><label className="form-field"><span>M-Pesa transaction code *</span><input required minLength={4} maxLength={80} value={reference} onChange={e => setReference(e.target.value.toUpperCase())} placeholder="e.g. QWE123ABC" /></label><p className="small-note">Pay KSh 50 to the official Chuka Comrades M-Pesa details. An administrator will verify your transaction manually.</p>{(mpesaTill || mpesaPaybill) && <p className="payment-instructions">{mpesaTill ? `M-Pesa Buy Goods Till: ${mpesaTill}` : `M-Pesa Paybill: ${mpesaPaybill}`}{mpesaPaybill && mpesaAccount ? ` Â· Account: ${mpesaAccount}` : ""}</p>}<button className="button button-primary" disabled={saving || loading}>{saving ? "Submittingâ€¦" : "Submit KSh 50 payment reference"}</button></form>}
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {active && <>
      <section className="feature-card"><h2>{ownProfile ? "Update your weekly Hookup profile" : "Create your Hookup profile"}</h2><p>Only adults aged 18 or older can create a profile. Share only information you are comfortable with.</p>
        <form className="profile-editor opportunity-editor" onSubmit={e => void saveProfile(e)}>
          <label className="form-field"><span>Display name *</span><input required minLength={2} maxLength={80} value={draft.display_name} onChange={e => setDraft({ ...draft, display_name: e.target.value })} placeholder="Name or nickname" /></label>
          <label className="form-field"><span>Your age *</span><input required type="number" min={18} max={99} value={draft.age} onChange={e => setDraft({ ...draft, age: Number(e.target.value) })} /></label>
          <label className="form-field"><span>Gender *</span><select required value={draft.gender} onChange={e => setDraft({ ...draft, gender: e.target.value as Gender })}><option>Prefer not to say</option><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
          <label className="form-field"><span>Interested in *</span><select required value={draft.looking_for} onChange={e => setDraft({ ...draft, looking_for: e.target.value as LookingFor })}><option>Everyone</option><option>Women</option><option>Men</option></select></label>
          <label className="form-field"><span>Preferred minimum age *</span><input required type="number" min={18} max={99} value={draft.preferred_age_min} onChange={e => setDraft({ ...draft, preferred_age_min: Number(e.target.value) })} /></label>
          <label className="form-field"><span>Preferred maximum age *</span><input required type="number" min={18} max={99} value={draft.preferred_age_max} onChange={e => setDraft({ ...draft, preferred_age_max: Number(e.target.value) })} /></label>
          <label className="form-field"><span>Preferred area *</span><input required minLength={2} maxLength={100} value={draft.preferred_area} onChange={e => setDraft({ ...draft, preferred_area: e.target.value })} placeholder="e.g. Ndagani, Chuka town" /></label>
          <label className="form-field"><span>Interests (optional)</span><input maxLength={300} value={draft.interests} onChange={e => setDraft({ ...draft, interests: e.target.value })} placeholder="Music, football, movies, foodâ€¦" /></label>
          <label className="form-field opportunity-wide"><span>About you (optional)</span><textarea rows={3} maxLength={600} value={draft.about} onChange={e => setDraft({ ...draft, about: e.target.value })} placeholder="A short, respectful introduction" /></label>
          <div className="opportunity-wide"><button className="button button-primary" disabled={saving}>{saving ? "Saving profileâ€¦" : "Save Hookup profile & preferences"}</button></div>
        </form>
      </section>
      <div className="opportunity-list-heading"><h2>Compatible profiles</h2><span>{matchingProfiles.length} profiles</span></div>
      <label className="form-field"><span>Filter by gender</span><select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}><option>All genders</option><option>Woman</option><option>Man</option><option>Non-binary</option><option>Prefer not to say</option></select></label>
      {!ownProfile && <p className="small-note">Save your profile and preferences to help match people you are interested in.</p>}
      {matchingProfiles.length === 0 ? <p className="small-note">No compatible profiles yet. Try adjusting your preferences later.</p> : <div className="feature-grid">{matchingProfiles.map(p => <article className="feature-card" key={p.firebase_uid}><h3>{p.display_name}, {p.age}</h3><p>{p.gender} Â· {p.preferred_area}</p>{p.interests && <p><strong>Interests:</strong> {p.interests}</p>}{p.about && <p>{p.about}</p>}</article>)}</div>}
    </>}
    <div className="feature-card"><span className="feature-icon">ðŸ¤</span><h2>{active ? "Respectful connections" : "Respectful connections"}</h2><p>Be respectful, protect personal information, and make sure all interactions are consensual. Anonymous posting and anonymous messaging have been removed.</p></div>
  </section>;
}

