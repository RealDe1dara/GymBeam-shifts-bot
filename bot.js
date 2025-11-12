import TelegramBot from "node-telegram-bot-api";
import CONFIG from "./config.js";
import puppeteer from "puppeteer";
import { executablePath } from "puppeteer";
import { siteLogin } from "./scraper.js";
import {
  addOrUpdateUser,
  saveParsedData,
  deleteUserById,
  getUserById,
} from "./db.js";
import {
  slovakHolidays,
  startUserInterval,
  stopUserInterval,
  userStates,
} from "./index.js";

const bot = new TelegramBot(CONFIG.BOT_TOKEN, {
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.code, error.message);
});

bot.on("error", (error) => {
  console.error("Telegram bot error:", error);
});

const sessions = Object.create(null);

function isCommandMessage(msg) {
  return typeof msg.text === "string" && msg.text.startsWith("/");
}

function isRegistering(userId) {
  const step = sessions[userId]?.step;
  return step === "email" || step === "password";
}

function blockIfRegistering(msg) {
  const userId = msg.chat.id;
  if (isRegistering(userId)) {
    bot.sendMessage(
      userId,
      "Please finish registration first. Send /stop to cancel."
    );
    return true;
  }
  return false;
}

async function isRegistered(userId) {
  try {
    const row = await getUserById(userId);
    return !!row;
  } catch (e) {
    console.error("isRegistered failed:", e);
    return false;
  }
}

async function blockIfUnregistered(userId) {
  if (!(await isRegistered(userId))) {
    await bot.sendMessage(
      userId,
      "You are not registered yet. Send /start to register."
    );
    return true;
  }
  return false;
}

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
  if (!thereIsNewShifts(parsedData)) {
    return "❌ You have no new shifts ❌";
  }

  let text = `✨ New ${parsedData.newShiftsCount} Shifts\n\n`;

  const sortedShifts = sortShiftsByDate(parsedData.newShifts);

  const shiftsByDate = {};
  sortedShifts.forEach((shift) => {
    if (!shiftsByDate[shift.date]) shiftsByDate[shift.date] = [];
    shiftsByDate[shift.date].push(shift);
  });

  for (const date of Object.keys(shiftsByDate)) {
    const day = getDayOfWeek(date);
    text += `${date} (${day})`;
    text += slovakHolidays.includes(date) ? " 🎉 Holiday!\n" : "\n";

    shiftsByDate[date].forEach((shift) => {
      const status = shift.allowed ? "" : "❌";
      text += `🪓 ${shift.time_from}–${shift.time_to} | ${shift.responsible} ${status}\n`;
    });

    text += "\n";
  }

  return text.trim();
}

function getOldShiftsMessage(parsedData) {
  if (!thereIsOldShifts(parsedData)) {
    return "❌ You have no old shifts ❌";
  }

  let text = `\n📅 Old ${parsedData.oldShiftsCount} Shifts\n\n`;

  const sortedShifts = sortShiftsByDate(parsedData.oldShifts);

  const shiftsByDate = {};
  sortedShifts.forEach((shift) => {
    if (!shiftsByDate[shift.date]) shiftsByDate[shift.date] = [];
    shiftsByDate[shift.date].push(shift);
  });

  for (const date of Object.keys(shiftsByDate)) {
    const day = getDayOfWeek(date);
    text += `${date} (${day})`;
    text += slovakHolidays.includes(date) ? " 🎉 Holiday!\n" : "\n";

    shiftsByDate[date].forEach((shift) => {
      const status = shift.allowed ? "" : "❌";
      text += `🪓 ${shift.time_from}–${shift.time_to} | ${shift.responsible} ${status}\n`;
    });

    text += "\n";
  }

  return text.trim();
}

function getScheduledShiftsMessage(parsedData) {
  if (!thereIsScheduledShifts(parsedData)) {
    return "❌ You have no scheduled shifts ❌";
  }

  let text = `\n📌 Scheduled ${parsedData.scheduledShiftsCount} Shifts\n\n`;

  const sortedShifts = sortShiftsByDate(parsedData.scheduledShifts);

  const shiftsByDate = {};
  sortedShifts.forEach((shift) => {
    if (!shiftsByDate[shift.date]) shiftsByDate[shift.date] = [];
    shiftsByDate[shift.date].push(shift);
  });

  for (const date of Object.keys(shiftsByDate)) {
    const day = getDayOfWeek(date);
    text += `${date} (${day})`;
    text += slovakHolidays.includes(date) ? " 🎉 Holiday!\n" : "\n";

    shiftsByDate[date].forEach((shift) => {
      const status = shift.allowed ? "" : "❌";
      text += `🪓 ${shift.time_from}–${shift.time_to} | ${shift.responsible} ${status}\n`;
    });

    text += "\n";
  }

  return text.trim();
}

function sortShiftsByDate(shifts) {
  return shifts.slice().sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split(".").map(Number);
    const [dayB, monthB, yearB] = b.date.split(".").map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateA - dateB;
  });
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
    const isLoggedIn = page.url().includes("/news");
    return isLoggedIn;
  } catch (err) {
    console.error("Login check failed:", err);
    return false;
  } finally {
    await browser.close();
  }
}

