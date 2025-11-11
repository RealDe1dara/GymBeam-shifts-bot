import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(poolConfig);
export default pool;

async function initDB() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      userId BIGINT PRIMARY KEY,
      email VARCHAR(255),
      password VARCHAR(255),
      parsedData JSON
    );
  `;

  await pool.execute(createTableSQL);
  console.log("Db init");
}

initDB().catch(console.error);

const upsertUserSQL = `
  INSERT INTO users (userId, email, password, parsedData)
  VALUES (?, ?, ?, '{}')
  ON DUPLICATE KEY UPDATE
    email = VALUES(email),
    password = VALUES(password);
`;

const deleteUserSQL = `DELETE FROM users WHERE userId = ?;`;
const getUserSQL = `SELECT * FROM users WHERE userId = ?;`;
const getAllUsersSQL = `SELECT * FROM users;`;
const saveParsedDataSQL = `
  UPDATE users
  SET parsedData = CAST(? AS JSON)
  WHERE userId = ?
`;

function toParsedObject(val) {
  if (val == null) return {};
  if (Buffer.isBuffer(val)) {
    try {
      return JSON.parse(val.toString("utf8"));
    } catch {
      return {};
    }
  }
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

export async function addOrUpdateUser({ userId, email, password }) {
  await pool.execute(upsertUserSQL, [
    Number(userId),
    String(email),
    String(password),
  ]);
}

export async function deleteUserById(userId) {
  await pool.execute(deleteUserSQL, [Number(userId)]);
}

export async function getUserById(userId) {
  const [rows] = await pool.execute(getUserSQL, [Number(userId)]);
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    userId: row.userId,
    userEmail: row.email,
    userPassword: row.password,
    parsedData: toParsedObject(row.parsedData),
  };
}

export async function getAllUsers() {
  const [rows] = await pool.execute(getAllUsersSQL);
  return rows.map((row) => ({
    userId: row.userId,
    userEmail: row.email,
    userPassword: row.password,
    parsedData: toParsedObject(row.parsedData),
  }));
}

export async function saveParsedData(userId, parsedData) {
  const clean = sanitizeParsedData(parsedData);
  const [res] = await pool.execute(saveParsedDataSQL, [
    JSON.stringify(clean),
    Number(userId),
  ]);
}
