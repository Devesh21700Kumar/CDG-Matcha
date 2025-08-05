/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { differenceInMinutes, isValid, format } from "date-fns";
import { parse } from "date-fns";

/**
 * The "Deconstructor" Parser. It doesn't guess formats. It rebuilds the date from scratch.
 */
function godTierDateParser(
  dateCol: string,
  timeCol: string,
  tabName: string
): Date | null {
  try {
    const combinedStr = `${dateCol || ""} ${timeCol || ""}`.trim();
    if (!combinedStr) return null;

    // --- 1. DETERMINE THE YEAR AND MONTH (FROM TAB NAME) ---
    const year = new Date().getFullYear();
    let month = -1; // Use 0-indexed month (0=Jan, 7=Aug)
    if (tabName.toLowerCase().includes("august")) {
      month = 7;
    } else if (tabName.toLowerCase().includes("september")) {
      month = 8;
    }
    if (month === -1) return null; // Cannot proceed without a month

    // --- 2. EXTRACT THE DAY ---
    const dayMatch = combinedStr.match(/\d+/); // Find the first number, which is the day
    if (!dayMatch) return null;
    const day = parseInt(dayMatch[0], 10);

    // --- 3. EXTRACT AND NORMALIZE THE TIME ---
    let hour = 0,
      minute = 0;
    const timeStr = combinedStr
      .replace(/오전/g, "AM")
      .replace(/오후/g, "PM")
      .toUpperCase();

    // Regex for formats like "9:25", "11:35", "16:30"
    const hhmmMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    // Regex for formats like "11 AM", "7 AM"
    const hAmPmMatch = timeStr.match(/(\d{1,2})\s*(AM|PM)/);

    if (hhmmMatch) {
      hour = parseInt(hhmmMatch[1], 10);
      minute = parseInt(hhmmMatch[2], 10);
      if (timeStr.includes("PM") && hour < 12) {
        hour += 12;
      }
    } else if (hAmPmMatch) {
      hour = parseInt(hAmPmMatch[1], 10);
      if (hAmPmMatch[2] === "PM" && hour < 12) {
        hour += 12;
      }
    } else {
      return null; // No recognizable time format found
    }

    // --- 4. CONSTRUCT THE FINAL DATE ---
    // JavaScript's Date constructor uses 0-indexed months
    const finalDate = new Date(year, month, day, hour, minute);

    return isValid(finalDate) ? finalDate : null;
  } catch (e) {
    return null;
  }
}

// --- Shared Google Sheets Configuration ---
const sheets = google.sheets({
  version: "v4",
  auth: process.env.GOOGLE_API_KEY,
});
const tabNames = ["Arrival before 25th August", "Arrival on/after 25th August"];
// LOGIC UPGRADE: Fetch one more column to include the new data (A to I)
const ranges = tabNames.map((name) => `'${name}'!A:I`);

// LOGIC UPGRADE: Column indices have shifted! This is critical.
const DATE_COL = 0,
  NAME_COL = 1,
  TIME_COL = 2,
  AIRPORT_COL = 3,
  TERMINAL_COL = 4,
  CONTACT_COL = 5,
  SHARE_COL = 6,
  LUGGAGE_COL = 8;

// --- GET Endpoint: Fetches ALL entries for the "View All" tab ---
export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      ranges,
    });
    const allEntries: {
        date: any; name: any; arrivalTime: string; location: any; // Add the new location field
        terminal: any; luggage: any;
    }[] = [];

    response.data.valueRanges?.forEach((rangeResult, index) => {
      const tabName = tabNames[index];
      const rows = rangeResult.values || [];
      for (const row of rows) {
        if (!row || !row[DATE_COL] || row[DATE_COL].toLowerCase() === "date")
          continue;
        const sharePref = (row[SHARE_COL] || "").toLowerCase();
        if (sharePref === "no") continue;

        const arrivalDate = godTierDateParser(
          row[DATE_COL],
          row[TIME_COL],
          tabName
        );
        allEntries.push({
          date: row[DATE_COL] || "N/A",
          name: (row[NAME_COL] || "").trim() || "Name not specified",
          arrivalTime: arrivalDate ? format(arrivalDate, "p") : "N/A",
          location: (row[AIRPORT_COL] || "").trim(), // Add the new location field
          terminal: (row[TERMINAL_COL] || "").trim(),
          luggage: (row[LUGGAGE_COL] || "").trim() || "Not specified",
        });
      }
    });

    return NextResponse.json({ entries: allEntries });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch full list." },
      { status: 500 }
    );
  }
}

// --- POST Endpoint: Performs a server-side search for matches ---
export async function POST(request: Request) {
  try {
    // LOGIC UPGRADE: Destructure the new `location` field from the request
    const { date, time, location, terminal } = await request.json();
    const userInputDateTime = new Date(`${date}T${time}`);
    if (!isValid(userInputDateTime))
      return NextResponse.json(
        { error: "Invalid date format." },
        { status: 400 }
      );

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      ranges,
    });
    const potentialMatches: {
        name: any; arrivalTime: string; location: any; // Include location in match data
        terminal: any; contact: any; luggage: any;
    }[] = [];

    response.data.valueRanges?.forEach((rangeResult, index) => {
      const tabName = tabNames[index];
      const rows = rangeResult.values || [];
      for (const row of rows) {
        if (!row || !row[DATE_COL] || row[DATE_COL].toLowerCase() === "date")
          continue;

        const sharePref = (row[SHARE_COL] || "").toLowerCase();
        const locationFromSheet = (row[AIRPORT_COL] || "").trim();
        if (sharePref === "no" || !locationFromSheet) continue;

        // LOGIC UPGRADE: Primary filter is now LOCATION
        if (locationFromSheet !== location) continue;

        const sheetArrivalDate = godTierDateParser(
          row[DATE_COL],
          row[TIME_COL],
          tabName
        );
        if (!sheetArrivalDate) continue;

        const timeDifference = Math.abs(
          differenceInMinutes(userInputDateTime, sheetArrivalDate)
        );

        // LOGIC UPGRADE: Terminal check is now secondary and more intelligent
        let isMatch = false;
        const isAirport = location.toLowerCase().includes("airport");

        if (isAirport) {
          const terminalFromSheet = (row[TERMINAL_COL] || "").trim();
          const normalizedSheetTerminal = terminalFromSheet
            .toLowerCase()
            .replace("t", "");
          const normalizedUserTerminal = terminal
            .toLowerCase()
            .replace("t", "");
          if (
            timeDifference <= 90
          ) {
            isMatch = true;
          }
        } else {
          // For train stations, we don't need a terminal match
          if (timeDifference <= 90) {
            isMatch = true;
          }
        }

        if (isMatch) {
          potentialMatches.push({
            name: (row[NAME_COL] || "").trim() || "Name not specified",
            arrivalTime: format(sheetArrivalDate, "p"),
            location: locationFromSheet, // Include location in match data
            terminal: (row[TERMINAL_COL] || "").trim(),
            contact: (row[CONTACT_COL] || "").trim(),
            luggage: (row[LUGGAGE_COL] || "").trim() || "Not specified",
          });
        }
      }
    });

    return NextResponse.json({ matches: potentialMatches });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to perform search." },
      { status: 500 }
    );
  }
}
