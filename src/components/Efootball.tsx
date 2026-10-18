import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createEfootballTournament, getEfootballData, registerEfootballPlayer, type EfootballPlayer, type EfootballTournament } from "../lib/communityApi";

const mpesaTill = String(import.meta.env.VITE_MPESA_TILL ?? "").trim() || "6817863";
const mpesaPaybill = String(import.meta.env.VITE_MPESA_PAYBILL ?? "").trim();
const mpesaAccount = String(import.meta.env.VITE_MPESA_ACCOUNT ?? "").trim();
function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

export default function Efootball() {
  const [players, setPlayers] = useState<EfootballPlayer[]>([]);
  const [tournaments, setTournaments] = useState<EfootballTournament[]>([]);
  const [own, setOwn] = useState<EfootballPlayer | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bio, setBio] = useState("");
  const [reference, setReference] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [tournamentForm, setTournamentForm] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [tournamentNumber, setTournamentNumber] = useState("");
  const [date, setDate] = useState("");
  const [contact, setContact] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await getEfootballData();
      setPlayers(data.players); setTournaments(data.tournaments); setOwn(data.ownPlayer); setHasAccess(data.hasAccess);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load eFootball."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function selectImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Choose a JPG, PNG or WEBP image up to 5 MB."); e.target.value = ""; setImage(null); return;
    }
    setError(""); setImage(file);
  }

  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!image) { setError("Upload your squad image first."); return; }
    if (whatsappDigits(whatsapp).length < 9) { setError("Enter a valid WhatsApp number."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(image);
      });
      const p = await registerEfootballPlayer({ player_name: name.trim(), whatsapp_number: whatsapp.trim(), bio: bio.trim(), payment_reference: reference.trim().toUpperCase(), squad_image_base64: dataUrl.split(",")[1] ?? "", squad_image_type: image.type });
      setOwn(p); setNotice("Player listing and KSh 20 payment reference submitted. Your details will appear after admin approval."); setReference(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit listing."); }
    finally { setSaving(false); }
  }

  async function makeTournament(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await createEfootballTournament({ title: title.trim(), details: details.trim(), tournament_number: tournamentNumber.trim(), event_date: date, contact: contact.trim() });
      setTitle(""); setDetails(""); setTournamentNumber(""); setDate(""); setContact(""); setTournamentForm(false); setNotice("Tournament published with its shareable tournament number."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create tournament."); }
    finally { setSaving(false); }
  }

  return <section className="feature-page">
    <div className="homepage-heading"><span className="eyebrow">PLAYER DIRECTORY & TOURNAMENTS</span><h1>Chuka eFootball âš½</h1><p>List your eFootball name and squad image, find opponents, share tournament numbers, and organize campus tournaments.</p></div>
    {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {!hasAccess && <section className="activation-card"><div><span className="eyebrow">ONE-TIME PLAYER LISTING</span><h2>KSh 20 listing fee</h2><p>{own?.payment_status === "pending" ? "Your listing payment is waiting for admin verification." : own?.payment_status === "rejected" ? "Your previous payment was rejected. Check the transaction code and resubmit." : "Pay KSh 20 once. After admin approval, your player name, squad image and WhatsApp contact will be listed, and you can access the player directory and tournament tools."}</p>{own?.payment_status === "pending" && <span className="status-pill status-pending">Payment under review</span>}</div>
      {own?.payment_status !== "pending" && <form className="activation-payment-form" onSubmit={e => void register(e)}>
        <label className="form-field"><span>eFootball player name *</span><input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Your in-game name" /></label>
        <label className="form-field"><span>WhatsApp number *</span><input required type="tel" minLength={9} maxLength={20} pattern="[+0-9() -]+" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="0712 345 678" /></label>
        <label className="form-field"><span>Squad image *</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><small className="small-note">JPG, PNG or WEBP; maximum 5 MB.</small></label>
        <label className="form-field"><span>Short bio (optional)</span><textarea rows={2} maxLength={400} value={bio} onChange={e => setBio(e.target.value)} placeholder="Play style, console, preferred match timesâ€¦" /></label>
        <label className="form-field"><span>M-Pesa transaction code *</span><input required minLength={4} maxLength={80} value={reference} onChange={e => setReference(e.target.value.toUpperCase())} placeholder="e.g. QWE123ABC" /></label>
        <p className="small-note">Submit the KSh 20 M-Pesa reference for manual admin verification. No listing appears until approved.</p>
        {(mpesaTill || mpesaPaybill) && <p className="payment-instructions">{mpesaTill ? `M-Pesa Buy Goods Till: ${mpesaTill}` : `M-Pesa Paybill: ${mpesaPaybill}`}{mpesaPaybill && mpesaAccount ? ` Â· Account: ${mpesaAccount}` : ""}</p>}
        <button className="button button-primary" disabled={saving}>{saving ? "Submittingâ€¦" : "Submit KSh 20 listing"}</button>
      </form>}</section>}
    {hasAccess && <>
      <div className="opportunities-toolbar"><h2>Registered players ({players.length})</h2><button className="button button-primary" onClick={() => setTournamentForm(v => !v)}>{tournamentForm ? "Cancel" : "+ Organize tournament"}</button></div>
      {tournamentForm && <form className="profile-editor opportunity-editor" onSubmit={e => void makeTournament(e)}>
        <h2>Organize a tournament</h2>
        <label className="form-field"><span>Tournament name *</span><input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="form-field opportunity-wide"><span>Details and rules *</span><textarea required minLength={5} maxLength={1000} rows={3} value={details} onChange={e => setDetails(e.target.value)} /></label>
        <label className="form-field"><span>eFootball tournament / room number *</span><input required minLength={2} maxLength={80} value={tournamentNumber} onChange={e => setTournamentNumber(e.target.value)} placeholder="Enter the tournament number players should use" /></label>
        <label className="form-field"><span>Date (optional)</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="form-field"><span>Contact for joining *</span><input required minLength={3} maxLength={150} value={contact} onChange={e => setContact(e.target.value)} placeholder="WhatsApp number or link" /></label>
        <button className="button button-primary" disabled={saving}>{saving ? "Publishingâ€¦" : "Publish tournament"}</button>
      </form>}
      <div className="feature-grid">{players.map(p => <article className="feature-card" key={p.id}>
        <img src={p.squad_image_url} alt={`${p.player_name} squad`} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12 }} />
        <h2>{p.player_name}</h2><p>{p.bio || "Ready to find an opponent."}</p><p className="small-note">WhatsApp: {p.whatsapp_number}</p>
        <a className="button button-outline" href={`https://wa.me/${whatsappDigits(p.whatsapp_number)}?text=${encodeURIComponent(`Hi ${p.player_name}, I found your eFootball listing on Chuka Comrades. Want to play a match?`)}`} target="_blank" rel="noreferrer">Challenge on WhatsApp â†—</a>
      </article>)}</div>
      <div className="opportunity-list-heading"><h2>Community tournaments</h2><span>{tournaments.length} listed</span></div>
      {tournaments.length === 0 ? <p className="small-note">No tournaments listed yet. Organize the first one.</p> : <div className="opportunity-grid">{tournaments.map(t => <article className="opportunity-card" key={t.id}>
        <h3>{t.title}</h3><p>{t.details}</p><p><strong>Tournament number:</strong> {t.tournament_number}</p><p className="small-note">Organizer: {t.organizer_name}{t.event_date ? ` Â· ${t.event_date}` : ""}</p><p>Join/contact: {t.contact}</p>
        <a className="button button-outline" href={`https://wa.me/?text=${encodeURIComponent(`Join ${t.title} on Chuka Comrades eFootball. Tournament number: ${t.tournament_number}. Details: ${t.details}. Contact: ${t.contact}`)}`} target="_blank" rel="noreferrer">Share tournament number â†—</a>
      </article>)}</div>}
    </>}
    {loading && <p className="loading-card">Loading eFootball dataâ€¦</p>}
  </section>;
}

