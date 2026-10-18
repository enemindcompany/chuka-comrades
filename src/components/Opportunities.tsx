
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getActivation,
  submitActivationPayment,
  type ActivationAccount,
} from "../lib/activationApi";
import {
  createOpportunity,
  getOpportunities,
  type Opportunity,
  type OpportunityCategory,
} from "../lib/opportunityApi";
import PaymentInstructions from "./PaymentInstructions";

const categories: OpportunityCategory[] = [
  "Referral links",
  "WhatsApp groups",
  "Online jobs",
  "Scholarships & bursaries",
  "Attachments & internships",
  "Skill learning",
  "Contacts & referrals",
  "Events & competitions",
  "Business opportunities",
  "Other",
];

const blank = {
  title: "",
  category: "Online jobs" as OpportunityCategory,
  description: "",
  link_url: "",
  deadline: "",
  contact: "",
};

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
    setLoading(true);
    setError("");

    try {
      const [account, result] = await Promise.all([
        getActivation(),
        getOpportunities(),
      ]);

      setActivation(account);
      setItems(result.opportunities);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load opportunities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function payForAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const account = await submitActivationPayment(paymentReference);
      setActivation(account);
      setNotice(
        "M-Pesa reference submitted. Full Opportunities access unlocks after an administrator verifies your payment.",
      );
      setPaymentReference("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit payment reference.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await createOpportunity({
        title: draft.title.trim(),
        category: draft.category,
        description: draft.description.trim(),
        link_url: draft.link_url.trim() || null,
        deadline: draft.deadline || null,
        contact: draft.contact.trim() || null,
      });

      setDraft(blank);
      setShowForm(false);
      setNotice("Opportunity shared successfully.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not publish this opportunity.",
      );
    } finally {
      setSaving(false);
    }
  }

  const visible = items.filter(
    (item) => filter === "All" || item.category === filter,
  );

  return (
    <section className="opportunities-page">
      <div className="homepage-heading">
        <h1>Opportunities 🎓</h1>
        <p>
          Discover jobs, scholarships, WhatsApp groups, referrals, events and
          other useful leads shared by fellow comrades.
        </p>
      </div>

      <section className="activation-card">
        <div>
          <span className="eyebrow">ONE-TIME PAGE ACCESS</span>
          <h2>Opportunities access · KSh 100</h2>

          <p>
            {hasAccess
              ? "Your payment is approved. You have permanent access to full opportunity details."
              : activation?.status === "pending"
                ? "Your M-Pesa reference is awaiting administrator verification."
                : activation?.status === "rejected"
                  ? "Your last payment was not approved. Check the transaction code and try again."
                  : "Pay once to unlock full descriptions, application links and contact details. Access is enabled after payment approval."}
          </p>

          {hasAccess && (
            <span className="status-pill status-active">
              Permanent access active
            </span>
          )}

          {activation?.status === "pending" && (
            <span className="status-pill status-pending">
              Payment under review
            </span>
          )}
        </div>

        {!hasAccess && <PaymentInstructions amount={100} purpose="Opportunities access" />}
        {!hasAccess && activation?.status !== "pending" && (
          <form className="activation-payment-form" onSubmit={payForAccess}>
            <h3>Pay with M-Pesa</h3>

            <p className="small-note">
              Pay KSh 100 using the official payment details above, then enter
              your M-Pesa transaction code. An administrator verifies the
              payment manually before access is unlocked.
            </p>

            <label className="form-field">
              <span>M-Pesa transaction code *</span>
              <input
                required
                minLength={4}
                maxLength={80}
                value={paymentReference}
                onChange={(event) =>
                  setPaymentReference(event.target.value.toUpperCase())
                }
                placeholder="e.g. QWE123ABC"
              />
            </label>

            <button className="button button-primary" disabled={saving}>
              {saving ? "Submitting…" : "Submit payment reference"}
            </button>
          </form>
        )}
      </section>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <div className="opportunities-toolbar">
        <label className="form-field">
          <span>Filter opportunities</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="All">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            setShowForm((current) => !current);
            setError("");
          }}
        >
          {showForm ? "Close form" : "+ Share opportunity"}
        </button>
      </div>

      {showForm && (
        <form className="profile-editor opportunity-editor" onSubmit={publish}>
          <h2>Share an opportunity</h2>
          <p className="opportunity-wide small-note">
            Share useful and genuine leads. Add a link, contact information,
            or both. Do not post private information without permission.
          </p>

          <label className="form-field">
            <span>Opportunity title *</span>
            <input
              required
              minLength={3}
              maxLength={140}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder="e.g. Remote customer support jobs"
            />
          </label>

          <label className="form-field">
            <span>Category *</span>
            <select
              value={draft.category}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  category: event.target.value as OpportunityCategory,
                })
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="form-field opportunity-wide">
            <span>Full details *</span>
            <textarea
              required
              minLength={10}
              maxLength={3000}
              rows={5}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder="Explain eligibility, requirements, how to apply and any important details."
            />
          </label>

          <label className="form-field opportunity-wide">
            <span>Application, referral or WhatsApp link</span>
            <input
              type="url"
              maxLength={1500}
              value={draft.link_url}
              onChange={(event) =>
                setDraft({ ...draft, link_url: event.target.value })
              }
              placeholder="https://..."
            />
            <span className="small-note">
              Optional if you provide contact details below.
            </span>
          </label>

          <label className="form-field">
            <span>Deadline (optional)</span>
            <input
              type="date"
              value={draft.deadline}
              onChange={(event) =>
                setDraft({ ...draft, deadline: event.target.value })
              }
            />
          </label>

          <label className="form-field">
            <span>Contact details</span>
            <input
              maxLength={150}
              value={draft.contact}
              onChange={(event) =>
                setDraft({ ...draft, contact: event.target.value })
              }
              placeholder="Email, phone or contact name"
            />
            <span className="small-note">
              Optional if you provide a link above.
            </span>
          </label>

          <div className="opportunity-wide">
            <button className="button button-primary" disabled={saving}>
              {saving ? "Publishing…" : "Share opportunity"}
            </button>
          </div>
        </form>
      )}

      <div className="opportunity-list-heading">
        <h2>Latest opportunities</h2>
        <span>{visible.length} listed</span>
      </div>

      {loading ? (
        <p className="loading-card">Loading opportunities…</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <h3>No opportunities here yet</h3>
          <p>Be the first to share a useful lead with fellow comrades.</p>
        </div>
      ) : (
        <div className="opportunity-grid">
          {visible.map((item) => (
            <article className="opportunity-card" key={item.id}>
              <span className="opportunity-category">{item.category}</span>
              <h3>{item.title}</h3>

              <p>
                {hasAccess
                  ? item.description
                  : "🔒 Full details, links and contact information are available after your KSh 100 payment is approved."}
              </p>

              {hasAccess && item.deadline && (
                <p className="small-note">
                  <strong>Deadline:</strong> {item.deadline}
                </p>
              )}

              {hasAccess && item.contact && (
                <p className="small-note">
                  <strong>Contact:</strong> {item.contact}
                </p>
              )}

              <div className="opportunity-card-footer">
                <span>Shared by {item.author_name}</span>

                {hasAccess && item.link_url ? (
                  <a
                    className="button button-primary"
                    href={item.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open opportunity ↗
                  </a>
                ) : !hasAccess ? (
                  <span className="small-note">Details locked</span>
                ) : (
                  <span className="small-note">Contact details provided above</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="small-note opportunity-safety-note">
        <strong>Stay safe:</strong> Verify organisations and offers before
        sending money or personal documents. Be cautious of requests for
        registration fees, passwords or one-time verification codes. Chuka
        Comrades does not guarantee third-party offers.
      </p>
    </section>
  );
}
