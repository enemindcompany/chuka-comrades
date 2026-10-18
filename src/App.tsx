
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase";
import {
  getStudentProfile,
  saveStudentProfile,
  type StudentProfile,
} from "./lib/firebaseApi";
import "./App.css";
import AnonymousCommunity from "./components/AnonymousCommunity";
import Efootball from "./components/Efootball";
import PremierLeague from "./components/PremierLeague";
import Hostels, { HostelManagerAdmin } from "./components/Hostels";
import Opportunities from "./components/Opportunities";
import MarketplaceSubscription from "./components/MarketplaceSubscription";
import BillingAdmin from "./components/BillingAdmin";
import {
  createMarketplaceListing,
  deleteMarketplaceListing,
  getMarketplaceListings,
  updateMarketplaceListing,
  uploadMarketplaceImage,
  getMarketplaceStore,
  saveMarketplaceStore,
  type MarketplaceStore,
  type MarketplaceStoreDraft,
  type MarketplaceCategory,
  type MarketplaceListing,
  type MarketplaceStatus,
} from "./lib/marketplaceApi";
import { getOpportunities } from "./lib/opportunityApi";
import { getEfootballData } from "./lib/communityApi";

type Page =
  | "home"
  | "marketplace"
  | "hostels"
  | "anonymous"
  | "efootball"
  | "premier-league"
  | "opportunities"
  | "profile"
  | "admin";

const navigation: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "marketplace", label: "Marketplace", icon: "🛍️" },
  { id: "hostels", label: "Hostels & Roommates", icon: "🏘️" },
  { id: "anonymous", label: "Hookup", icon: "💗" },
  { id: "efootball", label: "eFootball", icon: "⚽" },
  { id: "opportunities", label: "Opportunities", icon: "🎓" },
  { id: "profile", label: "My Profile", icon: "👤" },
  { id: "admin", label: "Admin", icon: "🛡️" },
];


type MarketplaceDraft = {
  store_name: string;
  title: string;
  category: MarketplaceCategory;
  price_ksh: string;
  price_negotiable: boolean;
  location: string;
  whatsapp_number: string;
  description: string;
  image_urls: string[];
  status: MarketplaceStatus;
};

const emptyMarketplaceDraft: MarketplaceDraft = {
  store_name: "",
  title: "",
  category: "Other",
  price_ksh: "",
  price_negotiable: false,
  location: "Chuka University / Chuka town",
  whatsapp_number: "",
  description: "",
  image_urls: [],
  status: "available",
};

function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

const trends = [
  { icon: "🛍️", title: "Campus Marketplace", description: "Latest items, campus businesses and services.", page: "marketplace" as Page },
  { icon: "⚽", title: "eFootball", description: "Find players, share tournament numbers and organize matches.", page: "efootball" as Page },
  { icon: "🎓", title: "Opportunities", description: "Latest jobs, scholarships, referrals and learning resources.", page: "opportunities" as Page },
];

