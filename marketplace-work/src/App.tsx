
import { useEffect, useState, type FormEvent } from "react";
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
import {
  getActivation,
  getAdminPayments,
  reviewActivationPayment,
  submitActivationPayment,
  type ActivationAccount,
} from "./lib/activationApi";

import AnonymousCommunity from "./components/AnonymousCommunity";
import PremierLeague from "./components/PremierLeague";
import Hostels, { HostelManagerAdmin } from "./components/Hostels";

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
  { id: "anonymous", label: "Anonymous Community", icon: "💗" },
  { id: "efootball", label: "eFootball", icon: "⚽" },
  { id: "premier-league", label: "Chuka Premier League", icon: "🏆" },
  { id: "opportunities", label: "Opportunities", icon: "🎓" },
  { id: "profile", label: "My Profile", icon: "👤" },
  { id: "admin", label: "Admin payments", icon: "🛡️" },
];

const demoProducts = [
  {
    name: "Books & revision materials",
    category: "Books",
    price: "Browse student listings",
    icon: "📚",
  },
  {
    name: "Phones & electronics",
    category: "Electronics",
    price: "Browse student listings",
    icon: "📱",
  },
  {
    name: "Clothes & shoes",
    category: "Fashion",
    price: "Browse student listings",
    icon: "👟",
  },
  {
    name: "Furniture & household items",
    category: "Home",
    price: "Browse student listings",
    icon: "🪑",
  },
];



const trends = [
  {
    icon: "🛍️",
    title: "Campus Marketplace",
    description: "Discover items, businesses and services from fellow comrades.",
    page: "marketplace" as Page,
  },
  {
    icon: "🏘️",
    title: "Hostels & Roommates",
    description: "Explore accommodation and connect with potential roommates.",
    page: "hostels" as Page,
  },
  {
    icon: "⚽",
    title: "Chuka Sports",
    description: "Catch up with campus football and eFootball activities.",
    page: "premier-league" as Page,
  },
  {
    icon: "🎓",
    title: "Opportunities",
    description: "Explore scholarships, internships and career opportunities.",
    page: "opportunities" as Page,
  },
];

