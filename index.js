import { sendNewShifts, thereIsNewShifts } from "./bot.js";
import { getShifts } from "./scraper.js";

import {
  parseData,
  loadData,
  loadDataById,
  saveData,
  deleteUser,
  getAllUsers,
} from "./parser.js";

const URL_LOGIN = "https://part-time.gymbeam.com/web/login";
const USERS_DIR = "./users";
const userIntervals = {};
export const userStates = {};

const ALL_USERS_CHECK_INTERVAL = Number(process.env.TELEGRAM_BOT_ALL_USERS_CHECK_INTERVAL);
if (!ALL_USERS_CHECK_INTERVAL || isNaN(ALL_USERS_CHECK_INTERVAL)) {
  console.error("Error: TELEGRAM_BOT_ALL_USERS_CHECK_INTERVAL must be set and a valid number!");
  process.exit(1);
}

const USER_CHECK_INTERVAL = Number(process.env.TELEGRAM_BOT_USER_CHECK_INTERVAL);
if (!USER_CHECK_INTERVAL || isNaN(USER_CHECK_INTERVAL)) {
  console.error("Error: TELEGRAM_BOT_USER_CHECK_INTERVAL must be set and a valid number!");
  process.exit(1);
}

function startUserInterval(userId) {
  if (userIntervals[userId]) {
    clearInterval(userIntervals[userId]);
  }

  userIntervals[userId] = setInterval(() => {
    if (userStates[userId] !== "stopped") {
      checkUser(userId);
    }
  }, USER_CHECK_INTERVAL);
}

export function stopUserInterval(userId) {
  if (userIntervals[userId]) {
    clearInterval(userIntervals[userId]);
    delete userIntervals[userId];
  }
}


async function checkForAllUsers() {
  const allUsers = getAllUsers(USERS_DIR);

  for (const file of allUsers) {
    const loadedData = loadData(file);
    const userId = loadedData.userId;

    if (userStates[userId] === "stopped") {
      stopUserInterval(userId);
      deleteUser(USERS_DIR, userId);
      continue;
    }

    if (userStates[userId] !== "active") {
      checkUser(userId);
      startUserInterval(userId);
      userStates[userId] = "active";
    }
  }
}

async function checkUser(userId) {
  try {
    const loadedData = loadDataById(USERS_DIR, userId);
    const scrapedData = await getShifts(
      URL_LOGIN,
      loadedData.userEmail,
      loadedData.userPassword
    );
    const parsedData = parseData(scrapedData, loadedData);
    saveData(USERS_DIR, loadedData.userId, parsedData);

    if (thereIsNewShifts(parsedData)) {
      await sendNewShifts(loadedData.userId, parsedData);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkForAllUsers();
setInterval(checkForAllUsers, ALL_USERS_CHECK_INTERVAL);
