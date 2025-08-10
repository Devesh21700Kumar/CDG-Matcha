/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, FormEvent } from "react";
import styles from "./page.module.css";

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  // LOGIC UPGRADE: Add state for the new location and terminal fields
  const [location, setLocation] = useState("CDG Airport"); // Default to the most common option
  const [terminal, setTerminal] = useState("");

  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [allEntries, setAllEntries] = useState<AllEntriesData[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"search" | "all">("search");

  // Data fetching (GET on load)
  useEffect(() => {
    const fetchAllEntries = async () => {
      setIsListLoading(true);
      try {
        const response = await fetch("/api/find-matches");
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

  // Handle the search form submission
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
        // LOGIC UPGRADE: Send the new `location` field in the payload
        body: JSON.stringify({ date, time, location, terminal }),
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

  const isTerminalRequired = location.toLowerCase().includes("airport");

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Find Your Airport & Station Cab Share</h1>
      </div>

      {/* Add this new section */}
      <div className={styles.dataSourceInfo}>
        <div className={styles.infoCard}>
          <h3>📋 How to Add Your Details</h3>
          <p>
            This platform uses data from a shared Google Sheets document. To
            help others find you, please add your arrival details to our data
            source.
          </p>
          <a
            href={`https://docs.google.com/spreadsheets/d/${process.env.SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES}/edit#gid=0`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sheetsLink}
          >
            🚗 Add Your Arrival Details to Google Sheets
          </a>
        </div>
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

            {/* --- NEW UI: Location Dropdown --- */}
            <div className={styles.inputGroup}>
              <label htmlFor="location">Airport / Station</label>
              <select
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              >
                <option value="CDG Airport">CDG Airport</option>
                <option value="Orly Airport">Orly Airport</option>
                <option value="Versailles-Chantiers train station">
                  Versailles-Chantiers
                </option>
                <option value="Gare du Nord train station">Gare du Nord</option>
              </select>
            </div>

            {/* --- NEW UI: Conditionally show Terminal input --- */}
            {isTerminalRequired && (
              <div className={styles.inputGroup}>
                <label htmlFor="terminal">Terminal</label>
                <input
                  type="text"
                  id="terminal"
                  placeholder="e.g., 2E, T1"
                  value={terminal}
                  onChange={(e) => setTerminal(e.target.value)}
                  required={isTerminalRequired}
                />
              </div>
            )}

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
                    <strong>Location:</strong> {match.location}
                  </p>
                  <p>
                    <strong>Arrives at:</strong> {match.arrivalTime}
                  </p>
                  {match.terminal && (
                    <p>
                      <strong>Terminal:</strong> {match.terminal}
                    </p>
                  )}
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
              {/* --- NEW UI: Add Location to table header --- */}
              <th>Location</th>
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
                {/* --- NEW UI: Add Location to table body --- */}
                <td>{entry.location}</td>
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
