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

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [course, setCourse] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      setError("");
      setNotice("");

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
            : "Unable to load your student profile.",
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

  async function handleGoogleSignIn() {
    setError("");
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
    profile?.display_name || user.displayName || "Chuka Comrades student",
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
      setNotice("Your student profile has been saved.");
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
            disabled={busy || profileSaving}
          >
            {busy ? "Please wait..." : "Sign out"}
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
                Connect with fellow students, discover opportunities, find
                accommodation and join the Chuka Comrades community.
              </p>

              <div className="profile-card">
                {profile?.avatar_url || user.photoURL ? (
                  <img
                    className="avatar"
                    src={profile?.avatar_url || user.photoURL || ""}
                    alt="Your profile"
                  />
                ) : (
                  <div className="avatar avatar-placeholder">
                    {(profile?.display_name || user.displayName || user.email || "S")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="profile-details">
                  <strong>
                    {profile?.display_name || user.displayName || "Chuka Comrades student"}
                  </strong>
                  <span>{user.email}</span>
                  <span>{profile?.university || "Chuka University"}</span>
                  <span className="status">
                    <span className="status-dot" />
                    Signed in with Google
                  </span>
                </div>
              </div>

              <section className="profile-editor">
                <div className="profile-editor-heading">
                  <h2>Your student profile</h2>
                  <p>Keep your campus details up to date.</p>
                </div>

                {profileLoading ? (
                  <p className="form-feedback">Loading your saved profile...</p>
                ) : (
                  <form onSubmit={handleProfileSave}>
                    <label className="form-field">
                      <span>Campus</span>
                      <input
                        type="text"
                        value="Chuka Campus"
                        readOnly
                      />
                    </label>

                    <label className="form-field">
                      <span>Course or programme</span>
                      <input
                        type="text"
                        value={course}
                        onChange={(event) => setCourse(event.target.value)}
                        maxLength={120}
                        placeholder="e.g. Bachelor of Science"
                      />
                    </label>

                    <label className="form-field">
                      <span>Year of study</span>
                      <select
                        value={yearOfStudy}
                        onChange={(event) => setYearOfStudy(event.target.value)}
                      >
                        <option value="">Select year (optional)</option>
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
                <svg className="google-logo" viewBox="0 0 48 48" aria-hidden="true">
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
                {busy ? "Connecting..." : "Continue with Google"}
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
