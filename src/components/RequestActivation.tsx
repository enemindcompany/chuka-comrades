import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getPaidRequestPayments, submitPaidRequestPayment, type PaidRequestPayment } from "../lib/communityApi";
import PaymentInstructions from "./PaymentInstructions";

export default function RequestActivation() {
  const [mine, setMine] = useState<PaidRequestPayment[]>([]);
  const [publicRequests, setPublicRequests] = useState<PaidRequestPayment[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const result = await getPaidRequestPayments(); setMine(result.requests.filter((item) => item.request_type === "general")); setPublicRequests(result.publicRequests); } catch (e) { setError(e instanceof Error ? e.message : "Could not load requests."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const pending = mine.find((item) => item.status === "pending");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); setNotice(""); try { const request = await submitPaidRequestPayment({ request_type: "general", payment_reference: reference.trim().toUpperCase(), request_title: title.trim(), request_details: details.trim() }); setMine((current) => [request, ...current]); setTitle(""); setDetails(""); setReference(""); setNotice("Your request and KSh 10 payment reference were submitted. An admin will verify the payment before activating it."); } catch (e) { setError(e instanceof Error ? e.message : "Could not submit request."); } finally { setSaving(false); } }
  return <section className="feature-page request-activation-page"><div className="homepage-heading"><span className="eyebrow">COMMUNITY REQUEST BOARD</span><h1>Make a request</h1><p>Submit a request to the community. A KSh 10 activation fee is verified manually before the request is published.</p></div>
    <section className="request-activation-card"><div><span className="eyebrow">REQUEST ACTIVATION</span><h2>KSh 10 per request</h2><p>{pending ? "You already have a request awaiting payment verification." : "Write a clear request, pay the activation fee and enter the M-Pesa transaction code."}</p></div><PaymentInstructions amount={10} purpose="Community request activation" />
      {!pending && <form className="profile-editor request-activation-form" onSubmit={(event) => void submit(event)}><label className="form-field"><span>Request title *</span><input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What do you need?" /></label><label className="form-field"><span>Request details *</span><textarea required minLength={5} maxLength={1200} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explain what you are looking for and any useful details." /></label><label className="form-field"><span>M-Pesa transaction code *</span><input required minLength={4} maxLength={80} value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="Enter the M-Pesa code" /></label><button className="button button-primary" disabled={saving}>{saving ? "Submitting…" : "Submit request · KSh 10"}</button></form>}
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    <section className="request-history"><div className="section-heading"><div><span className="eyebrow">YOUR REQUESTS</span><h2>Request status</h2></div><button className="button button-outline" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div>{loading ? <p>Loading requests…</p> : mine.length === 0 ? <p className="home-empty-note">You have not submitted a request yet.</p> : mine.map((item) => <article className="request-history-item" key={item.id}><div><h3>{item.request_title}</h3><p>{item.request_details}</p><small>M-Pesa code: {item.payment_reference}</small></div><span className={`status-pill status-${item.status === "approved" ? "active" : item.status === "rejected" ? "rejected" : "pending"}`}>{item.status === "approved" ? "Activated" : item.status === "rejected" ? "Payment rejected" : "Awaiting verification"}</span></article>)}</section>
    <section className="request-history"><div className="section-heading"><div><span className="eyebrow">COMMUNITY BOARD</span><h2>Activated requests</h2></div></div>{publicRequests.length === 0 ? <p className="home-empty-note">No activated requests have been published yet.</p> : publicRequests.map((item) => <article className="request-history-item" key={item.id}><div><h3>{item.request_title}</h3><p>{item.request_details}</p></div><small>{new Date(item.created_at).toLocaleDateString()}</small></article>)}</section>
  </section>;
}
