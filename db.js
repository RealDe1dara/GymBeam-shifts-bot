import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "bot.db"));

function initDB() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      email TEXT,
      password TEXT,
      parsedData TEXT DEFAULT '{}'
    )
  `;
  db.prepare(createTableSQL).run();
  console.log("DB initialized with better-sqlite3");
}

initDB();

function toParsedObject(val) {
  if (!val) return {};
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  if (typeof val === "object") return val;
  return {};
}

function sanitizeParsedData(pd) {
  const src = pd || {};
  return {
    oldShifts: src.oldShifts || [],
    newShifts: src.newShifts || [],
    scheduledShifts: src.scheduledShifts || [],
    oldShiftsCount: Number(src.oldShiftsCount || 0),
    newShiftsCount: Number(src.newShiftsCount || 0),
    scheduledShiftsCount: Number(src.scheduledShiftsCount || 0),
  };
}

const insertOrUpdateUserStmt = db.prepare(`
  INSERT INTO users (userId, email, password, parsedData)
  VALUES (?, ?, ?, '{}')
  ON CONFLICT(userId) DO UPDATE SET
    email = excluded.email,
    password = excluded.password
`);

const deleteUserStmt = db.prepare(`DELETE FROM users WHERE userId = ?`);
const getUserStmt = db.prepare(`SELECT * FROM users WHERE userId = ?`);
const getAllUsersStmt = db.prepare(`SELECT * FROM users`);
const saveParsedDataStmt = db.prepare(`
  UPDATE users SET parsedData = ? WHERE userId = ?
`);

export async function addOrUpdateUser({ userId, email, password }) {
  insertOrUpdateUserStmt.run(String(userId), String(email), String(password));
}

export async function deleteUserById(userId) {
  deleteUserStmt.run(String(userId));
}

export async function getUserById(userId) {
  const row = getUserStmt.get(String(userId));
  if (!row) return null;
  return {
    userId: row.userId,
    userEmail: row.email,
    userPassword: row.password,
    parsedData: toParsedObject(row.parsedData),
  };
}

export async function getAllUsers() {
  return getAllUsersStmt.all().map((row) => ({
    userId: row.userId,
    userEmail: row.email,
    userPassword: row.password,
    parsedData: toParsedObject(row.parsedData),
  }));
}

export async function saveParsedData(userId, parsedData) {
  const clean = sanitizeParsedData(parsedData);
  saveParsedDataStmt.run(JSON.stringify(clean), String(userId));
}
