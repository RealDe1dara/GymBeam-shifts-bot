function shiftKey(s) {
  if (!s) return "";
  const date = (s.date || "").trim();
  const from = (s.time_from || "").trim();
  const to = (s.time_to || "").trim();
  const resp = (s.responsible || "").trim();
  return `${date}|${from}|${to}|${resp}`;
}

export function parseData(allShifts, oldData) {
  const invitedShifts = (allShifts && allShifts.invitedShifts) || [];
  const scheduledShifts = (allShifts && allShifts.scheduledShifts) || [];

  const prevOld = (oldData && oldData.oldShifts) || [];
  const prevNew = (oldData && oldData.newShifts) || [];

  const previouslySeen = [...prevOld, ...prevNew];

  const currentKeys = new Set(invitedShifts.map(shiftKey));
  const oldShifts = previouslySeen.filter((s) => currentKeys.has(shiftKey(s)));

  const oldKeys = new Set(oldShifts.map(shiftKey));
  const newShifts = invitedShifts.filter((s) => !oldKeys.has(shiftKey(s)));

  return {
    oldShifts,
    newShifts,
    scheduledShifts,
    oldShiftsCount: oldShifts.length,
    newShiftsCount: newShifts.length,
    scheduledShiftsCount: (scheduledShifts || []).length,
  };
}