const ADMIN_EMAIL = "sidneywafula30@gmail.com";
const ACTIVATION_FEE_KSH = 100;
const TILL_NUMBER = "6817863";

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
  const [activation, setActivation] = useState<ActivationAccount | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [adminPayments, setAdminPayments] = useState<ActivationAccount[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
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

  async function refreshActivation() {
    if (!user) return;
    setError("");
    setNotice("");
    setActivationLoading(true);
    try {
      const status = await getActivation();
      setActivation(status);
      if (status.status !== "pending") setPaymentReference("");
    } catch (err) {
      console.error("Activation status error:", err);
      setError(err instanceof Error ? err.message : "Unable to check activation status.");
    } finally {
      setActivationLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadActivation() {
      if (!user) {
        setActivation(null);
        setPaymentReference("");
        setActivationLoading(false);
        return;
      }
      setActivation(null);
      setActivationLoading(true);
      try {
        const status = await getActivation();
        if (active) setActivation(status);
      } catch (err) {
        if (active) {
          console.error("Activation status error:", err);
          setError(err instanceof Error ? err.message : "Unable to check activation status.");
        }
      } finally {
        if (active) setActivationLoading(false);
      }
    }
    void loadActivation();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    async function loadAdminPayments() {
      if (!isAdmin || page !== "admin") return;
      setAdminLoading(true);
      try {
        const payments = await getAdminPayments();
        if (active) setAdminPayments(payments);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load payment requests.");
      } finally {
        if (active) setAdminLoading(false);
      }
    }
    void loadAdminPayments();
    return () => { active = false; };
  }, [isAdmin, page]);

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentReference.trim()) {
      setError("Enter the M-PESA transaction reference first.");
      return;
    }
    setError("");
    setNotice("");
    setActivationBusy(true);
    try {
      // If the status check failed on page load, initialize/recover the account first.
      // This avoids posting a payment against an account row that has not yet been created.
      let currentActivation = activation;
      if (!currentActivation) {
        currentActivation = await getActivation();
        setActivation(currentActivation);
      }
      if (currentActivation.status === "active") {
        setNotice("Your account is already activated.");
        return;
      }
      const updated = await submitActivationPayment(paymentReference.trim());
      setActivation(updated);
      setNotice("Payment reference submitted. The admin will review it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit payment reference.");
    } finally {
      setActivationBusy(false);
    }
  }

  async function handlePaymentReview(
    firebaseUid: string,
    decision: "approved" | "rejected",
  ) {
    setError("");
    setNotice("");
    try {
      await reviewActivationPayment(firebaseUid, decision);
      const payments = await getAdminPayments();
      setAdminPayments(payments);
      setNotice(decision === "approved" ? "Payment approved. Account activated." : "Payment rejected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this payment.");
    }
  }

  function renderActivationGate() {
    const statusUnavailable = !activation;
    const submitted = activation?.status === "pending";
    const rejected = activation?.status === "rejected";
    return (
      <section className="activation-card">
        <span className="eyebrow">CHUKA COMRADES ACTIVATION</span>
        <h1>{statusUnavailable ? "Checking your free trial" : submitted ? "Payment awaiting review" : rejected ? "Payment needs attention" : "Your free trial has ended"}</h1>
        <p>
          {statusUnavailable
            ? "We couldn't verify your trial status. Your 48-hour free trial must be checked before we can ask you to pay. Please retry after the connection is fixed."
            : submitted
              ? "Your payment reference has been submitted. Access will be activated after the admin verifies the payment."
              : rejected
                ? "The last payment request was not approved. Check your M-PESA reference and submit it again if you have paid."
                : "Your 2-day free trial is over. Pay the one-time activation fee and submit your M-PESA reference for admin verification."}
        </p>
        {statusUnavailable && (
          <div className="activation-service-warning" role="status">
            Activation service is currently unreachable. Please retry the status check after the administrator deploys the activation-api function and configures the correct website origin.
          </div>
        )}
        {!statusUnavailable && <>
          <div className="activation-price">
            <span>One-time activation</span>
            <strong>KSh {ACTIVATION_FEE_KSH}</strong>
          </div>
          <div className="activation-instructions">
            <span>1. Send KSh {ACTIVATION_FEE_KSH} using M-PESA Buy Goods / Till.</span>
            <strong>Till number: {TILL_NUMBER}</strong>
            <span>2. Copy the transaction code from your M-PESA confirmation message.</span>
            <span>3. Enter the code below. Your account is activated only after admin approval.</span>
          </div>
        </>}
        {statusUnavailable && (
          <button className="button button-outline" type="button" onClick={() => void refreshActivation()} disabled={activationLoading}>
            {activationLoading ? "Checking..." : "Retry trial status check"}
          </button>
        )}
        {!statusUnavailable && (submitted ? (
          <>
            <div className="form-feedback">
              Submitted reference: <strong>{activation?.payment_reference}</strong>
              <br />Status: Awaiting admin verification.
            </div>
            <button className="button button-outline" type="button" onClick={() => void refreshActivation()} disabled={activationLoading}>
              {activationLoading ? "Checking..." : "Check payment status"}
            </button>
          </>
        ) : (
          <form className="activation-form" onSubmit={handlePaymentSubmit}>
            <label className="form-field">
              <span>M-PESA transaction reference</span>
              <input
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                maxLength={80}
                required
                placeholder="e.g. QWE123ABC4"
                autoComplete="off"
              />
            </label>
            <button className="button button-primary" type="submit" disabled={activationBusy}>
              {activationBusy ? "Submitting..." : "Submit for verification"}
            </button>
          </form>
        ))}
        <p className="small-note">{statusUnavailable ? "You will not be asked to pay until the service confirms that your 48-hour free trial has ended." : "Keep your M-PESA confirmation message until your payment has been verified. Do not submit a reference unless you have actually paid."}</p>
      </section>
    );
  }

  function renderAdminDashboard() {
    const pending = adminPayments.filter((item) => item.status === "pending");
    return (
      <>
      <section className="admin-dashboard">
        <div className="homepage-heading">
          <span className="eyebrow">ADMINISTRATOR</span>
          <h1>Payment verification 🛡️</h1>
          <p>Review M-PESA references before activating student accounts.</p>
        </div>
        <div className="admin-summary">
          <div><span>Pending review</span><strong>{pending.length}</strong></div>
          <div><span>Activated accounts</span><strong>{adminPayments.filter((item) => item.status === "active").length}</strong></div>
          <div><span>Registered accounts</span><strong>{adminPayments.length}</strong></div>
        </div>
        <div className="section-heading">
          <h2>Payment requests</h2>
          <button className="button button-outline" type="button" onClick={() => {
            setAdminLoading(true);
            void getAdminPayments().then(setAdminPayments).catch((err) => setError(err instanceof Error ? err.message : "Unable to refresh payments.")).finally(() => setAdminLoading(false));
          }}>Refresh</button>
        </div>
        {adminLoading ? <p className="form-feedback">Loading payment requests...</p> : adminPayments.length === 0 ? (
          <p className="form-feedback">No registered accounts yet.</p>
        ) : (
          <div className="admin-payment-list">
            {adminPayments.map((item) => (
              <article className="admin-payment-card" key={item.firebase_uid}>
                <div className="admin-payment-top">
                  <div>
                    <strong>{item.email}</strong>
                    <span>Trial ends: {new Date(item.trial_ends_at).toLocaleString()}</span>
                  </div>
                  <span className={`activation-status status-${item.status}`}>{item.status}</span>
                </div>
                <p>Payment reference: <strong>{item.payment_reference || "Not submitted"}</strong></p>
                {item.payment_submitted_at && <p>Submitted: {new Date(item.payment_submitted_at).toLocaleString()}</p>}
                {item.status === "pending" && (
                  <div className="admin-review-actions">
                    <button className="button button-primary" type="button" onClick={() => void handlePaymentReview(item.firebase_uid, "approved")}>Approve & activate</button>
                    <button className="button button-outline" type="button" onClick={() => void handlePaymentReview(item.firebase_uid, "rejected")}>Reject</button>
                  </div>
                )}
                {item.status === "active" && item.activated_at && <p className="small-note">Activated: {new Date(item.activated_at).toLocaleString()}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
      <HostelManagerAdmin />
      </>
    );
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

  const filteredProducts = demoProducts.filter((product) => {
    const matchesCategory =
      category === "All categories" || product.category === category;
    const matchesSearch =
      `${product.name} ${product.category}`
        .toLowerCase()
        .includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

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
                  {trend.description}
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
            Explore community
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
        <div className="homepage-heading">
          <h1>Campus marketplace 🛍️</h1>
          <p>
            Discover items and services from the Chuka Comrades community.
          </p>
        </div>

        <section className="profile-editor">
          <label className="form-field">
            <span>Search marketplace</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search books, electronics, clothes..."
            />
          </label>

          <label className="form-field">
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>All categories</option>
              <option>Books</option>
              <option>Electronics</option>
              <option>Fashion</option>
              <option>Home</option>
            </select>
          </label>

          <p className="form-feedback">
            These are category previews, not live advertisements.
          </p>
        </section>

        <div className="marketplace-grid">
          {filteredProducts.map((product) => (
            <article className="marketplace-card" key={product.category}>
              <div className="marketplace-image" aria-hidden="true">
                {product.icon}
              </div>
              <div className="marketplace-card-body">
                <span className="marketplace-category">
                  {product.category}
                </span>
                <h3>{product.name}</h3>
                <p>{product.price}</p>
                <span className="coming-soon-label">
                  Listings coming soon
                </span>
              </div>
            </article>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <p className="form-feedback">
            No categories match your search. Try another search term.
          </p>
        )}

        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon">🛒</span>
            <h2>Buy from comrades</h2>
            <p>Discover useful items for campus life.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">💼</span>
            <h2>Sell your items</h2>
            <p>
              Listing creation will be enabled when the secure listings
              service is ready.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">🤝</span>
            <h2>Student services</h2>
            <p>Make room for businesses and useful services.</p>
          </article>
        </div>
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
      return (
        <>
          <div className="homepage-heading">
            <h1>Chuka eFootball ⚽</h1>
            <p>Your home for campus gaming competitions.</p>
          </div>
          <div className="feature-grid">
            {[
              "Weekly knockout tournament",
              "Match fixtures and results",
              "Player registration and tournament rules",
            ].map((item) => (
              <article className="feature-card" key={item}>
                <span className="feature-icon">🎮</span>
                <h2>{item}</h2>
                <p>Competition information and activities coming soon.</p>
              </article>
            ))}
          </div>
        </>
      );
    }

    if (page === "opportunities") {
      return (
        <>
          <div className="homepage-heading">
            <h1>Opportunities 🎓</h1>
            <p>Explore opportunities relevant to comrades and graduates.</p>
          </div>
          <div className="feature-grid">
            {[
              "Scholarships and bursaries",
              "Industrial attachments and internships",
              "Jobs and career opportunities",
              "Referral programmes",
            ].map((item) => (
              <article className="feature-card" key={item}>
                <span className="feature-icon">🌟</span>
                <h2>{item}</h2>
                <p>Opportunity listings will appear here when available.</p>
              </article>
            ))}
          </div>
        </>
      );
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
            src="/chuka%20crest.jfif"
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
                {isAdmin && page === "admin" ? renderAdminDashboard() : activationLoading ? (
                  <div className="loading-card">Checking your trial and activation status...</div>
                ) : !isAdmin && activation?.status !== "active" &&
                  (!activation || Date.now() >= new Date(activation.trial_ends_at).getTime()) ? renderActivationGate() : (
                  <>
                    {activation?.status === "pending" && (
                      <div className="form-feedback activation-trial-note">
                        <span>Your payment reference is awaiting admin review. Your trial access remains available until it expires.</span>
                        <button className="button button-outline" type="button" onClick={() => void refreshActivation()} disabled={activationLoading}>
                          {activationLoading ? "Checking..." : "Check payment status"}
                        </button>
                      </div>
                    )}
                    {page === "home" && renderHome()}
                    {page === "marketplace" && renderMarketplace()}
                    {page === "hostels" && <Hostels />}
                    {page === "anonymous" && <AnonymousCommunity />}
                    {page === "premier-league" && <PremierLeague />}
                    {(page === "efootball" ||
                      page === "opportunities" ||
                      page === "profile") && renderSimplePage()}
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