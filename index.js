import { sendNewShifts, thereIsNewShifts } from "./bot.js";
import { getShifts } from "./scraper.js";
import CONFIG from "./config.js";

import { parseData } from "./parser.js";
import {
  getAllUsers,
  getUserById,
  saveParsedData,
  deleteUserById,
} from "./db.js";

const userIntervals = {};
const inFlight = new Set();
export const userStates = {};

export function startUserInterval(userId) {
  if (userIntervals[userId]) {
    clearInterval(userIntervals[userId]);
  }

  userIntervals[userId] = setInterval(() => {
    if (userStates[userId] !== "stopped") {
      checkUser(userId);
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
  const allUsers = await getAllUsers();

  for (const user of allUsers) {
    const userId = user.userId;

    if (userStates[userId] === "stopped") {
      stopUserInterval(userId);
      deleteUserById(userId);
      continue;
    }

    if (userStates[userId] !== "active") {
      checkUser(userId);
      startUserInterval(userId);
      userStates[userId] = "active";
    }
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
    console.error("Error:", err);
  } finally {
    inFlight.delete(userId);
  }
}

checkForAllUsers();
setInterval(
  () => checkForAllUsers().catch(console.error),
  CONFIG.ALL_USERS_CHECK_INTERVAL
);
