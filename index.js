import express from "express";
import { sendNewShifts, thereIsNewShifts } from "./bot.js";
import { getShifts } from "./scraper.js";
import CONFIG from "./config.js";
import fetch from "node-fetch";

import { parseData } from "./parser.js";
import {
  getAllUsers,
  getUserById,
  saveParsedData,
  deleteUserById,
} from "./db.js";

const app = express();
const userIntervals = {};
const inFlight = new Set();
const restDayNames = [
  "Epiphany",
  "Good Friday",
  "Easter Monday",
  "International Workers' Day",
  "Day of victory over fascism",
  "Day of Our Lady of the Seven Sorrows",
  "All Saints’ Day",
  "Christmas Eve",
  "Christmas Day",
  "St. Stephen's Day",
];

export const userStates = {};
export let slovakHolidays = [];

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.status(200).send("Bot is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

async function loadHolidays() {
  const year = new Date().getFullYear();
  const nextYear = year + 1;

  const years = [year, nextYear];
  const allHolidays = [];

  for (const y of years) {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${y}/SK`
    );
    const data = await res.json();
    const restDays = data
      .filter((h) => restDayNames.includes(h.name))
      .map((h) => {
        const d = new Date(h.date);
        return `${String(d.getDate()).padStart(2, "0")}.${String(
          d.getMonth() + 1
        ).padStart(2, "0")}.${d.getFullYear()}`;
      });

    allHolidays.push(...restDays);
  }

  slovakHolidays = allHolidays;
}

export function startUserInterval(userId) {
  if (userIntervals[userId]) {
    clearInterval(userIntervals[userId]);
  }
  checkUser(userId).catch(console.error);
  userIntervals[userId] = setInterval(() => {
    if (userStates[userId] !== "stopped") {
      checkUser(userId).catch(console.error);
    }
  }, CONFIG.USER_CHECK_INTERVAL);
}

export function stopUserInterval(userId) {
  if (userIntervals[userId]) {
    clearInterval(userIntervals[userId]);
    delete userIntervals[userId];
  }
}

async function checkForAllUsers() {
  try {
    const allUsers = await getAllUsers();

    for (const user of allUsers) {
      const userId = user.userId;

      if (userStates[userId] === "stopped") {
        stopUserInterval(userId);
        await deleteUserById(userId);
        continue;
      }

      if (userStates[userId] !== "active") {
        checkUser(userId).catch(console.error);
        startUserInterval(userId);
        userStates[userId] = "active";
      }
    }
  } catch (err) {
    console.error("checkForAllUsers error:", err);
  }
}

export async function checkUser(userId) {
  if (inFlight.has(userId)) return;
  inFlight.add(userId);

  try {
    const loadedData = await getUserById(userId);
    if (!loadedData) {
      stopUserInterval(userId);
      return;
    }

    const scrapedData = await getShifts(
      CONFIG.URL_LOGIN,
      loadedData.userEmail,
      loadedData.userPassword
    );

    const parsedData = parseData(scrapedData, loadedData.parsedData || {});

    await saveParsedData(loadedData.userId, parsedData);

    if (thereIsNewShifts(parsedData)) {
      await sendNewShifts(loadedData.userId, parsedData);
    }
  } catch (err) {
    console.error("checkUser error:", err);
  } finally {
    inFlight.delete(userId);
  }
}

await loadHolidays();

checkForAllUsers();
setInterval(
  () => checkForAllUsers().catch(console.error),
  CONFIG.ALL_USERS_CHECK_INTERVAL
);
