import { sendNewShifts, thereIsNewShifts } from "./bot.js";
import { getShifts } from "./scraper.js";
import CONFIG from "./config.js";

import {
  parseData,
  loadData,
  loadDataById,
  saveData,
  deleteUser,
  getAllUsers,
} from "./parser.js";

const userIntervals = {};
export const userStates = {};



function startUserInterval(userId) {
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
  const allUsers = getAllUsers(CONFIG.USERS_DIR);

  for (const file of allUsers) {
    const loadedData = loadData(file);
    const userId = loadedData.userId;

    if (userStates[userId] === "stopped") {
      stopUserInterval(userId);
      deleteUser(CONFIG.USERS_DIR, userId);
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
    const loadedData = loadDataById(CONFIG.USERS_DIR, userId);
    const scrapedData = await getShifts(
      CONFIG.URL_LOGIN,
      loadedData.userEmail,
      loadedData.userPassword
    );
    const parsedData = parseData(scrapedData, loadedData);
    saveData(CONFIG.USERS_DIR, loadedData.userId, parsedData);

    if (thereIsNewShifts(parsedData)) {
      await sendNewShifts(loadedData.userId, parsedData);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkForAllUsers();
setInterval(checkForAllUsers, CONFIG.ALL_USERS_CHECK_INTERVAL);
