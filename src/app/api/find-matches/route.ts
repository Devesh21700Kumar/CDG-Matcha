/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { differenceInMinutes, isValid, format } from "date-fns";

/**
 * The "Ultimate Crazy Date Parser" - Handles all the wild date formats from the spreadsheet
 */
function godTierDateParser(
  dateCol: string,
  timeCol: string,
  tabName: string
): Date | null {
  try {
    const combinedStr = `${dateCol || ""} ${timeCol || ""}`.trim();
    if (!combinedStr) return null;

    // --- 1. EXTRACT YEAR, MONTH, AND DAY FROM DATE STRING ---
    let year = new Date().getFullYear();
    let month = -1;
    let day = -1;

    const dateStr = dateCol || "";
    
    // Pattern 1: Full date with dots/spaces "2025. 8. 28", "2025.8.28"
    const fullDateMatch = dateStr.match(/(\d{4})[.\s]*(\d{1,2})[.\s]*(\d{1,2})/);
    if (fullDateMatch) {
      year = parseInt(fullDateMatch[1], 10);
      month = parseInt(fullDateMatch[2], 10) - 1; // Convert to 0-indexed
      day = parseInt(fullDateMatch[3], 10);
    } else {
      // Pattern 2: Full date with slashes "01/09/2025"
      const slashDateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slashDateMatch) {
        day = parseInt(slashDateMatch[1], 10);
        month = parseInt(slashDateMatch[2], 10) - 1; // Convert to 0-indexed
        year = parseInt(slashDateMatch[3], 10);
      } else {
        // Pattern 3: Ordinal dates "15th Friday", "16th Saturday", "13th Wednesday"
        const ordinalMatch = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)/);
        if (ordinalMatch) {
          day = parseInt(ordinalMatch[1], 10);
        } else {
          // Pattern 4: Day + Month "28 Aug", "27 Aug", "31 August"
          const dayMonthMatch = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i);
          if (dayMonthMatch) {
            day = parseInt(dayMonthMatch[1], 10);
            const monthStr = dayMonthMatch[2].toLowerCase();
            const monthMap: { [key: string]: number } = {
              'jan': 0, 'january': 0,
              'feb': 1, 'february': 1,
              'mar': 2, 'march': 2,
              'apr': 3, 'april': 3,
              'may': 4,
              'jun': 5, 'june': 5,
              'jul': 6, 'july': 6,
              'aug': 7, 'august': 7,
              'sep': 8, 'september': 8,
              'oct': 9, 'october': 9,
              'nov': 10, 'november': 10,
              'dec': 11, 'december': 11
            };
            month = monthMap[monthStr] || -1;
          } else {
            // Pattern 5: Just day number "28"
            const dayOnlyMatch = dateStr.match(/^(\d{1,2})$/);
            if (dayOnlyMatch) {
              day = parseInt(dayOnlyMatch[1], 10);
            }
          }
        }
      }
    }

    // If we couldn't extract month from date string, try to get it from tab name
    if (month === -1) {
      if (tabName.toLowerCase().includes("august")) {
        month = 7; // 0-indexed
      } else if (tabName.toLowerCase().includes("september")) {
        month = 8; // 0-indexed
      }
    }

    // Validate that we have all required components
    if (month === -1 || day === -1) return null;

    // --- 2. EXTRACT AND NORMALIZE THE TIME ---
    let hour = 0,
      minute = 0;
    const timeStr = combinedStr
      .replace(/오전/g, "AM")
      .replace(/오후/g, "PM")
      .toUpperCase();

    // Pattern 1: 24-hour format "13:00", "14:00", "16:30"
    const hhmm24Match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (hhmm24Match) {
      hour = parseInt(hhmm24Match[1], 10);
      minute = parseInt(hhmm24Match[2], 10);
      // If it's 24-hour format and hour >= 12, it's PM
      if (hour >= 12 && hour < 24) {
        if (hour > 12) hour -= 12; // Convert to 12-hour format
      }
    } else {
      // Pattern 2: 12-hour format with AM/PM "AM 7:55", "PM 16:30", "AM 08:30"
      const amPmMatch = timeStr.match(/(AM|PM)\s*(\d{1,2}):(\d{2})/);
      if (amPmMatch) {
        hour = parseInt(amPmMatch[2], 10);
        minute = parseInt(amPmMatch[3], 10);
        if (amPmMatch[1] === "PM" && hour < 12) {
          hour += 12;
        }
      } else {
        // Pattern 3: Simple AM/PM format "11 AM", "7 AM", "PM 3:20"
        const simpleAmPmMatch = timeStr.match(/(\d{1,2})\s*(AM|PM)/);
        if (simpleAmPmMatch) {
          hour = parseInt(simpleAmPmMatch[1], 10);
          if (simpleAmPmMatch[2] === "PM" && hour < 12) {
            hour += 12;
          }
        } else {
          // Pattern 4: Korean time format "오전 10:30", "오후 2:25"
          const koreanMatch = timeStr.match(/(AM|PM)\s*(\d{1,2}):(\d{2})/);
          if (koreanMatch) {
            hour = parseInt(koreanMatch[2], 10);
            minute = parseInt(koreanMatch[3], 10);
            if (koreanMatch[1] === "PM" && hour < 12) {
              hour += 12;
            }
          } else {
            // Pattern 5: Decimal time format "13.15", "9.15"
            const decimalMatch = timeStr.match(/(\d{1,2})\.(\d{2})/);
            if (decimalMatch) {
              hour = parseInt(decimalMatch[1], 10);
              minute = parseInt(decimalMatch[2], 10);
              // Assume it's 24-hour format if hour >= 12
              if (hour >= 12 && hour < 24) {
                if (hour > 12) hour -= 12;
              }
            } else {
              return null; // No recognizable time format found
            }
          }
        }
      }
    }

    // --- 3. CONSTRUCT THE FINAL DATE ---
    // JavaScript's Date constructor uses 0-indexed months
    const finalDate = new Date(year, month, day, hour, minute);

    return isValid(finalDate) ? finalDate : null;
  } catch (e: any) {
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
      spreadsheetId: process.env.SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES,
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
      spreadsheetId: process.env.SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES,
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
