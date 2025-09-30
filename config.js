import dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
if (!BOT_TOKEN) {
  console.error("Error: TELEGRAM_BOT_TOKEN must be set and not empty!");
  process.exit(1);
}

const ALL_USERS_CHECK_INTERVAL = Number(
  process.env.TELEGRAM_BOT_ALL_USERS_CHECK_INTERVAL
);
if (!ALL_USERS_CHECK_INTERVAL || isNaN(ALL_USERS_CHECK_INTERVAL)) {
  console.error(
    "Error: TELEGRAM_BOT_ALL_USERS_CHECK_INTERVAL must be set and a valid number!"
  );
  process.exit(1);
}

const USER_CHECK_INTERVAL = Number(
  process.env.TELEGRAM_BOT_USER_CHECK_INTERVAL
);
if (!USER_CHECK_INTERVAL || isNaN(USER_CHECK_INTERVAL)) {
  console.error(
    "Error: TELEGRAM_BOT_USER_CHECK_INTERVAL must be set and a valid number!"
  );
  process.exit(1);
}

const URL_LOGIN = String(process.env.TELEGRAM_BOT_URL_LOGIN || "").trim();
if (!URL_LOGIN) {
  console.error("Error: URL_LOGIN must be set and not empty!");
  process.exit(1);
}

const USERS_DIR = String(process.env.TELEGRAM_BOT_USERS_DIR || "").trim();
if (!USERS_DIR) {
  console.error("Error: URL_LOGIN must be set and not empty!");
  process.exit(1);
}

const CONFIG = {
  BOT_TOKEN,
  ALL_USERS_CHECK_INTERVAL,
  USER_CHECK_INTERVAL,
  URL_LOGIN,
  USERS_DIR,
};
export default CONFIG;