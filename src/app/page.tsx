/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, FormEvent } from "react";
import styles from "./page.module.css";

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [terminal, setTerminal] = useState("");

  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [allEntries, setAllEntries] = useState<AllEntriesData[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"search" | "all">("search");

  // --- DATA FETCHING (GET on load, POST on search) ---
  useEffect(() => {
    const fetchAllEntries = async () => {
      setIsListLoading(true);
      try {
        const response = await fetch("/api/find-matches"); // GET request
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not fetch the list.");
        setAllEntries(data.entries);
      } catch (err: any) {
        setListError(err.message);
      } finally {
        setIsListLoading(false);
      }
    };
    fetchAllEntries();
  }, []);

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setMatches([]);
    try {
      const response = await fetch("/api/find-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, terminal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");
      setMatches(data.matches);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Find Your Airport Cab Share</h1>
        <p className={styles.description}>
          Search for a match or view all available entries from the community
          sheet.
        </p>
      </div>
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${
            activeView === "search" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveView("search")}
        >
          Find a Match
        </button>
        <button
          className={`${styles.tabButton} ${
            activeView === "all" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveView("all")}
        >
          View All Entries
        </button>
      </div>
      {activeView === "search" ? (
        <>
          <form onSubmit={handleSearchSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="date">Arrival Date</label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="time">Arrival Time</label>
              <input
                type="time"
                id="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="terminal">Terminal</label>
              <input
                type="text"
                id="terminal"
                placeholder="e.g., 2E, T1"
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className={styles.button}
              disabled={isLoading}
            >
              {isLoading ? "Searching..." : "Find Matches"}
            </button>
          </form>
          <div className={styles.resultsArea}>{renderSearchResults()}</div>
        </>
      ) : (
        <div className={styles.allEntriesContainer}>
          {renderAllEntriesTable()}
        </div>
      )}
    </main>
  );

  function renderSearchResults() {
    if (isLoading) return <div className={styles.spinner}></div>;
    if (error) return <p className={styles.error}>{error}</p>;
    if (hasSearched) {
      if (matches.length > 0) {
        return (
          <>
            <h2 className={styles.resultsTitle}>Potential Matches Found!</h2>
            <ul className={styles.matchList}>
              {matches.map((match, index) => (
                <li key={index} className={styles.matchCard}>
                  <h3>{match.name}</h3>
                  <p>
                    <strong>Arrives at:</strong> {match.arrivalTime}
                  </p>
                  <p>
                    <strong>Terminal:</strong> {match.terminal}
                  </p>
                  <p>
                    <strong>Luggage:</strong> {match.luggage}
                  </p>
                  <p>
                    <strong>Contact:</strong>{" "}
                    <span className={styles.contactInfo}>{match.contact}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        );
      } else {
        return (
          <p className={styles.noResults}>
            No matches found for your criteria.
          </p>
        );
      }
    }
    return null;
  }

  function renderAllEntriesTable() {
    if (isListLoading) return <div className={styles.spinner}></div>;
    if (listError) return <p className={styles.error}>Error: {listError}</p>;
    if (allEntries.length === 0)
      return <p>No shareable entries found in the sheet.</p>;
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Arrival Time</th>
              <th>Contact</th>
              <th>Terminal</th>
              <th>Luggage</th>
            </tr>
          </thead>
          <tbody>
            {allEntries.map((entry, index) => (
              <tr key={index}>
                <td>{entry.date}</td>
                <td>{entry.name}</td>
                <td>{entry.arrivalTime}</td>
                <td>{entry.contact}</td>
                <td>{entry.terminal}</td>
                <td>{entry.luggage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
