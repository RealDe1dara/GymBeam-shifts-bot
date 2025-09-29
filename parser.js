import fs, { readdirSync } from "fs";
import path from "path";

export function deleteUser(directory, userId) {
  const filePath = `${directory}/${userId}.json`;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function getAllUsers(directory) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory);
  return readdirSync(directory)
    .filter((file) => {
      const filePath = path.join(directory, file);
      return fs.statSync(filePath).isFile();
    })
    .map((file) => path.join(directory, file));
}

export function saveData(directory, userId, data) {
  try {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(`${directory}/${userId}.json`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing file:", err);
  }
}

export function loadData(file) {
  try {
    const data = fs.readFileSync(file, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

export function loadDataById(directory, userId) {
  try {
    let filePath = `${directory}/${userId}.json`;
    
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

export function parseData(allShifts, oldData) {
  const { invitedShifts, scheduledShifts } = allShifts;

  let oldShifts = oldData.oldShifts || [];
  const previousNewShifts = oldData.newShifts || [];

  oldShifts = oldShifts.concat(previousNewShifts);

  const freshShiftsSet = new Set(invitedShifts.map((s) => JSON.stringify(s)));

  oldShifts = oldShifts.filter((shift) =>
    freshShiftsSet.has(JSON.stringify(shift))
  );

  const oldShiftsSet = new Set(oldShifts.map((s) => JSON.stringify(s)));

  const newShifts = invitedShifts.filter(
    (shift) => !oldShiftsSet.has(JSON.stringify(shift))
  );

  return {
    userId: oldData.userId,
    userEmail: oldData.userEmail,
    userPassword: oldData.userPassword,
    oldShifts,
    newShifts,
    scheduledShifts,
    oldShiftsCount: oldShifts.length,
    newShiftsCount: newShifts.length,
    scheduledShiftsCount: scheduledShifts.length,
  };
}
