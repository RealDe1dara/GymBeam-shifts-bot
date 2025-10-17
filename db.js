// database.js
import mysql from "mysql2/promise";
import CONFIG from "./config.js";

const pool = mysql.createPool(process.env.MYSQL_PUBLIC_URL); // or MYSQL_PUBLIC_URL
export default pool;

// const pool = mysql.createPool({
//   host: process.env.MYSQLHOST,
//   user: process.env.MYSQLUSER,
//   password: process.env.MYSQLPASSWORD,
//   database: process.env.MYSQLDATABASE,
//   port: Number(process.env.MYSQLPORT) || 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// export default pool;

// Initialize the table if it doesn't exist
async function initDB() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      userId BIGINT PRIMARY KEY,
      email VARCHAR(255),
      password VARCHAR(255),
      parsedData JSON,
      lastSeen BIGINT
    );
  `;
  await pool.execute(createTableSQL);
}

// Call init at startup
initDB().catch(console.error);

/* -------------------- Prepared / SQL statements -------------------- */
const upsertUserSQL = `
  INSERT INTO users (userId, email, password, lastSeen)
  VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    email = VALUES(email),
    password = VALUES(password),
    lastSeen = VALUES(lastSeen);
`;

const deleteUserSQL = `DELETE FROM users WHERE userId = ?;`;
const getUserSQL = `SELECT * FROM users WHERE userId = ?;`;
const getAllUsersSQL = `SELECT * FROM users;`;
const saveParsedDataSQL = `
  UPDATE users SET parsedData = ?, lastSeen = ? WHERE userId = ?;
`;

/* -------------------- Exports -------------------- */
export async function addOrUpdateUser({ userId, email, password }) {
  await pool.execute(upsertUserSQL, [
    Number(userId),
    String(email),
    String(password),
    Date.now(),
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
    parsedData: row.parsedData || {},
    lastSeen: row.lastSeen,
  };
}

export async function getAllUsers() {
  const [rows] = await pool.execute(getAllUsersSQL);
  return rows.map((row) => ({
    userId: row.userId,
    userEmail: row.email,
    userPassword: row.password,
    parsedData: row.parsedData || {},
    lastSeen: row.lastSeen,
  }));
}

export async function saveParsedData(userId, parsedData) {
  await pool.execute(saveParsedDataSQL, [
    JSON.stringify(parsedData || {}),
    Date.now(),
    Number(userId),
  ]);
}
