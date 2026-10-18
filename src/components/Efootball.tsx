import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createEfootballTournament, getEfootballData, registerEfootballPlayer, updateEfootballSaleListing, type EfootballPlayer, type EfootballTournament } from "../lib/communityApi";

import PaymentInstructions from "./PaymentInstructions";
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
  const [accountForSale, setAccountForSale] = useState(false);
  const [accountPrice, setAccountPrice] = useState("");
  const [tournamentImage, setTournamentImage] = useState<File | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await getEfootballData();
      setPlayers(data.players); setTournaments(data.tournaments); setOwn(data.ownPlayer); setHasAccess(data.hasAccess);
      if (data.ownPlayer) { setAccountForSale(data.ownPlayer.account_for_sale === true); setAccountPrice(data.ownPlayer.account_price_ksh ? String(data.ownPlayer.account_price_ksh) : ""); }
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
      const p = await registerEfootballPlayer({ player_name: name.trim(), whatsapp_number: whatsapp.trim(), bio: bio.trim(), payment_reference: reference.trim().toUpperCase(), squad_image_base64: dataUrl.split(",")[1] ?? "", squad_image_type: image.type, account_for_sale: accountForSale, account_price_ksh: accountForSale && accountPrice.trim() ? Number(accountPrice) : null });
      setOwn(p); setNotice("Player listing and KSh 20 payment reference submitted. Your details will appear after admin approval."); setReference(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit listing."); }
    finally { setSaving(false); }
  }

  async function saveSaleListing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { await updateEfootballSaleListing({ account_for_sale: accountForSale, account_price_ksh: accountForSale && accountPrice.trim() ? Number(accountPrice) : null }); setNotice(accountForSale ? "Your eFootball account is listed for sale. Buyers can contact you on WhatsApp." : "Your eFootball account has been removed from the sale marketplace."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update account sale listing."); }
    finally { setSaving(false); }
  }

  async function makeTournament(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      let tournamentImageBase64 = "";
      if (tournamentImage) {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read tournament image.")); reader.onerror = () => reject(new Error("Could not read tournament image.")); reader.readAsDataURL(tournamentImage); });
        tournamentImageBase64 = dataUrl.split(",")[1] ?? "";
      }
      await createEfootballTournament({ title: title.trim(), details: details.trim(), tournament_number: tournamentNumber.trim(), event_date: date, contact: contact.trim(), tournament_image_base64: tournamentImageBase64, tournament_image_type: tournamentImage?.type ?? "" });
      setTitle(""); setDetails(""); setTournamentNumber(""); setDate(""); setContact(""); setTournamentImage(null); setTournamentForm(false); setNotice("Tournament published with its shareable tournament number."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create tournament."); }
    finally { setSaving(false); }
  }

  return <section className="feature-page">
    <div className="efootball-brand-hero"><img className="efootball-official-logo" src="https://commons.wikimedia.org/wiki/Special:Redirect/file/EFootball_logo.svg" alt="eFootball official logo" /><div><span className="eyebrow">CHUKA COMRADES GAMING HUB</span><h1>eFootball players, accounts & tournaments</h1><p>Find players, list an account for sale, upload tournament posters and share room numbers.</p></div></div>
    {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {!hasAccess && <section className="activation-card"><div><span className="eyebrow">ONE-TIME PLAYER LISTING</span><h2>KSh 20 listing fee</h2><p>{own?.payment_status === "pending" ? "Your listing payment is waiting for admin verification." : own?.payment_status === "rejected" ? "Your previous payment was rejected. Check the transaction code and resubmit." : "Pay KSh 20 once. After admin approval, your player name, squad image and WhatsApp contact will be listed, and you can access the player directory and tournament tools."}</p>{own?.payment_status === "pending" && <span className="status-pill status-pending">Payment under review</span>}</div>
      {own?.payment_status !== "pending" && <form className="activation-payment-form" onSubmit={e => void register(e)}>
        <label className="form-field"><span>eFootball player name *</span><input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Your in-game name" /></label>
        <label className="form-field"><span>WhatsApp number *</span><input required type="tel" minLength={9} maxLength={20} pattern="[+0-9() -]+" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="0712 345 678" /></label>
        <label className="form-field"><span>Squad image *</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><small className="small-note">JPG, PNG or WEBP; maximum 5 MB.</small></label>
        <label className="form-field"><span>Short bio (optional)</span><textarea rows={2} maxLength={400} value={bio} onChange={e => setBio(e.target.value)} placeholder="Play style, console, preferred match timesâ€¦" /></label>
        <div className="form-field"><span>Account marketplace</span><label className="marketplace-checkbox-field"><input type="checkbox" checked={accountForSale} onChange={e => setAccountForSale(e.target.checked)} /> I am listing this eFootball account for sale</label></div>
        {accountForSale && <label className="form-field"><span>Asking price (KSh) *</span><input type="number" min="1" step="1" required value={accountPrice} onChange={e => setAccountPrice(e.target.value)} placeholder="e.g. 2500" /></label>}
        <label className="form-field"><span>M-Pesa transaction code *</span><input required minLength={4} maxLength={80} value={reference} onChange={e => setReference(e.target.value.toUpperCase())} placeholder="e.g. QWE123ABC" /></label>
        <p className="small-note">Submit the KSh 20 M-Pesa reference for manual admin verification. No listing appears until approved.</p>
        <button className="button button-primary" disabled={saving}>{saving ? "Submittingâ€¦" : "Submit KSh 20 listing"}</button>
      </form>}
      <PaymentInstructions amount={20} purpose="eFootball player listing" />
    </section>}
    <>
      {hasAccess && <form className="profile-editor efootball-sale-editor" onSubmit={e => void saveSaleListing(e)}><div><span className="eyebrow">ACCOUNT MARKETPLACE</span><h2>Sell your eFootball account</h2><p>Opt in to show your account as available for sale. Buyers contact you directly; never share passwords or transfer access before verifying payment.</p></div><label className="marketplace-checkbox-field"><input type="checkbox" checked={accountForSale} onChange={e => setAccountForSale(e.target.checked)} /> List my account for sale</label>{accountForSale && <label className="form-field"><span>Asking price (KSh) *</span><input required type="number" min="1" step="1" value={accountPrice} onChange={e => setAccountPrice(e.target.value)} placeholder="e.g. 2500" /></label>}<button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save account marketplace settings"}</button></form>}
      <div className="opportunities-toolbar"><h2>Registered players ({players.length})</h2>{hasAccess ? <button className="button button-primary" onClick={() => setTournamentForm(v => !v)}>{tournamentForm ? "Cancel" : "+ Organize tournament"}</button> : <span className="small-note">Player registration and tournament publishing require the one-time KSh 20 listing approval.</span>}</div>
      {hasAccess && tournamentForm && <form className="profile-editor opportunity-editor" onSubmit={e => void makeTournament(e)}>
        <h2>Organize a tournament</h2>
        <label className="form-field"><span>Tournament name *</span><input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="form-field opportunity-wide"><span>Details and rules *</span><textarea required minLength={5} maxLength={1000} rows={3} value={details} onChange={e => setDetails(e.target.value)} /></label>
        <label className="form-field"><span>eFootball tournament / room number *</span><input required minLength={2} maxLength={80} value={tournamentNumber} onChange={e => setTournamentNumber(e.target.value)} placeholder="Enter the tournament number players should use" /></label>
        <label className="form-field"><span>Date (optional)</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="form-field"><span>Contact for joining *</span><input required minLength={3} maxLength={150} value={contact} onChange={e => setContact(e.target.value)} placeholder="WhatsApp number or link" /></label>
        <label className="form-field"><span>Tournament poster / image (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0] ?? null; if (file && (file.size > 5 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(file.type))) { setError("Choose a JPG, PNG or WEBP image up to 5 MB."); e.target.value = ""; setTournamentImage(null); return; } setTournamentImage(file); setError(""); }} /><small className="small-note">JPG, PNG or WEBP; maximum 5 MB. Click the image to view it full-size.</small></label>
        <button className="button button-primary" disabled={saving}>{saving ? "Publishingâ€¦" : "Publish tournament"}</button>
      </form>}
      <div className="feature-grid">{players.map(p => <article className="feature-card" key={p.id}>
        <button type="button" className="efootball-image-button" onClick={() => setExpandedImage(p.squad_image_url)} aria-label={`View ${p.player_name} squad image full size`}><img src={p.squad_image_url} alt={`${p.player_name} squad`} /></button>
        <h2>{p.player_name}</h2><p>{p.bio || "Ready to find an opponent."}</p><p className="small-note">WhatsApp: {p.whatsapp_number}</p>
        {p.account_for_sale ? <a className="button button-primary" href={`https://wa.me/${whatsappDigits(p.whatsapp_number)}?text=${encodeURIComponent(`Hi ${p.player_name}, I saw your eFootball account for sale on Chuka Comrades${p.account_price_ksh ? ` at KSh ${p.account_price_ksh}` : ""}. Is it still available? Please share safe verification details before any payment.`)}`} target="_blank" rel="noreferrer">Contact to Buy{p.account_price_ksh ? ` · KSh ${p.account_price_ksh.toLocaleString()}` : ""}</a> : <a className="button button-outline" href={`https://wa.me/${whatsappDigits(p.whatsapp_number)}?text=${encodeURIComponent(`Hi ${p.player_name}, I found your eFootball listing on Chuka Comrades. Want to play a match?`)}`} target="_blank" rel="noreferrer">Challenge on WhatsApp â†—</a>}
      </article>)}</div>
      <div className="opportunity-list-heading"><h2>Community tournaments</h2><span>{tournaments.length} listed</span></div>
      {tournaments.length === 0 ? <p className="small-note">No tournaments listed yet. Organize the first one.</p> : <div className="opportunity-grid">{tournaments.map(t => <article className="opportunity-card" key={t.id}>
        {t.image_url && <button type="button" className="efootball-image-button tournament-poster" onClick={() => setExpandedImage(t.image_url!)} aria-label={`View ${t.title} poster full size`}><img src={t.image_url} alt={`${t.title} tournament poster`} /></button>}<h3>{t.title}</h3><p>{t.details}</p><p><strong>Tournament number:</strong> {t.tournament_number}</p><p className="small-note">Organizer: {t.organizer_name}{t.event_date ? ` Â· ${t.event_date}` : ""}</p><p>Join/contact: {t.contact}</p>
        <a className="button button-outline" href={`https://wa.me/?text=${encodeURIComponent(`Join ${t.title} on Chuka Comrades eFootball. Tournament number: ${t.tournament_number}. Details: ${t.details}. Contact: ${t.contact}`)}`} target="_blank" rel="noreferrer">Share tournament number â†—</a>
      </article>)}</div>}
    </>
    {loading && <p className="loading-card">Loading eFootball dataâ€¦</p>}
    {expandedImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Full-size image" onClick={() => setExpandedImage(null)}><button type="button" className="image-lightbox-close" onClick={() => setExpandedImage(null)} aria-label="Close image">×</button><img src={expandedImage} alt="Full-size eFootball image" onClick={e => e.stopPropagation()} /></div>}
  </section>;
}

