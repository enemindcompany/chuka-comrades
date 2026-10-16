import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getActivation, submitActivationPayment, type ActivationAccount } from "../lib/activationApi";
import { createOpportunity, getOpportunities, type Opportunity, type OpportunityCategory } from "../lib/opportunityApi";

const categories: OpportunityCategory[] = ["Referral links", "WhatsApp groups", "Online jobs", "Scholarships & bursaries", "Attachments & internships", "Skill learning", "Other"];
const blank = { title: "", category: "Online jobs" as OpportunityCategory, description: "", link_url: "", deadline: "", contact: "" };
const mpesaTill = String(import.meta.env.VITE_MPESA_TILL ?? "").trim();
const mpesaPaybill = String(import.meta.env.VITE_MPESA_PAYBILL ?? "").trim();
const mpesaAccount = String(import.meta.env.VITE_MPESA_ACCOUNT ?? "").trim();

export default function Opportunities() {
  const [activation, setActivation] = useState<ActivationAccount | null>(null);
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [draft, setDraft] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("All");
  const hasAccess = activation?.status === "active";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [account, opportunities] = await Promise.all([getActivation(), getOpportunities()]); setActivation(account); setItems(opportunities); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load opportunities."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function payForAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { const account = await submitActivationPayment(paymentReference); setActivation(account); setNotice("M-Pesa reference submitted. Full Opportunities access will unlock after an administrator verifies the payment."); setPaymentReference(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not submit payment reference."); }
    finally { setSaving(false); }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await createOpportunity({ title: draft.title.trim(), category: draft.category, description: draft.description.trim(), link_url: draft.link_url.trim(), deadline: draft.deadline || null, contact: draft.contact.trim() || null });
      setDraft(blank); setShowForm(false); setNotice("Opportunity submitted successfully."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not publish this opportunity."); }
    finally { setSaving(false); }
  }
  const visible = items.filter((item) => filter === "All" || item.category === filter);

  return <section className="opportunities-page">
    <div className="homepage-heading"><h1>Opportunities 🎓</h1><p>Pay once to unlock full opportunity details, application links and contacts. Share useful leads with other comrades.</p></div>
    <section className="activation-card">
      <div><span className="eyebrow">ONE-TIME PAGE ACCESS</span><h2>Opportunities access · KSh 100</h2>
        <p>{hasAccess ? "Your one-time payment is approved. You have permanent access to full opportunity details." : activation?.status === "pending" ? "Your M-Pesa reference is awaiting administrator verification. Access will unlock once approved." : activation?.status === "rejected" ? "Your last payment was not approved. Check the M-Pesa code and submit it again." : "Pay KSh 100 once to unlock full descriptions, application links, and contact details permanently."}</p>
        {hasAccess && <span className="status-pill status-active">Permanent access active</span>}
        {activation?.status === "pending" && <span className="status-pill status-pending">Payment under review</span>}
      </div>
      {!hasAccess && activation?.status !== "pending" && <form className="activation-payment-form" onSubmit={(e) => void payForAccess(e)}>
        <label className="form-field"><span>M-Pesa transaction code *</span><input required minLength={4} maxLength={80} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value.toUpperCase())} placeholder="e.g. QWE123ABC" /></label>
        <p className="small-note">Pay KSh 100 to the official Chuka Comrades M-Pesa details, then submit your transaction code. An admin checks the payment manually.</p>
        {(mpesaTill || mpesaPaybill) && <p className="payment-instructions">{mpesaTill ? `M-Pesa Buy Goods Till: ${mpesaTill}` : `M-Pesa Paybill: ${mpesaPaybill}`}{mpesaPaybill && mpesaAccount ? ` · Account: ${mpesaAccount}` : ""}</p>}
        <button className="button button-primary" disabled={saving}>{saving ? "Submitting…" : "Submit KSh 100 payment reference"}</button>
      </form>}
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    <div className="opportunities-toolbar"><label className="form-field"><span>Filter opportunities</span><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><button className="button button-primary" onClick={() => { setShowForm((v) => !v); setError(""); }}>{showForm ? "Close form" : "+ Share opportunity"}</button></div>
    {showForm && <form className="profile-editor opportunity-editor" onSubmit={(e) => void publish(e)}>
      <h2>Share an opportunity</h2>
      <label className="form-field"><span>Title *</span><input required minLength={3} maxLength={140} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Remote customer support jobs" /></label>
      <label className="form-field"><span>Category *</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as OpportunityCategory })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="form-field opportunity-wide"><span>Details *</span><textarea required minLength={10} maxLength={3000} rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Eligibility, skills needed, how to apply, and important details" /></label>
      <label className="form-field opportunity-wide"><span>Application / referral / WhatsApp link *</span><input required type="url" maxLength={1500} value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://..." /></label>
      <label className="form-field"><span>Deadline (optional)</span><input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></label>
      <label className="form-field"><span>Contact (optional)</span><input maxLength={150} value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="Email or phone" /></label>
      <div className="opportunity-wide"><button className="button button-primary" disabled={saving}>{saving ? "Submitting…" : "Share opportunity"}</button></div>
    </form>}
    <div className="opportunity-list-heading"><h2>Latest opportunities</h2><span>{visible.length} listed</span></div>
    {loading ? <p className="loading-card">Loading opportunities…</p> : visible.length === 0 ? <div className="empty-state"><h3>No opportunities here yet</h3><p>Be the first to share a useful lead.</p></div> : <div className="opportunity-grid">{visible.map((item) => <article className="opportunity-card" key={item.id}><span className="opportunity-category">{item.category}</span><h3>{item.title}</h3><p>{hasAccess ? item.description : "🔒 Pay the one-time KSh 100 access fee to read the full description and application instructions."}</p>{hasAccess && item.deadline && <p className="small-note">Deadline: {item.deadline}</p>}{hasAccess && item.contact && <p className="small-note">Contact: {item.contact}</p>}<div className="opportunity-card-footer"><span>Shared by {item.author_name}</span>{hasAccess ? <a className="button button-primary" href={item.link_url} target="_blank" rel="noopener noreferrer">Open opportunity ↗</a> : <span className="small-note">Link available after approval</span>}</div></article>)}</div>}
    <p className="small-note opportunity-safety-note">Verify the organisation and details before sending money or personal documents. Chuka Comrades does not guarantee third-party offers.</p>
  </section>;
}
