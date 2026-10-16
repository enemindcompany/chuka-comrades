import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import RoommateFinder from "./RoommateFinder";
import {
  createHostelListing,
  deleteHostelListing,
  getHostelListings,
  getHostelManager,
  getHostelManagerRequests,
  registerHostelManager,
  reviewHostelManager,
  updateHostelListing,
  uploadRoomImage,
  submitListingPaymentReference,
  getPendingListingPayments,
  reviewListingPayment,
  type HostelListing,
  type HostelManager,
  type HostelManagerRole,
} from "../lib/hostelApi";

type HostelDraft = {
  name: string;
  area: string;
  address: string;
  rent_ksh: string;
  deposit_ksh: string;
  room_type: string;
  vacancies: string;
  phone: string;
  description: string;
  amenities: string;
  image_urls: string[];
  listing_status: "available" | "booked" | "closed";
};

const emptyDraft: HostelDraft = {
  name: "",
  area: "",
  address: "",
  rent_ksh: "",
  deposit_ksh: "",
  room_type: "Single room",
  vacancies: "1",
  phone: "",
  description: "",
  amenities: "",
  image_urls: [],
  listing_status: "available",
};

function draftFromListing(listing: HostelListing): HostelDraft {
  return {
    name: listing.name,
    area: listing.area,
    address: listing.address,
    rent_ksh: String(listing.rent_ksh),
    deposit_ksh: String(listing.deposit_ksh),
    room_type: listing.room_type,
    vacancies: String(listing.vacancies),
    phone: listing.phone,
    description: listing.description,
    amenities: listing.amenities.join(", "),
    image_urls: listing.image_urls?.length ? listing.image_urls : listing.image_url ? [listing.image_url] : [],
    listing_status: listing.listing_status ?? (listing.is_available ? "available" : "booked"),
  };
}

function toPayload(draft: HostelDraft) {
  return {
    name: draft.name.trim(),
    area: draft.area.trim(),
    address: draft.address.trim(),
    rent_ksh: Number(draft.rent_ksh),
    deposit_ksh: Number(draft.deposit_ksh || 0),
    room_type: draft.room_type,
    vacancies: Number(draft.vacancies),
    phone: draft.phone.trim(),
    description: draft.description.trim(),
    amenities: draft.amenities.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 15),
    image_urls: draft.image_urls,
    image_url: draft.image_urls[0] ?? null,
    listing_status: draft.listing_status,
    is_available: draft.listing_status === "available",
  };
}