const ADMIN_EMAIL = "sidneywafula30@gmail.com";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [course, setCourse] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [page, setPage] = useState<Page>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceSaving, setMarketplaceSaving] = useState(false);
  const [marketplaceUploading, setMarketplaceUploading] = useState(false);
  const [marketplaceShowForm, setMarketplaceShowForm] = useState(false);
  const [marketplaceEditingId, setMarketplaceEditingId] = useState<string | null>(null);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplaceDraft>(emptyMarketplaceDraft);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceNotice, setMarketplaceNotice] = useState("");
  const [marketplaceStore, setMarketplaceStore] = useState<MarketplaceStore | null>(null);
  const [marketplaceStoreDraft, setMarketplaceStoreDraft] = useState<MarketplaceStoreDraft>({
    seller_name: "", store_name: "", business_type: "General retail", location: "Chuka town / Ndagani",
    whatsapp_number: "", description: "", delivery_options: ["Collection"],
  });
  const [marketplaceStoreOpen, setMarketplaceStoreOpen] = useState(false);
  const [marketplaceStoreSaving, setMarketplaceStoreSaving] = useState(false);
  const [trendHighlights, setTrendHighlights] = useState<Record<string, string>>({});
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (authError) => {
        console.error("Authentication state error:", authError);
        setError("Unable to check your sign-in status. Please refresh.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || page !== "home") return;
    let cancelled = false;
    void Promise.all([
      getMarketplaceListings().catch(() => [] as MarketplaceListing[]),
      getEfootballData().catch(() => null),
      getOpportunities().catch(() => ({ opportunities: [], has_access: false })),
    ]).then(([listings, efootball, opportunityResult]) => {
      if (cancelled) return;
      const available = listings.filter((item) => item.status === "available" && !item.admin_suspended);
      const opportunities = opportunityResult.opportunities;
      const highlights: Record<string, string> = {
        marketplace: available.length ? `${available.length} available listing${available.length === 1 ? "" : "s"} · Latest: ${available[0].title}` : "No current listings yet — the marketplace is ready for the community's first listing.",
        efootball: efootball?.hasAccess ? `${efootball.players.length} registered players · ${efootball.tournaments.length} tournament${efootball.tournaments.length === 1 ? "" : "s"} listed` : "Player listings and tournament details appear here when available to your account.",
        opportunities: opportunities.length ? `${opportunities.length} shared opportunit${opportunities.length === 1 ? "y" : "ies"} · Latest: ${opportunities[0].title}` : "No shared opportunities yet. Be the first to share one.",
      };
      setTrendHighlights(highlights);
    });
    return () => { cancelled = true; };
  }, [user, page]);

  useEffect(() => {
    if (!user || page !== "marketplace") return;
    let active = true;
    setMarketplaceLoading(true);
    setMarketplaceError("");
    void Promise.all([getMarketplaceListings(), getMarketplaceStore()])
      .then(([rows, store]) => {
        if (!active) return;
        setMarketplaceListings(rows);
        setMarketplaceStore(store);
        if (store) setMarketplaceStoreDraft({ seller_name: store.seller_name, store_name: store.store_name, business_type: store.business_type, location: store.location, whatsapp_number: store.whatsapp_number, description: store.description, delivery_options: store.delivery_options ?? ["Collection"] });
        else setMarketplaceStoreDraft((current) => ({ ...current, seller_name: user?.displayName ?? "", store_name: user?.displayName ? `${user.displayName.split(" ")[0]}'s Store` : "" }));
      })
      .catch((err) => { if (active) setMarketplaceError(err instanceof Error ? err.message : "Could not load marketplace data."); })
      .finally(() => { if (active) setMarketplaceLoading(false); });
    return () => { active = false; };
  }, [user, page]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        setCourse("");
        setYearOfStudy("");
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const savedProfile = await getStudentProfile();
        if (!active) return;

        setProfile(savedProfile);
        setCourse(savedProfile?.course ?? "");
        setYearOfStudy(
          savedProfile?.year_of_study != null
            ? String(savedProfile.year_of_study)
            : "",
        );
      } catch (err) {
        if (!active) return;
        console.error("Profile loading error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your profile.",
        );
      } finally {
        if (active) setProfileLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  function renderAdminDashboard() {
    return <><HostelManagerAdmin /><BillingAdmin /></>;
  }

  function navigateTo(nextPage: Page) {
    setPage(nextPage);
    setMenuOpen(false);
    setSearch("");
    setCategory("All categories");
    setError("");
    setNotice("");
  }

  async function handleGoogleSignIn() {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      if (code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled. You can try again.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This website domain is not authorized in Firebase.");
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in popup. Allow popups and retry.");
      } else {
        console.error("Google sign-in error:", err);
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      await signOut(auth);
      setPage("home");
      setMenuOpen(false);
    } catch (err) {
      console.error("Sign-out error:", err);
      setError("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) return;

    setError("");
    setNotice("");

    const year = yearOfStudy.trim() ? Number(yearOfStudy) : undefined;

    if (
      year !== undefined &&
      (!Number.isInteger(year) || year < 1 || year > 10)
    ) {
      setError("Year of study must be a whole number from 1 to 10.");
      return;
    }

    setProfileSaving(true);

    try {
      const savedProfile = await saveStudentProfile({
        display_name:
          profile?.display_name ||
          user.displayName ||
          "Chuka Comrades member",
        campus: "Chuka Campus",
        course: course.trim() || null,
        year_of_study: year ?? null,
        avatar_url: user.photoURL || profile?.avatar_url || null,
      });

      setProfile(savedProfile);
      setCourse(savedProfile.course ?? "");
      setYearOfStudy(
        savedProfile.year_of_study != null
          ? String(savedProfile.year_of_study)
          : "",
      );
      setNotice("Your profile has been saved successfully.");
    } catch (err) {
      console.error("Profile saving error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your profile. Please try again.",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  const filteredMarketplaceListings = marketplaceListings.filter((listing) => {
    const matchesCategory = category === "All categories" || listing.category === category;
    const haystack = `${listing.title} ${listing.store_name} ${listing.category} ${listing.location} ${listing.description}`.toLowerCase();
    return matchesCategory && haystack.includes(search.toLowerCase());
  });

  function startMarketplaceCreate() {
    setMarketplaceEditingId(null);
    setMarketplaceDraft({
      ...emptyMarketplaceDraft,
      store_name: marketplaceStore?.store_name ?? (user?.displayName ? `${user.displayName.split(" ")[0]}'s Store` : ""),
      location: marketplaceStore?.location ?? emptyMarketplaceDraft.location,
      whatsapp_number: marketplaceStore?.whatsapp_number ?? "",
    });
    setMarketplaceShowForm(true);
    setMarketplaceError("");
    setMarketplaceNotice("");
    if (!marketplaceStore) setMarketplaceStoreOpen(true);
  }

  async function handleMarketplaceStoreSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMarketplaceError(""); setMarketplaceNotice(""); setMarketplaceStoreSaving(true);
    try {
      const saved = await saveMarketplaceStore(marketplaceStoreDraft);
      setMarketplaceStore(saved);
      setMarketplaceStoreDraft({ seller_name: saved.seller_name, store_name: saved.store_name, business_type: saved.business_type, location: saved.location, whatsapp_number: saved.whatsapp_number, description: saved.description, delivery_options: saved.delivery_options });
      setMarketplaceDraft((current) => ({ ...current, store_name: saved.store_name, location: saved.location, whatsapp_number: saved.whatsapp_number }));
      setMarketplaceStoreOpen(false);
      setMarketplaceNotice("Your store profile is saved to your account. You can return and edit it anytime.");
    } catch (err) { setMarketplaceError(err instanceof Error ? err.message : "Could not save your store profile."); }
    finally { setMarketplaceStoreSaving(false); }
  }

  function startMarketplaceEdit(listing: MarketplaceListing) {
    setMarketplaceEditingId(listing.id);
    setMarketplaceDraft({
      store_name: listing.store_name,
      title: listing.title,
      category: listing.category,
      price_ksh: String(listing.price_ksh || ""),
      price_negotiable: listing.price_negotiable,
      location: listing.location,
      whatsapp_number: listing.whatsapp_number,
      description: listing.description,
      image_urls: listing.image_urls ?? [],
      status: listing.status,
    });
    setMarketplaceShowForm(true);
    setMarketplaceError("");
    setMarketplaceNotice("");
  }

  async function refreshMarketplace() {
    const rows = await getMarketplaceListings();
    setMarketplaceListings(rows);
  }

  async function handleMarketplaceSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMarketplaceError("");
    setMarketplaceNotice("");
    const price = marketplaceDraft.price_ksh.trim() ? Number(marketplaceDraft.price_ksh) : 0;
    if (!marketplaceDraft.store_name.trim() || !marketplaceDraft.title.trim() || !marketplaceDraft.location.trim() ||
        !marketplaceDraft.whatsapp_number.trim() || !marketplaceDraft.description.trim()) {
      setMarketplaceError("Complete the store name, item name, location, WhatsApp number and description.");
      return;
    }
    if (!Number.isSafeInteger(price) || price < 0) {
      setMarketplaceError("Enter a valid price or leave it blank for contact-for-price.");
      return;
    }
    const payload = {
      store_name: marketplaceDraft.store_name.trim(),
      title: marketplaceDraft.title.trim(),
      category: marketplaceDraft.category,
      price_ksh: price,
      price_negotiable: marketplaceDraft.price_negotiable,
      location: marketplaceDraft.location.trim(),
      whatsapp_number: marketplaceDraft.whatsapp_number.trim(),
      description: marketplaceDraft.description.trim(),
      image_urls: marketplaceDraft.image_urls,
      status: marketplaceDraft.status,
    };
    setMarketplaceSaving(true);
    try {
      if (marketplaceEditingId) {
        await updateMarketplaceListing(marketplaceEditingId, payload);
        setMarketplaceNotice("Your marketplace listing has been updated.");
      } else {
        await createMarketplaceListing(payload);
        setMarketplaceNotice("Your listing is published. Viewers can contact your store directly on WhatsApp. No payments are collected through Chuka Comrades.");
      }
      setMarketplaceShowForm(false);
      setMarketplaceEditingId(null);
      setMarketplaceDraft(emptyMarketplaceDraft);
      await refreshMarketplace();
    } catch (err) {
      setMarketplaceError(err instanceof Error ? err.message : "Could not save your marketplace listing.");
    } finally {
      setMarketplaceSaving(false);
    }
  }

  async function handleMarketplaceDelete(listing: MarketplaceListing) {
    if (!window.confirm(`Delete “${listing.title}” from ${listing.store_name}? This cannot be undone.`)) return;
    setMarketplaceError("");
    setMarketplaceNotice("");
    try {
      await deleteMarketplaceListing(listing.id);
      setMarketplaceListings((current) => current.filter((item) => item.id !== listing.id));
      setMarketplaceNotice("Marketplace listing deleted.");
    } catch (err) {
      setMarketplaceError(err instanceof Error ? err.message : "Could not delete this listing.");
    }
  }

  async function handleMarketplaceImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (marketplaceDraft.image_urls.length + files.length > 5) {
      setMarketplaceError("You can upload up to 5 photos per listing.");
      return;
    }
    setMarketplaceUploading(true);
    setMarketplaceError("");
    try {
      const uploaded = await Promise.all(files.map((file) => uploadMarketplaceImage(file)));
      setMarketplaceDraft((current) => ({ ...current, image_urls: [...current.image_urls, ...uploaded] }));
      setMarketplaceNotice(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      setMarketplaceError(err instanceof Error ? err.message : "Could not upload photos.");
    } finally {
      setMarketplaceUploading(false);
    }
  }

  function renderHome() {
    return (
      <>
        <section className="homepage-heading">
          <span className="eyebrow">WELCOME TO YOUR COMMUNITY</span>
          <h1>Karibu, {user?.displayName?.split(" ")[0] || "Comrade"}! 👋</h1>
          <p>
            Your campus, your people, your opportunities. Everything
            happening around Chuka Comrades starts here.
          </p>
        </section>

        <section className="trends-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WHAT'S HAPPENING</span>
              <h2>Chuka Trends 🔥</h2>
              <p>Explore the spaces and activities in our community.</p>
            </div>
          </div>

          <div className="trends-grid">
            {trends.map((trend) => (
              <button
                className="trend-card"
                key={trend.title}
                type="button"
                onClick={() => navigateTo(trend.page)}
              >
                <span className="trend-icon" aria-hidden="true">
                  {trend.icon}
                </span>
                <span className="trend-card-title">{trend.title}</span>
                <span className="trend-description">
                  {trendHighlights[trend.page] ?? trend.description}
                </span>
                <span className="trend-link">Explore section →</span>
              </button>
            ))}
          </div>
        </section>

        <section className="community-banner">
          <div>
            <span className="eyebrow">ONE COMMUNITY</span>
            <h2>Life at Chuka is better together.</h2>
            <p>
              Connect with comrades, share useful information and discover
              what's available in the community.
            </p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigateTo("anonymous")}
          >
            Explore Hookup
          </button>
        </section>

        <section className="home-quick-links">
          <h2>Quick access</h2>
          <div className="quick-link-list">
            {navigation
              .filter((item) => item.id !== "home")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-link"
                  onClick={() => navigateTo(item.id)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
          </div>
        </section>
      </>
    );
  }

  function renderMarketplace() {
    return (
      <>
        <section className="homepage-heading">
          <span className="eyebrow">BUY, SELL & DISCOVER LOCALLY</span>
          <h1>Campus marketplace 🛍️</h1>
          <p>Discover items, small businesses and services from fellow comrades around Chuka.</p>
        </section>
        <div className="marketplace-safety-note" role="note">
          <strong>View and contact directly — no online payments.</strong>
          <span>Chuka Comrades does not provide checkout or handle transactions. Contact sellers on WhatsApp, inspect items or services first, and agree safely with the seller directly.</span>
        </div>
        <MarketplaceSubscription />
        <section className="marketplace-toolbar profile-editor">
          <label className="form-field"><span>Search marketplace</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items, stores or services..." /></label>
          <label className="form-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option><option>Books</option><option>Electronics</option><option>Fashion</option><option>Home</option><option>Food</option><option>Services</option><option>Other</option></select></label>
          <div className="marketplace-toolbar-actions"><button className="button button-outline" type="button" onClick={() => { setMarketplaceStoreOpen((open) => !open); setMarketplaceError(""); }}>{marketplaceStore ? "Manage my store" : "Set up my store"}</button><button className="button button-primary marketplace-add-button" type="button" onClick={startMarketplaceCreate}>+ Add product / service</button></div>
        </section>
        {marketplaceStore && !marketplaceStoreOpen && <section className="marketplace-store-summary"><div><span className="eyebrow">YOUR STORE</span><h2>{marketplaceStore.store_name}</h2><p>{marketplaceStore.seller_name} · {marketplaceStore.business_type} · 📍 {marketplaceStore.location}</p><p>{marketplaceStore.description}</p><small>WhatsApp: {marketplaceStore.whatsapp_number} · {marketplaceStore.delivery_options.join(" / ")}</small></div><button className="button button-outline" type="button" onClick={() => setMarketplaceStoreOpen(true)}>Edit store details</button></section>}
        {marketplaceStoreOpen && <section className="profile-editor marketplace-listing-editor"><div className="section-heading"><div><span className="eyebrow">SELLER PROFILE</span><h2>{marketplaceStore ? "Manage your store" : "Set up your store"}</h2><p>Save this once. Your store profile stays linked to your account for future visits.</p></div><button className="button button-outline" type="button" onClick={() => setMarketplaceStoreOpen(false)}>Close</button></div><form className="marketplace-form" onSubmit={(event) => void handleMarketplaceStoreSave(event)}>
          <label className="form-field"><span>Your name *</span><input required minLength={2} maxLength={80} value={marketplaceStoreDraft.seller_name} onChange={(event) => setMarketplaceStoreDraft({ ...marketplaceStoreDraft, seller_name: event.target.value })} placeholder="Name customers should know" /></label>
          <label className="form-field"><span>Store / business name *</span><input required minLength={2} maxLength={100} value={marketplaceStoreDraft.store_name} onChange={(event) => setMarketplaceStoreDraft({ ...marketplaceStoreDraft, store_name: event.target.value })} placeholder="e.g. Comrade Tech Shop" /></label>
          <label className="form-field"><span>Business type *</span><select value={marketplaceStoreDraft.business_type} onChange={(event) => setMarketplaceStoreDraft({ ...marketplaceStoreDraft, business_type: event.target.value })}><option>General retail</option><option>Electronics</option><option>Clothing and shoes</option><option>Food and groceries</option><option>Books and stationery</option><option>Beauty and personal care</option><option>Home and furniture</option><option>Student services</option><option>Other</option></select></label>
          <label className="form-field"><span>Working location *</span><input required minLength={2} maxLength={150} value={marketplaceStoreDraft.location} onChange={(event) => setMarketplaceStoreDraft({ ...marketplaceStoreDraft, location: event.target.value })} placeholder="e.g. Ndagani, Chuka town" /></label>
          <label className="form-field"><span>WhatsApp number *</span><input required minLength={9} maxLength={20} pattern="[+0-9() -]+" value={marketplaceStoreDraft.whatsapp_number} onChange={(event) => setMarketplaceStoreDraft({ ...marketplaceStoreDraft, whatsapp_number: event.target.value })} placeholder="0712 345 678" /></label>
          <label className="form-field marketplace-field-wide"><span>About your store *</span><textarea required minLength={5} maxLength={1000} rows={3} value={marketplaceStoreDraft.description} onChange={(event) => setMarketplaceStoreDraft({ ...marketplaceStoreDraft, description: event.target.value })} placeholder="What do you sell? When and how can customers reach you?" /></label>
          <fieldset className="marketplace-field-wide"><legend>How can customers receive orders? *</legend>{["Collection", "Seller delivery"].map((option) => <label key={option} className="marketplace-checkbox-field"><input type="checkbox" checked={marketplaceStoreDraft.delivery_options.includes(option)} onChange={(event) => setMarketplaceStoreDraft((current) => ({ ...current, delivery_options: event.target.checked ? [...current.delivery_options, option] : current.delivery_options.filter((item) => item !== option) }))} /> {option}</label>)}</fieldset>
          <div className="marketplace-field-wide marketplace-form-actions"><button className="button button-primary" type="submit" disabled={marketplaceStoreSaving}>{marketplaceStoreSaving ? "Saving store..." : "Save my store"}</button><span className="small-note">No online payments. Customers arrange payment with you directly.</span></div>
        </form></section>}
        {marketplaceError && <p className="error-message" role="alert">{marketplaceError}</p>}
        {marketplaceNotice && <p className="success-message" role="status">{marketplaceNotice}</p>}
        {marketplaceShowForm && <section className="profile-editor marketplace-listing-editor">
          <div className="section-heading"><div><span className="eyebrow">SELLER DETAILS</span><h2>{marketplaceEditingId ? "Edit listing" : "Create a listing"}</h2><p>Your WhatsApp number will be shown to viewers so they can contact you directly.</p></div><button className="button button-outline" type="button" onClick={() => { setMarketplaceShowForm(false); setMarketplaceEditingId(null); }}>Cancel</button></div>
          <form className="marketplace-form" onSubmit={(event) => void handleMarketplaceSave(event)}>
            <label className="form-field"><span>Store / business name *</span><input value={marketplaceDraft.store_name} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, store_name: event.target.value })} required maxLength={100} placeholder="e.g. Comrade Tech Shop" /></label>
            <label className="form-field"><span>Item or service title *</span><input value={marketplaceDraft.title} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, title: event.target.value })} required minLength={2} maxLength={120} placeholder="e.g. Second-hand laptop" /></label>
            <label className="form-field"><span>Category *</span><select value={marketplaceDraft.category} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, category: event.target.value as MarketplaceCategory })}><option>Books</option><option>Electronics</option><option>Fashion</option><option>Home</option><option>Food</option><option>Services</option><option>Other</option></select></label>
            <label className="form-field"><span>Price in KSh (optional)</span><input type="number" min="0" step="1" value={marketplaceDraft.price_ksh} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, price_ksh: event.target.value })} placeholder="Leave blank for contact-for-price" /></label>
            <label className="marketplace-checkbox-field"><input type="checkbox" checked={marketplaceDraft.price_negotiable} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, price_negotiable: event.target.checked })} /> Price is negotiable</label>
            <label className="form-field"><span>Location *</span><input value={marketplaceDraft.location} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, location: event.target.value })} required maxLength={150} placeholder="e.g. Ndagani, Chuka town" /></label>
            <label className="form-field"><span>WhatsApp number *</span><input type="tel" value={marketplaceDraft.whatsapp_number} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, whatsapp_number: event.target.value })} required minLength={9} maxLength={20} pattern="[+0-9() -]+" placeholder="0712 345 678" /></label>
            <label className="form-field marketplace-field-wide"><span>Description *</span><textarea value={marketplaceDraft.description} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, description: event.target.value })} required minLength={5} rows={3} maxLength={2000} placeholder="Describe the item, condition, service, opening hours or other useful details." /></label>
            <div className="form-field marketplace-field-wide"><span>Photos (up to 5, JPG/PNG/WebP, max 2.5 MB each)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void handleMarketplaceImageSelection(event)} disabled={marketplaceUploading || marketplaceDraft.image_urls.length >= 5} /><small className="small-note">{marketplaceUploading ? "Uploading photos..." : `${marketplaceDraft.image_urls.length}/5 photos added`}</small>{marketplaceDraft.image_urls.length > 0 && <div className="marketplace-photo-editor">{marketplaceDraft.image_urls.map((url, index) => <div key={url}><img src={url} alt={`Listing photo ${index + 1}`} /><button type="button" className="button button-outline" onClick={() => setMarketplaceDraft((current) => ({ ...current, image_urls: current.image_urls.filter((item) => item !== url) }))}>Remove</button></div>)}</div>}</div>
            {marketplaceEditingId && <label className="form-field"><span>Listing status</span><select value={marketplaceDraft.status} onChange={(event) => setMarketplaceDraft({ ...marketplaceDraft, status: event.target.value as MarketplaceStatus })}><option value="available">Available</option><option value="sold">Sold</option><option value="closed">Hide listing</option></select></label>}
            <div className="marketplace-field-wide marketplace-form-actions"><button className="button button-primary" type="submit" disabled={marketplaceSaving || marketplaceUploading}>{marketplaceSaving ? "Saving..." : marketplaceEditingId ? "Save changes" : "Publish listing"}</button><span className="small-note">No checkout or online payment is available. Buyers contact your store directly on WhatsApp.</span></div>
          </form>
        </section>}
        <div className="marketplace-results-heading"><div><h2>Community listings</h2><p>Contact the seller to ask questions, confirm availability and arrange a safe viewing or collection.</p></div></div>
        {marketplaceLoading ? <p className="form-feedback">Loading marketplace listings...</p> : filteredMarketplaceListings.length === 0 ? (
          <div className="marketplace-empty-state"><span aria-hidden="true">🛍️</span><h3>{search || category !== "All categories" ? "No matching listings" : "Be the first to list something"}</h3><p>{search || category !== "All categories" ? "Try a different search or category." : "Add an item, service or store listing and include your WhatsApp number so other comrades can contact you."}</p><button className="button button-primary" type="button" onClick={startMarketplaceCreate}>+ Create first listing</button></div>
        ) : <div className="marketplace-grid">{filteredMarketplaceListings.map((listing) => {
          const mine = listing.created_by === user?.uid;
          const icon = listing.category === "Books" ? "📚" : listing.category === "Electronics" ? "📱" : listing.category === "Fashion" ? "👟" : listing.category === "Home" ? "🪑" : listing.category === "Food" ? "🍲" : listing.category === "Services" ? "🧰" : "🛍️";
          return <article className="marketplace-card" key={listing.id}>
            <div className={`marketplace-image${listing.image_urls?.length ? " has-images" : ""}`}>{listing.image_urls?.length ? <div className="marketplace-image-gallery">{listing.image_urls.map((url, index) => <img src={url} key={url} alt={`${listing.title} photo ${index + 1}`} loading="lazy" />)}</div> : <span aria-hidden="true">{icon}</span>}</div>
            <div className="marketplace-card-body"><span className="marketplace-category">{listing.category}</span><h3>{listing.title}</h3><p className="marketplace-store-name">{listing.store_name} · 📍 {listing.location}</p><strong className="marketplace-price">{listing.price_ksh > 0 ? `KSh ${listing.price_ksh.toLocaleString()}` : "Contact for price"}{listing.price_negotiable && listing.price_ksh > 0 ? " · Negotiable" : ""}</strong><p className="marketplace-description">{listing.description}</p><span className={`marketplace-status marketplace-status-${listing.status}`}>{listing.status === "available" ? "Available" : listing.status === "sold" ? "Sold" : "Hidden from buyers"}</span>{listing.status !== "closed" && <><p className="marketplace-contact-number">WhatsApp: <strong>{listing.whatsapp_number}</strong></p><a className="button button-whatsapp marketplace-whatsapp" href={`https://wa.me/${toWhatsAppNumber(listing.whatsapp_number)}?text=${encodeURIComponent(`Hi, I saw “${listing.title}” from ${listing.store_name} on Chuka Comrades. I would like to order/enquire. Is it available? Price shown: ${listing.price_ksh > 0 ? `KSh ${listing.price_ksh}` : "please confirm price"}. Please confirm stock, delivery or collection options, and how to pay directly.`)}`} target="_blank" rel="noreferrer">Order / enquire on WhatsApp</a></>}{mine && <div className="marketplace-owner-actions"><button className="button button-outline" type="button" onClick={() => startMarketplaceEdit(listing)}>Edit listing</button><button className="button button-outline" type="button" onClick={() => void handleMarketplaceDelete(listing)}>Delete</button></div>}</div>
          </article>;
        })}</div>}
      </>
    );
  }


  function renderSimplePage() {
    if (page === "profile") {
      return (
        <>
          <div className="homepage-heading">
            <h1>My profile 👤</h1>
            <p>
              Manage your community profile. Your email is provided by your
              signed-in Google account.
            </p>
          </div>

          <section className="profile-editor">
            {profileLoading ? (
              <p className="form-feedback">Loading your saved profile...</p>
            ) : (
              <form onSubmit={handleProfileSave}>
                <label className="form-field">
                  <span>Email address</span>
                  <input
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                  />
                </label>

                <label className="form-field">
                  <span>Display name</span>
                  <input
                    value={profile?.display_name || user?.displayName || ""}
                    readOnly
                  />
                </label>

                <label className="form-field">
                  <span>Campus</span>
                  <input value="Chuka Campus" readOnly />
                </label>

                <label className="form-field">
                  <span>Course or programme (optional)</span>
                  <input
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    maxLength={120}
                    placeholder="Optional"
                  />
                </label>

                <label className="form-field">
                  <span>Year of study (optional)</span>
                  <select
                    value={yearOfStudy}
                    onChange={(event) => setYearOfStudy(event.target.value)}
                  >
                    <option value="">Prefer not to specify</option>
                    {Array.from({ length: 10 }, (_, index) => (
                      <option key={index + 1} value={String(index + 1)}>
                        Year {index + 1}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="button button-primary save-profile-button"
                  type="submit"
                  disabled={profileSaving || profileLoading || !user}
                >
                  {profileSaving ? "Saving profile..." : "Save profile"}
                </button>
              </form>
            )}
          </section>
        </>
      );
    }

    if (page === "efootball") {
      return <Efootball />;
    }

    if (page === "opportunities") {
      return <Opportunities />;
    }

    return null;
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="loading-card">Loading Chuka Comrades...</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand brand-button"
          type="button"
          onClick={() => navigateTo("home")}
          aria-label="Go to Chuka Comrades home"
        >
          <img
            className="brand-crest"
            src={`${import.meta.env.BASE_URL}chuka%20crest.jfif`}
            alt="Chuka University crest"
          />
          <span>Chuka Comrades</span>
        </button>

        <div className="topbar-actions">
          {user && (
            <button
              type="button"
              className="menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="main-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
              {menuOpen ? "Close menu" : "Menu"}
            </button>
          )}

          {user && (
            <button
              type="button"
              className="button button-outline signout-button"
              onClick={handleSignOut}
              disabled={busy || profileSaving}
            >
              {busy ? "Please wait..." : "Sign out"}
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-intro">
            <span className="eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</span>

            {user ? (
              <div className="profile-card">
                {user.photoURL || profile?.avatar_url ? (
                  <img
                    className="avatar"
                    src={user.photoURL || profile?.avatar_url || ""}
                    alt="Your profile"
                  />
                ) : (
                  <div className="avatar avatar-placeholder">
                    {(user.displayName || user.email || "C")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <div className="profile-details">
                  <strong>
                    {user.displayName ||
                      profile?.display_name ||
                      "Chuka Comrades member"}
                  </strong>
                  <span>{user.email}</span>
                  <span>Chuka University community</span>
                  <span className="status">
                    <span className="status-dot" />
                    Signed in with Google
                  </span>
                </div>
              </div>
            ) : (
              <div className="login-hero">
                <h1>Everything campus life needs, in one place.</h1>
                <p>
                  Connect with fellow comrades, discover opportunities,
                  explore accommodation and join the Chuka community.
                </p>
                <button
                  className="button button-primary google-signin-button"
                  onClick={handleGoogleSignIn}
                  disabled={busy}
                >
                  <svg
                    className="google-logo"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.3 19.3 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18 12 24 12Z"
                    />
                  </svg>
                  {busy ? "Connecting..." : "Continue with Google"}
                </button>
                <p className="small-note">
                  Sign in securely with your Google account.
                </p>
              </div>
            )}
          </div>

          {user && (
            <>
              <nav
                id="main-navigation"
                className={`main-navigation${menuOpen ? " menu-open" : ""}`}
                aria-label="Main navigation"
                hidden={!menuOpen}
              >
                {navigation.filter((item) => item.id !== "admin" || isAdmin).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item${page === item.id ? " active" : ""}`}
                    aria-current={page === item.id ? "page" : undefined}
                    onClick={() => navigateTo(item.id)}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="homepage-content">
                {isAdmin && page === "admin" ? renderAdminDashboard() : (
                  <>
                    {page === "home" && renderHome()}
                    {page === "marketplace" && renderMarketplace()}
                    {page === "hostels" && <Hostels />}
                    {page === "anonymous" && <AnonymousCommunity />}
                    {page === "premier-league" && <PremierLeague />}
                    {(page === "efootball" || page === "opportunities" || page === "profile") && renderSimplePage()}
                    {page === "admin" && !isAdmin && <p className="error-message">Admin access is restricted.</p>}
                  </>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="success-message" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Chuka Comrades</span>
        <span>Built for the campus community.</span>
      </footer>
    </main>
  );
}

export default App;