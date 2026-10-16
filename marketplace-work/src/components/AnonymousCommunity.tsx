import { useState, type FormEvent } from "react";

type CommunityPost = {
  id: number;
  message: string;
  createdAt: string;
};

export default function AnonymousCommunity() {
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [notice, setNotice] = useState("");

  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();

    if (cleanMessage.length < 3) {
      setNotice("Please write at least 3 characters.");
      return;
    }

    if (cleanMessage.length > 500) {
      setNotice("Posts must be 500 characters or fewer.");
      return;
    }

    setPosts((current) => [
      {
        id: Date.now(),
        message: cleanMessage,
        createdAt: new Date().toLocaleString(),
      },
      ...current,
    ]);

    setMessage("");
    setNotice("Your post was added to this session's feed.");
  }

  function reportPost(id: number) {
    setNotice(
      `Post ${id} flagged in this session. Reporting will need a backend to reach moderators.`,
    );
  }

  return (
    <section className="feature-page">
      <div className="homepage-heading">
        <span className="eyebrow">STUDENT COMMUNITY</span>
        <h2>💗 Anonymous Hookup</h2>
        <p>Share thoughts, meet people and connect respectfully.</p>
      </div>

      <div className="anonymous-notice">
        <strong>Privacy note</strong>
        <p>
          Your name and profile photo are not displayed on these demo posts.
          Posts are only stored in this page's current session and are not sent
          to a server. This demo does not provide verified anonymity or private
          messaging.
        </p>
      </div>

      <form className="anonymous-form" onSubmit={submitPost}>
        <label className="form-field">
          <span>What's on your mind?</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Start a respectful campus conversation..."
            maxLength={500}
            rows={4}
            required
          />
        </label>
        <div className="anonymous-form-footer">
          <span>{message.length}/500</span>
          <button className="button button-primary" type="submit">
            Post anonymously
          </button>
        </div>
      </form>

      {notice && <p className="form-feedback" role="status">{notice}</p>}

      <div className="anonymous-feed">
        <h3>Community feed</h3>
        {posts.length === 0 ? (
          <article className="feature-card">
            <span className="feature-icon">💬</span>
            <p>No posts yet. Start a respectful conversation.</p>
          </article>
        ) : (
          posts.map((post) => (
            <article className="anonymous-post" key={post.id}>
              <div className="anonymous-post-header">
                <strong>Anonymous Comrade</strong>
                <span>{post.createdAt}</span>
              </div>
              <p>{post.message}</p>
              <button
                className="button button-outline"
                type="button"
                onClick={() => reportPost(post.id)}
              >
                Report post
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