export default function Hostels() {
  const [listings, setListings] = useState<HostelListing[]>([]);
  const [manager, setManager] = useState<HostelManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<HostelManagerRole>("landlord");
  const [managerPhone, setManagerPhone] = useState("");
  const [registering, setRegistering] = useState(false);
  const [draft, setDraft] = useState<HostelDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
  const [submittingPaymentId, setSubmittingPaymentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextListings, nextManager] = await Promise.all([
        getHostelListings(),
        getHostelManager(),
      ]);
      setListings(nextListings);
      setManager(nextManager);
      if (nextManager) setManagerPhone(nextManager.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load hostel listings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleManagerRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setRegistering(true);
    try {
      const registered = await registerHostelManager(role, managerPhone.trim());
      setManager(registered);
      setNotice(`Your ${registered.role} request was submitted. The administrator must approve it before you can list rooms.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register your manager account.");
    } finally {
      setRegistering(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setDraft({ ...emptyDraft, phone: managerPhone });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function startEdit(listing: HostelListing) {
    setEditingId(listing.id);
    setDraft(draftFromListing(listing));
    setShowForm(true);
    setError("");
    setNotice("");
  }

  async function handleListingSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const payload = toPayload(draft);
    if (!payload.name || !payload.area || !payload.address || !payload.phone || !payload.description) {
      setError("Complete all required room details before saving.");
      return;
    }
    if (!Number.isInteger(payload.rent_ksh) || payload.rent_ksh < 1 ||
      !Number.isInteger(payload.deposit_ksh) || payload.deposit_ksh < 0) {
      setError("Rent must be a positive whole number and deposit must be zero or a positive whole number.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateHostelListing(editingId, payload);
        setNotice("Your room details have been updated.");
      } else {
        const created = await createHostelListing(payload);
        setNotice(`Room saved. Submit the KSh 200 M-PESA payment reference below; the room will not be public until an administrator verifies payment. Listing ID: ${created.id}`);
      }
      setShowForm(false);
      setEditingId(null);
      setDraft(emptyDraft);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this hostel listing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(listing: HostelListing) {
    if (!window.confirm(`Delete "${listing.name}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await deleteHostelListing(listing.id);
      setListings((current) => current.filter((item) => item.id !== listing.id));
      setNotice("Room listing deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this listing.");
    }
  }

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (draft.image_urls.length + files.length > 5) {
      setError("You can upload up to 5 photos per room.");
      return;
    }
    setUploadingImages(true);
    setError("");
    try {
      const uploaded = await Promise.all(files.map((file) => uploadRoomImage(file)));
      setDraft((current) => ({ ...current, image_urls: [...current.image_urls, ...uploaded] }));
      setNotice(`${uploaded.length} room photo${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload room photos.");
    } finally {
      setUploadingImages(false);
    }
  }

  async function handlePaymentReference(listing: HostelListing) {
    const reference = (paymentRefs[listing.id] ?? "").trim();
    if (!reference) { setError("Enter the M-PESA transaction reference first."); return; }
    setSubmittingPaymentId(listing.id);
    setError(""); setNotice("");
    try {
      await submitListingPaymentReference(listing.id, reference);
      setPaymentRefs((current) => ({ ...current, [listing.id]: "" }));
      setNotice("Reference submitted for manual verification. The room is not public until the administrator confirms payment.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the payment reference.");
    } finally { setSubmittingPaymentId(null); }
  }

  const visibleListings = listings.filter((listing) =>
    `${listing.name} ${listing.area} ${listing.address} ${listing.room_type} ${listing.description}`
      .toLowerCase().includes(search.toLowerCase()),
  );
  const myListings = listings.filter((listing) => listing.created_by === manager?.firebase_uid);

  return (
    <section className="hostels-page">
      <div className="homepage-heading">
        <span className="eyebrow">CHUKA CAMPUS ACCOMMODATION</span>
        <h1>Hostels & rooms 🏘️</h1>
        <p>Browse available rooms near Chuka University. Landlords and caretakers can register to publish and manage their own listings.</p>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <section className="hostel-manager-panel">
        {manager && manager.status === "approved" ? (
          <div className="hostel-manager-ready">
            <div>
              <span className="eyebrow">MANAGER ACCOUNT</span>
              <h2>Welcome, {manager.role === "landlord" ? "landlord" : "caretaker"}</h2>
              <p>Each individual room costs KSh 200 to list. Upload photos, submit your M-PESA reference, and manage availability. Unverified rooms stay private.</p>
            </div>
            <button className="button button-primary" type="button" onClick={startCreate}>+ List a room (KSh 200)</button>
          </div>
        ) : manager?.status === "pending" ? (
          <div className="hostel-manager-pending">
            <span className="eyebrow">ACCESS REQUEST SUBMITTED</span>
            <h2>Your {manager.role} access is awaiting review</h2>
            <p>The administrator must approve your role before you can publish, edit or delete hostel listings. You can browse current accommodation while your request is reviewed.</p>
            <p className="small-note">Request email: {manager.email} · Contact: {manager.phone}</p>
            <button className="button button-outline" type="button" onClick={() => void loadData()} disabled={loading}>{loading ? "Checking..." : "Check approval status"}</button>
          </div>
        ) : (
          <div className="hostel-manager-register">
            <div>
              <span className="eyebrow">FOR PROPERTY MANAGERS</span>
              <h2>{manager?.status === "rejected" ? "Request access again" : "Are you a landlord or caretaker?"}</h2>
              <p>{manager?.status === "rejected" ? "Your previous request was declined. You can submit a corrected request for review." : "Register your role to publish accommodation. Use the WhatsApp number students should message about rooms."}</p>
            </div>
            <form className="hostel-manager-form" onSubmit={(event) => void handleManagerRegister(event)}>
              <label className="form-field">
                <span>Your role</span>
                <select value={role} onChange={(event) => setRole(event.target.value as HostelManagerRole)}>
                  <option value="landlord">Landlord / property owner</option>
                  <option value="caretaker">Caretaker / property manager</option>
                </select>
              </label>
              <label className="form-field">
                <span>WhatsApp number</span>
                <input value={managerPhone} onChange={(event) => setManagerPhone(event.target.value)} required minLength={9} maxLength={20} placeholder="e.g. 0712 345 678" />
              </label>
              <button className="button button-primary" type="submit" disabled={registering}>
                {registering ? "Registering..." : "Register as property manager"}
              </button>
              <p className="small-note">By registering, you confirm you are authorised to advertise the property. Only create truthful listings.</p>
            </form>
          </div>
        )}
      </section>

      {showForm && manager && (
        <section className="hostel-editor">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{editingId ? "EDIT LISTING" : "NEW LISTING"}</span>
              <h2>{editingId ? "Update room" : "List an individual room"}</h2>
              <p>Listing fee: <strong>KSh 200 per room</strong> · M-PESA Till <strong>6817863</strong>. A payment reference is reviewed manually and does not activate the listing by itself.</p>
            </div>
            <button className="button button-outline" type="button" onClick={() => { setShowForm(false); setEditingId(null); setDraft(emptyDraft); }}>Cancel</button>
          </div>
          <form className="hostel-listing-form" onSubmit={(event) => void handleListingSave(event)}>
            <label className="form-field">
              <span>Hostel / property name *</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={100} placeholder="e.g. Green View Hostels" />
            </label>
            <label className="form-field">
              <span>Area / neighbourhood *</span>
              <input value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })} required maxLength={100} placeholder="e.g. Ndagani, Chuka town" />
            </label>
            <label className="form-field hostel-field-wide">
              <span>Specific location / directions *</span>
              <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} required maxLength={250} placeholder="Landmark, road or directions" />
            </label>
            <label className="form-field">
              <span>Monthly rent (KSh) *</span>
              <input type="number" min="1" step="1" value={draft.rent_ksh} onChange={(event) => setDraft({ ...draft, rent_ksh: event.target.value })} required />
            </label>
            <label className="form-field">
              <span>Deposit (KSh)</span>
              <input type="number" min="0" step="1" value={draft.deposit_ksh} onChange={(event) => setDraft({ ...draft, deposit_ksh: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Room type *</span>
              <select value={draft.room_type} onChange={(event) => setDraft({ ...draft, room_type: event.target.value })}>
                <option>Single room</option><option>Self-contained</option><option>Bedsitter</option><option>One-bedroom</option><option>Shared room</option><option>Hostel bed space</option>
              </select>
            </label>
            <label className="form-field">
              <span>Listing unit</span>
              <input value="One room per KSh 200 listing" disabled />
            </label>
            <label className="form-field">
              <span>WhatsApp number *</span>
              <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required minLength={9} maxLength={20} placeholder="0712 345 678" />
            </label>
            <div className="form-field hostel-field-wide">
              <span>Room photos (up to 5, JPG/PNG/WebP, max 2.5 MB each)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void handleImageSelection(event)} disabled={uploadingImages || draft.image_urls.length >= 5} />
              <small className="small-note">{uploadingImages ? "Uploading photos..." : `${draft.image_urls.length}/5 photos uploaded. Photos are saved to the room listing.`}</small>
              {draft.image_urls.length > 0 && <div className="hostel-photo-editor-grid">{draft.image_urls.map((url, index) => <div key={url}><img src={url} alt={`Room photo ${index + 1}`} /><button type="button" className="button button-outline" onClick={() => setDraft((current) => ({ ...current, image_urls: current.image_urls.filter((item) => item !== url) }))}>Remove</button></div>)}</div>}
            </div>
            <label className="form-field hostel-field-wide">
              <span>Description *</span>
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} required rows={3} maxLength={2000} placeholder="Describe rooms, security, water, electricity and distance from campus." />
            </label>
            <label className="form-field hostel-field-wide">
              <span>Amenities (separate with commas)</span>
              <input value={draft.amenities} onChange={(event) => setDraft({ ...draft, amenities: event.target.value })} maxLength={500} placeholder="Wi-Fi, water, security, parking" />
            </label>
            <label className="form-field">
              <span>Room availability *</span>
              <select value={draft.listing_status} onChange={(event) => setDraft({ ...draft, listing_status: event.target.value as HostelDraft["listing_status"] })}>
                <option value="available">Available</option><option value="booked">Booked</option><option value="closed">Closed</option>
              </select>
            </label>
            <div className="hostel-form-actions hostel-field-wide">
              <button className="button button-primary" type="submit" disabled={saving || uploadingImages}>{saving ? "Saving..." : editingId ? "Save room changes" : "Save room and continue to payment"}</button>
              <span className="small-note">Room listings cost KSh 200 each. New rooms stay private until payment is verified.</span>
            </div>
          </form>
        </section>
      )}

      <RoommateFinder />

      <section className="hostel-browse-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ROOMS AROUND CHUKA</span>
            <h2>Room listings</h2>
          </div>
          <label className="search-field hostel-search">
            <span className="sr-only">Search hostels</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, area or room type..." />
          </label>
        </div>

        {loading ? <p className="form-feedback">Loading accommodation listings...</p> : visibleListings.length === 0 ? (
          <div className="hostel-empty-state">
            <span aria-hidden="true">🏠</span>
            <h3>{search ? "No matching listings" : "No accommodation listings yet"}</h3>
            <p>{search ? "Try another search term or clear your search." : "When landlords publish rooms and their KSh 200 listing payment is verified, rooms appear here. Tap WhatsApp to contact a landlord directly."}</p>
          </div>
        ) : (
          <div className="hostel-listing-grid">
            {visibleListings.map((listing) => {
              const mine = listing.created_by === manager?.firebase_uid;
              return (
                <article className="hostel-listing-card" key={listing.id}>
                  {(listing.image_urls?.length ? listing.image_urls : listing.image_url ? [listing.image_url] : []).length > 0 ? <div className="hostel-photo-gallery">{(listing.image_urls?.length ? listing.image_urls : listing.image_url ? [listing.image_url] : []).map((url, index) => <img className="hostel-listing-photo" key={url} src={url} alt={`${listing.name} room photo ${index + 1}`} loading="lazy" />)}</div> : <div className="hostel-listing-photo hostel-photo-placeholder" aria-hidden="true">🏘️</div>}
                  <div className="hostel-listing-content">
                    <div className="hostel-listing-topline">
                      <span className={`hostel-availability ${listing.listing_status === "available" ? "is-available" : "is-unavailable"}`}>{listing.listing_status === "available" ? "Available" : listing.listing_status === "booked" ? "Booked" : "Closed"}</span>
                      <span className="hostel-room-type">{listing.room_type}</span>
                    </div>
                    <h3>{listing.name}</h3>
                    <p className="hostel-area">📍 {listing.area} · {listing.address}</p>
                    <div className="hostel-rent"><strong>KSh {listing.rent_ksh.toLocaleString()}</strong><span>/ month</span></div>
                    <p className="hostel-description">{listing.description}</p>
                    {listing.amenities.length > 0 && <div className="hostel-amenities">{listing.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div>}
                    <div className="hostel-contact-row"><span>WhatsApp: <strong>{listing.phone}</strong></span><a className="button button-whatsapp hostel-call-button" href={`https://wa.me/${listing.phone.replace(/\D/g, "").replace(/^0/, "254")}?text=${encodeURIComponent(`Hi, I found your ${listing.room_type} at ${listing.name} on Chuka Comrades. Is it available for viewing?`)}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>
                    <p className="hostel-manager-credit">Listed by {listing.manager_role === "landlord" ? "landlord" : "caretaker"}</p>
                    {mine && <>
                      {listing.payment_status !== "paid" && <div className="hostel-payment-box"><strong>{listing.payment_status === "pending_review" ? "Payment awaiting admin review" : listing.payment_status === "rejected" ? "Payment reference rejected — resubmit after checking M-PESA" : "KSh 200 listing fee not verified"}</strong><p>Pay to M-PESA Till 6817863. Enter the transaction reference below. A typed reference is not proof of payment.</p>{listing.payment_status !== "pending_review" && <div className="hostel-payment-submit"><input value={paymentRefs[listing.id] ?? ""} onChange={(event) => setPaymentRefs((current) => ({ ...current, [listing.id]: event.target.value }))} placeholder="M-PESA transaction code" maxLength={80} /><button className="button button-primary" type="button" disabled={submittingPaymentId === listing.id} onClick={() => void handlePaymentReference(listing)}>{submittingPaymentId === listing.id ? "Submitting..." : "Submit for review"}</button></div>}</div>}
                      <div className="hostel-owner-actions"><button className="button button-outline" type="button" onClick={() => startEdit(listing)}>Edit / availability</button><button className="button button-outline hostel-delete-button" type="button" onClick={() => void handleDelete(listing)}>Delete</button></div>
                    </>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {manager && <section className="hostel-my-listings">
        <div className="section-heading"><div><span className="eyebrow">YOUR PROPERTIES</span><h2>My rooms ({myListings.length})</h2></div></div>
        <p className="small-note">Each room is a separate KSh 200 listing. Once payment is approved, you can edit the listing any time and change its status to Available, Booked, or Closed. Closed rooms are hidden from public browsing but remain editable here.</p>
        {myListings.length > 0 && <div className="hostel-my-listings-list">{myListings.map((listing) => <div key={listing.id}><span><strong>{listing.name}</strong><small>{listing.area} · KSh {listing.rent_ksh.toLocaleString()}/month</small></span><button className="button button-outline" type="button" onClick={() => startEdit(listing)}>Edit / availability</button></div>)}</div>}
      </section>}
    </section>
  );
}


export function HostelManagerAdmin() {
  const [managers, setManagers] = useState<HostelManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingPayments, setPendingPayments] = useState<HostelListing[]>([]);
  const [paymentBusyId, setPaymentBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [managerRows, paymentRows] = await Promise.all([getHostelManagerRequests(), getPendingListingPayments()]);
      setManagers(managerRows);
      setPendingPayments(paymentRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load hostel manager requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(firebaseUid: string, decision: "approved" | "rejected") {
    setBusyUid(firebaseUid);
    setError("");
    setNotice("");
    try {
      await reviewHostelManager(firebaseUid, decision);
      setNotice(decision === "approved" ? "Landlord/caretaker access approved." : "Landlord/caretaker request rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this manager request.");
    } finally {
      setBusyUid("");
    }
  }

  const pending = managers.filter((item) => item.status === "pending");

  async function reviewPayment(id: string, decision: "paid" | "rejected") {
    setPaymentBusyId(id); setError(""); setNotice("");
    try {
      await reviewListingPayment(id, decision);
      setNotice(decision === "paid" ? "Room listing payment verified. The room is now eligible to appear publicly." : "Payment reference rejected. The landlord can submit a corrected reference.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this room payment.");
    } finally { setPaymentBusyId(""); }
  }

  return (
    <section className="admin-dashboard hostel-manager-admin">
      <div className="section-heading">
        <div>
          <span className="eyebrow">HOSTEL MARKETPLACE</span>
          <h2>Landlord & caretaker access</h2>
          <p>Approve property managers before they can publish or edit listings.</p>
        </div>
        <button className="button button-outline" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      <div className="admin-summary">
        <div><span>Pending requests</span><strong>{pending.length}</strong></div>
        <div><span>Approved managers</span><strong>{managers.filter((item) => item.status === "approved").length}</strong></div>
        <div><span>Total requests</span><strong>{managers.length}</strong></div>
      </div>
      {loading ? <p className="form-feedback">Loading manager requests...</p> : pending.length === 0 ? (
        <p className="form-feedback">There are no manager requests waiting for review.</p>
      ) : (
        <div className="hostel-manager-request-list">
          {pending.map((item) => (
            <article className="hostel-manager-request" key={item.firebase_uid}>
              <div>
                <h3>{item.role === "landlord" ? "Landlord / property owner" : "Caretaker / property manager"}</h3>
                <p><strong>{item.email}</strong></p>
                <p>Contact: {item.phone}</p>
                <p className="small-note">Requested {new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="hostel-owner-actions">
                <button className="button button-primary" type="button" disabled={busyUid === item.firebase_uid} onClick={() => void review(item.firebase_uid, "approved")}>{busyUid === item.firebase_uid ? "Saving..." : "Approve access"}</button>
                <button className="button button-outline hostel-delete-button" type="button" disabled={busyUid === item.firebase_uid} onClick={() => void review(item.firebase_uid, "rejected")}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-heading hostel-payment-admin-heading">
        <div><span className="eyebrow">M-PESA MANUAL VERIFICATION</span><h2>Room listing payments ({pendingPayments.length})</h2><p>Check each transaction in the M-PESA records before approving it. A submitted code alone is not proof of payment.</p></div>
        <button className="button button-outline" type="button" onClick={() => void load()} disabled={loading}>Refresh payments</button>
      </div>
      {pendingPayments.length === 0 ? <p className="form-feedback">No room listing payments are waiting for review.</p> : <div className="hostel-manager-request-list">{pendingPayments.map((listing) => <article className="hostel-manager-request" key={listing.id}><div><h3>{listing.name} — {listing.room_type}</h3><p><strong>KSh {listing.listing_fee_ksh} listing fee</strong> · {listing.area}</p><p>Landlord: {listing.manager_email} · WhatsApp: {listing.phone}</p><p>M-PESA reference: <strong>{listing.payment_reference}</strong></p><p className="small-note">Submitted {listing.payment_submitted_at ? new Date(listing.payment_submitted_at).toLocaleString() : "date unavailable"} · Listing ID {listing.id}</p></div><div className="hostel-owner-actions"><button className="button button-primary" type="button" disabled={paymentBusyId === listing.id} onClick={() => void reviewPayment(listing.id, "paid")}>{paymentBusyId === listing.id ? "Saving..." : "Verify payment"}</button><button className="button button-outline hostel-delete-button" type="button" disabled={paymentBusyId === listing.id} onClick={() => void reviewPayment(listing.id, "rejected")}>Reject reference</button></div></article>)}</div>}
    </section>
  );
}
