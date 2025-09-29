import TelegramBot from "node-telegram-bot-api";
import puppeteer from "puppeteer";
import { siteLogin } from "./scraper.js";
import { deleteUser, saveData, loadDataById } from "./parser.js";
import { stopUserInterval, userStates } from "./index.js";

const URL_LOGIN = "https://part-time.gymbeam.com/web/login";
const USERS_DIR = "./users";

if (process.env.TELEGRAM_BOT_TOKEN === undefined) {
  console.log("Error: can't start the bot. Token is undefined");
  process.exit(1);
}
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
export default bot;

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
      text += `${i + 1}) ${shift.date} 🕒 ${shift.time_from}-${
        shift.time_to
      }\n       ${shift.responsible}.\n`;
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
      text += `${i + 1}) ${shift.date} 🕒 ${shift.time_from}-${
        shift.time_to
      }\n       ${shift.responsible}.\n`;
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
      text += `${i + 1}) ${shift.date} 🕒 ${shift.time_from}-${
        shift.time_to
      }\n       ${shift.responsible}.\n`;
    });
  } else {
    text += "❌ You have no scheduled shifts ❌";
  }
  return text;
}

export async function sendNewShifts(userId, parsedData) {
  const message = getNewShiftsMessage(parsedData);
  try {
    await bot.sendMessage(userId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📅 Old", callback_data: "send_old_shifts" },
            {
              text: "📌 Scheduled",
              callback_data: "send_scheduled_shifts",
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

async function isValidPersonalData(userEmail, userPassword) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await siteLogin(URL_LOGIN, userEmail, userPassword, page);
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
  userStates[userId] = { step: "email" };
  bot.sendMessage(userId, "👋 Hello! Enter your email:");
});

bot.on("message", async (msg) => {
  const userId = msg.chat.id;
  const state = userStates[userId];
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
      saveData(USERS_DIR, userId, {
        userId,
        userEmail: state.email,
        userPassword: state.password,
      });
      delete userStates[userId];
    } else {
      bot.sendMessage(userId, "❌ Wrong data, try again. Enter email:");
      state.step = "email";
    }
  }
});

bot.onText(/\/stop/, (msg) => {
  const userId = msg.chat.id;
  
  userStates[userId] = "stopped";
  stopUserInterval(userId);
  deleteUser(USERS_DIR, userId);
  bot.sendMessage(
    userId,
    "👋 Thanks for using this bot! Your personal data was deleted! Bye!"
  );
});

bot.on("callback_query", async (query) => {
  const userId = query.from.id;
  const userData = loadDataById(USERS_DIR, userId);

  if (query.data === "send_old_shifts") {
    const oldShiftsMessage = getOldShiftsMessage(userData);
    await bot.sendMessage(userId, oldShiftsMessage);
  }

  if (query.data === "send_scheduled_shifts") {
    const scheduledShiftsMessage = getScheduledShiftsMessage(userData);
    await bot.sendMessage(userId, scheduledShiftsMessage);
  }

  await bot.answerCallbackQuery(query.id);
});