await bot.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "stop", description: "Stop receiving updates" },
  { command: "help", description: "Show existing commands" },
  { command: "new", description: "Show new shifts" },
  { command: "old", description: "Show old shifts" },
  { command: "scheduled", description: "Show scheduled shifts" },
]);

bot.onText(/\/new/, async (msg) => {
  const userId = msg.chat.id;
  if (blockIfRegistering(msg)) return;
  if (await blockIfUnregistered(userId)) return;
  const userRow = await getUserById(userId);
  const userData = userRow ? userRow.parsedData || {} : {};
  await bot.sendMessage(userId, getNewShiftsMessage(userData), {
    reply_markup: {
      inline_keyboard: [[{ text: "Take Shifts", url: CONFIG.URL_LOGIN }]],
    },
  });
});

bot.onText(/\/old/, async (msg) => {
  const userId = msg.chat.id;
  if (blockIfRegistering(msg)) return;
  if (await blockIfUnregistered(userId)) return;
  const userRow = await getUserById(userId);
  const userData = userRow ? userRow.parsedData || {} : {};
  await bot.sendMessage(userId, getOldShiftsMessage(userData), {
    reply_markup: {
      inline_keyboard: [[{ text: "Take Shifts", url: CONFIG.URL_LOGIN }]],
    },
  });
});

bot.onText(/\/scheduled/, async (msg) => {
  const userId = msg.chat.id;
  if (blockIfRegistering(msg)) return;
  if (await blockIfUnregistered(userId)) return;
  const userRow = await getUserById(userId);
  const userData = userRow ? userRow.parsedData || {} : {};
  await bot.sendMessage(userId, getScheduledShiftsMessage(userData), {
    reply_markup: {
      inline_keyboard: [[{ text: "Take Shifts", url: CONFIG.URL_LOGIN }]],
    },
  });
});

bot.onText(/\/help/, async (msg) => {
  const userId = msg.chat.id;
  if (blockIfRegistering(msg)) return;
  await bot.sendMessage(
    userId,
    "Available commands:\n/start - Start the bot\n/stop - Stop the bot\n/new - Show new shifts\n/old - Show old shifts\n/scheduled - Show scheduled shifts"
  );
});

bot.onText(/\/start/, async (msg) => {
  const userId = msg.chat.id;
  if (blockIfRegistering(msg)) return;

  try {
    const existing = await getUserById(userId);
    if (existing) {
      userStates[userId] = "active";
      startUserInterval(userId);
      await bot.sendMessage(
        userId,
        "✅ You are already registered. Use /stop to remove your data."
      );
      return;
    }
  } catch (e) {
    console.error("start: getUserById failed:", e);
  }

  sessions[userId] = { step: "email" };
  await bot.sendMessage(userId, "👋 Welcome! Please enter your email:");
});

bot.on("message", async (msg) => {
  const userId = msg.chat.id;
  const state = sessions[userId];
  if (!state) return;

  if (!msg.text || isCommandMessage(msg)) return;

  if (state.step === "email") {
    state.email = msg.text;
    state.step = "password";
    await bot.sendMessage(userId, "Enter your password:");
  } else if (state.step === "password") {
    state.password = msg.text;

    try {
      await bot.sendMessage(userId, "⏳ Validating your data ...");
      const ok = await isValidPersonalData(state.email, state.password);
      if (!ok) {
        await bot.sendMessage(
          userId,
          "❌ Login failed. Please re-enter your email:"
        );
        sessions[userId] = { step: "email" };
        return;
      }
    } catch (e) {
      console.error("isValidPersonalData failed:", e);
      await bot.sendMessage(
        userId,
        "⚠️ Couldn’t verify right now. Please re-enter your email:"
      );
      sessions[userId] = { step: "email" };
      return;
    }

    const existing = await getUserById(userId).catch((e) => {
      console.error("password step: getUserById failed:", e);
      return null;
    });
    if (existing) {
      userStates[userId] = "active";
      startUserInterval(userId);
      await bot.sendMessage(userId, "✅ You are already registered.");
      delete sessions[userId];
      return;
    }

    try {
      await addOrUpdateUser({
        userId,
        email: state.email,
        password: state.password,
      });
      await saveParsedData(userId, {
        oldShifts: [],
        newShifts: [],
        scheduledShifts: [],
        oldShiftsCount: 0,
        newShiftsCount: 0,
        scheduledShiftsCount: 0,
      });

      startUserInterval(userId);
      userStates[userId] = "active";

      await bot.sendMessage(
        userId,
        "✅ Registered! I will start checking your shifts."
      );
    } catch (e) {
      console.error("Registration failed for userId:", userId, e);
      await bot.sendMessage(
        userId,
        "❌ Failed to save your data: " + e.message
      );
    } finally {
      delete sessions[userId];
    }
  }
});

bot.onText(/\/stop/, async (msg) => {
  const userId = msg.chat.id;
  userStates[userId] = "stopped";
  stopUserInterval(userId);
  await deleteUserById(userId).catch(() => {});
  delete sessions[userId];
  await bot.sendMessage(userId, "Registration cancelled and data removed.");
});

bot.on("callback_query", async (query) => {
  const userId = query.from.id;
  if (await blockIfUnregistered(userId)) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

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
