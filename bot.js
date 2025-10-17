import TelegramBot from "node-telegram-bot-api";
import puppeteer, { executablePath } from "puppeteer";
import { siteLogin } from "./scraper.js";
import { parseData } from "./parser.js";
import {
  addOrUpdateUser,
  getUserById,
  deleteUserById,
  saveParsedData,
} from "./db.js";
import CONFIG from "./config.js";

const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });

// keep auth sessions local to bot to avoid circular import
const sessions = Object.create(null);

export function thereIsNewShifts(parsedData) {
  return parsedData?.newShifts?.length > 0;
}

function thereIsScheduledShifts(parsedData) {
  return parsedData?.scheduledShifts?.length > 0;
}

function thereIsOldShifts(parsedData) {
  return parsedData?.oldShifts?.length > 0;
}

function getNewShiftsMessage(parsedData) {
  let text = "";
  if (thereIsNewShifts(parsedData)) {
    text += `\n✨New ${parsedData.newShiftsCount} Shifts:\n`;
    parsedData.newShifts.forEach((shift, i) => {
      const day = getDayOfWeek(shift.date);
      text += `${i + 1}) ${shift.date} 🪓 ${shift.time_from}-${
        shift.time_to
      }\n   ${day} 🔪 ${shift.responsible}.\n`;
    });
  } else {
    text += "❌ You have no new shifts ❌";
  }
  return text;
}

function getOldShiftsMessage(parsedData) {
  let text = "";
  if (thereIsOldShifts(parsedData)) {
    text += `\n📅Old ${parsedData.oldShiftsCount} Shifts:\n`;
    parsedData.oldShifts.forEach((shift, i) => {
      const day = getDayOfWeek(shift.date);
      text += `${i + 1}) ${shift.date} 🪓 ${shift.time_from}-${
        shift.time_to
      }\n   ${day} 🔪 ${shift.responsible}.\n`;
    });
  } else {
    text += "❌ You have no old shifts ❌";
  }
  return text;
}

function getScheduledShiftsMessage(parsedData) {
  let text = "";
  if (thereIsScheduledShifts(parsedData)) {
    text += `\n📌Scheduled ${parsedData.scheduledShiftsCount} Shifts:\n`;
    parsedData.scheduledShifts.forEach((shift, i) => {
      const day = getDayOfWeek(shift.date);
      text += `${i + 1}) ${shift.date} 🪓 ${shift.time_from}-${
        shift.time_to
      }\n   ${day} 🔪 ${shift.responsible}.\n`;
    });
  } else {
    text += "❌ You have no scheduled shifts ❌";
  }
  return text;
}

function getDayOfWeek(dateString) {
  if (!dateString || typeof dateString !== "string") {
    console.warn("getDayOfWeek: invalid dateString =", dateString);
    return "Unknown";
  }
  const [day, month, year] = dateString.split(".").map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return weekdays[date.getDay()];
}

export async function sendNewShifts(userId, parsedData) {
  const message = getNewShiftsMessage(parsedData);
  try {
    await bot.sendMessage(userId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📅 Old", callback_data: "send_old_shifts" },
            { text: "📌 Scheduled", callback_data: "send_scheduled_shifts" },
          ],
          [{ text: "Take Shifts", url: CONFIG.URL_LOGIN }],
        ],
      },
    });
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

async function isValidPersonalData(userEmail, userPassword) {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || (await executablePath()),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--window-size=1920,1080",
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(60000);

  try {
    await siteLogin(CONFIG.URL_LOGIN, userEmail, userPassword, page);
    return page.url().includes("/news");
  } catch (err) {
    console.error("Login check failed:", err);
    return false;
  } finally {
    await browser.close();
  }
}

bot.onText(/\/start/, (msg) => {
  const userId = msg.chat.id;
  sessions[userId] = { step: "email" };
  bot.sendMessage(userId, "👋 Hello! Enter your email:");
});

bot.on("message", async (msg) => {
  const userId = msg.chat.id;
  const state = sessions[userId];
  if (!state) return;

  if (state.step === "email") {
    state.email = msg.text;
    state.step = "password";
    bot.sendMessage(userId, "Enter your password:");
  } else if (state.step === "password") {
    state.password = msg.text;

    const isValid = await isValidPersonalData(state.email, state.password);

    if (isValid) {
      bot.sendMessage(userId, "✅ Logged in successfully!");

      await addOrUpdateUser({
        userId,
        email: state.email,
        password: state.password,
      });

      await saveParsedData(userId, {
        userId,
        userEmail: state.email,
        userPassword: state.password,
        oldShifts: [],
        newShifts: [],
        scheduledShifts: [],
        oldShiftsCount: 0,
        newShiftsCount: 0,
        scheduledShiftsCount: 0,
      });

      delete sessions[userId];
    } else {
      bot.sendMessage(userId, "❌ Wrong data, try again. Enter email:");
      state.step = "email";
    }
  }
});

bot.onText(/\/stop/, async (msg) => {
  const userId = msg.chat.id;
  try {
    await deleteUserById(userId);
    await bot.sendMessage(
      userId,
      "👋 Thanks for using this bot! Your personal data was deleted! Bye!"
    );
  } catch (err) {
    console.error("Error deleting user:", err);
    await bot.sendMessage(userId, "❌ Failed to delete your data.");
  }
});

bot.on("callback_query", async (query) => {
  const userId = query.from.id;
  const userRow = await getUserById(userId);
  const userData = userRow ? userRow.parsedData || {} : {};

  if (query.data === "send_old_shifts") {
    const oldShiftsMessage = getOldShiftsMessage(userData);
    await bot.sendMessage(userId, oldShiftsMessage, {
      reply_markup: {
        inline_keyboard: [[{ text: "Take Shifts", url: CONFIG.URL_LOGIN }]],
      },
    });
  }

  if (query.data === "send_scheduled_shifts") {
    const scheduledShiftsMessage = getScheduledShiftsMessage(userData);
    await bot.sendMessage(userId, scheduledShiftsMessage, {
      reply_markup: {
        inline_keyboard: [[{ text: "Take Shifts", url: CONFIG.URL_LOGIN }]],
      },
    });
  }

  await bot.answerCallbackQuery(query.id);
});
