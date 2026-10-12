
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase";
import "./App.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function handleGoogleSignIn() {
    setError("");
    setBusy(true);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      // Temporary diagnostic: report claim presence only; never log the ID token.
      const tokenResult = await credential.user.getIdTokenResult();
      console.info("Firebase/Supabase auth diagnostic", {
        roleClaimPresent: Object.prototype.hasOwnProperty.call(
          tokenResult.claims,
          "role",
        ),
        authenticatedRoleClaimPresent:
          tokenResult.claims.role === "authenticated",
      });
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
    setBusy(true);

    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
      setError("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="loading-card">Loading Chuka Comrades…</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Chuka Comrades home">
          <img
  className="brand-crest"
  src="/chuka%20crest.jfif"
  alt="Chuka University crest"
/>
          <span>Chuka Comrades</span>
        </a>
        {user && (
          <button
            className="button button-outline"
            onClick={handleSignOut}
            disabled={busy}
          >
            {busy ? "Please wait…" : "Sign out"}
          </button>
        )}
      </header>

      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</span>

          {user ? (
            <>
              <h1>Welcome to your campus community.</h1>
              <p>
                You're signed in. We're building your home for campus
                opportunities, accommodation, events and eFootball.
              </p>

              <div className="profile-card">
                {user.photoURL ? (
                  <img
                    className="avatar"
                    src={user.photoURL}
                    alt="Your Google profile"
                  />
                ) : (
                  <div className="avatar avatar-placeholder">
                    {(user.displayName || user.email || "S")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="profile-details">
                  <strong>{user.displayName || "Chuka Comrades student"}</strong>
                  <span>{user.email}</span>
                  <span className="status">
                    <span className="status-dot" />
                    Signed in with Google
                  </span>
                </div>
              </div>

              <div className="feature-grid">
                <article className="feature-card">
                  <span className="feature-icon">⚽</span>
                  <h2>eFootball</h2>
                  <p>Weekly tournaments and match updates.</p>
                </article>
                <article className="feature-card">
                  <span className="feature-icon">🏠</span>
                  <h2>Accommodation</h2>
                  <p>Find hostels and potential roommates.</p>
                </article>
                <article className="feature-card">
                  <span className="feature-icon">🎓</span>
                  <h2>Opportunities</h2>
                  <p>Discover scholarships, attachments and referrals.</p>
                </article>
              </div>
            </>
          ) : (
            <>
              <h1>Everything campus life needs, in one place.</h1>
              <p>
                Connect with fellow students, discover opportunities, find
                accommodation and join the Chuka Comrades community.
              </p>

              <button
                className="button button-primary"
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
    d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.3 19.3 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"
  />
</svg>

                {busy ? "Connecting…" : "Continue with Google"}
              </button>

              <p className="small-note">
                Sign in securely with your Google account.
              </p>
            </>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
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
