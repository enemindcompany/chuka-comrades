import { useState } from "react";

const initialTeams = [
  { name: "Chuka Lions", played: 5, won: 4, drawn: 0, lost: 1, gf: 12, ga: 5 },
  { name: "Campus United", played: 5, won: 3, drawn: 1, lost: 1, gf: 9, ga: 5 },
  { name: "Comrades FC", played: 5, won: 2, drawn: 2, lost: 1, gf: 8, ga: 6 },
  { name: "Hostel Rangers", played: 5, won: 1, drawn: 1, lost: 3, gf: 5, ga: 10 },
];

const fixtures = [
  { home: "Chuka Lions", away: "Campus United", date: "To be announced" },
  { home: "Comrades FC", away: "Hostel Rangers", date: "To be announced" },
  { home: "Campus United", away: "Comrades FC", date: "To be announced" },
];

export default function PremierLeague() {
  const [tab, setTab] = useState("table");
  const teams = [...initialTeams].sort((a, b) => {
    const pointsA = a.won * 3 + a.drawn;
    const pointsB = b.won * 3 + b.drawn;
    return pointsB - pointsA || (b.gf - b.ga) - (a.gf - a.ga);
  });

  return (
    <section className="feature-page">
      <div className="homepage-heading">
        <span className="eyebrow">CAMPUS FOOTBALL</span>
        <h2>🏆 Chuka Premier League</h2>
        <p>Follow campus teams, standings and upcoming fixtures.</p>
      </div>

      <p className="form-feedback">
        Demo content only — these teams, statistics and fixtures are examples,
        not verified official league results.
      </p>

      <div className="league-tabs">
        <button className={tab === "table" ? "active" : ""} onClick={() => setTab("table")}>
          Standings
        </button>
        <button className={tab === "fixtures" ? "active" : ""} onClick={() => setTab("fixtures")}>
          Fixtures
        </button>
      </div>

      {tab === "table" ? (
        <div className="league-table-wrap">
          <table className="league-table">
            <thead>
              <tr>
                <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th>
                <th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => (
                <tr key={team.name}>
                  <td>{index + 1}</td>
                  <td>{team.name}</td>
                  <td>{team.played}</td>
                  <td>{team.won}</td>
                  <td>{team.drawn}</td>
                  <td>{team.lost}</td>
                  <td>{team.gf}</td>
                  <td>{team.ga}</td>
                  <td>{team.gf - team.ga}</td>
                  <td><strong>{team.won * 3 + team.drawn}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="feature-grid">
          {fixtures.map((fixture, index) => (
            <article className="feature-card" key={index}>
              <span className="feature-icon">⚽</span>
              <h3>{fixture.home} vs {fixture.away}</h3>
              <p>{fixture.date}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
