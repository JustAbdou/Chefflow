/**
 * Weekly compliance reporting: opening, closing, fridge temps, delivery temps, cooking/reheating.
 * Checklist rules match DashboardScreen recountOpeningClosing (every definition task has completed === true for that date).
 * Fridge rules mirror FridgeTempLogsScreen.fetchLogs row shape; a fridge counts complete only when both AM and PM have non-empty saved values (same as both period badges showing "logged").
 * Delivery: at least one deliverylogs doc with createdAt on that local day, or deliverydaystatus/{dateKey}.noDelivery === true (DeliveryTempLogsScreen).
 * Cooking/Reheating: at least one coolingreheating doc with createdAt on that local day (CoolingAndReheatingScreen).
 */
import { getLocalDateKey } from "./cleaningHelpers";

/** Number of daily compliance categories counted toward the weekly score. */
export const REPORT_DAILY_CATEGORY_COUNT = 5;

export const REPORT_TASK_LABELS = {
  opening: "Opening checks",
  closing: "Closing checks",
  fridge: "Fridge temperature logs",
  delivery: "Delivery Temps",
  cookingReheating: "Cooking and Reheating",
};

/** Monday 00:00:00 local for the calendar week containing `referenceDate`. */
export function getMondayOfWeek(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Seven local date keys Monday → Sunday for the week starting `weekMonday`. */
export function getWeekDateKeys(weekMonday) {
  const keys = [];
  const d = new Date(weekMonday);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    keys.push(getLocalDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

export function formatShortDayLabel(dateKey) {
  const [y, m, day] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatWeekRangeLabel(weekMonday) {
  const keys = getWeekDateKeys(weekMonday);
  const start = formatShortDayLabel(keys[0]);
  const end = formatShortDayLabel(keys[6]);
  return `${start} – ${end}`;
}

/**
 * @param {Set<string>|string[]} taskIds
 * @param {Record<string, boolean>} logsByTaskId taskId -> completed
 */
export function isChecklistDayComplete(taskIds, logsByTaskId) {
  const ids = taskIds instanceof Set ? [...taskIds] : taskIds;
  if (!ids.length) return true;
  return ids.every((id) => logsByTaskId[id] === true);
}

function docData(docSnap) {
  return typeof docSnap.data === "function" ? docSnap.data() : docSnap;
}

/** @param {unknown} value Firestore Timestamp, Date, or serializable date */
function toJsDate(value) {
  if (value == null) return null;
  try {
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * True if the stored timestamp falls on the same local calendar day as `localDate`.
 * Logs without a parseable createdAt do not match any day (avoids legacy delivery rows counting for every date).
 */
export function isFirestoreTimestampOnLocalDay(tsValue, localDate) {
  const dt = toJsDate(tsValue);
  if (!dt) return false;
  const start = new Date(localDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(localDate);
  end.setHours(23, 59, 59, 999);
  return dt >= start && dt <= end;
}

/**
 * @param {Record<string, boolean|undefined>} noDeliveryByDateKey dateKey -> explicit "No delivery" for that day
 * @param {Iterable<{ data: () => object }>} deliveryLogDocs deliverylogs collection docs
 */
export function isDeliveryTempsDayComplete(localDate, deliveryLogDocs, noDeliveryByDateKey) {
  const dateKey = getLocalDateKey(localDate);
  if (noDeliveryByDateKey && noDeliveryByDateKey[dateKey] === true) return true;

  for (const docSnap of deliveryLogDocs) {
    const data = docData(docSnap);
    if (isFirestoreTimestampOnLocalDay(data.createdAt, localDate)) return true;
  }
  return false;
}

/**
 * @param {Iterable<{ data: () => object }>} coolingReheatingDocs coolingreheating collection docs
 */
export function isCookingReheatingDayComplete(localDate, coolingReheatingDocs) {
  for (const docSnap of coolingReheatingDocs) {
    const data = docData(docSnap);
    if (isFirestoreTimestampOnLocalDay(data.createdAt, localDate)) return true;
  }
  return false;
}

/**
 * @param {Iterable<{ id: string, data: () => object }>} statusDocs deliverydaystatus docs for the week
 * @returns {Record<string, boolean>}
 */
export function buildNoDeliveryByDateKeyFromDocs(statusDocs) {
  const out = {};
  for (const docSnap of statusDocs) {
    const data = docData(docSnap);
    if (data && data.noDelivery === true) out[docSnap.id] = true;
  }
  return out;
}

/**
 * Same fridgelogs → rows logic as FridgeTempLogsScreen.fetchLogs for one day.
 * @param {Date} selectedDate
 * @param {Array<{ id: string, fridgeName: string, fridgeId?: string, fridgeType?: string }>} masterFridges from fetchFridgeListFromFridgelogs(restaurantId, null)
 * @param {Iterable<{ data: () => object }>} fridgelogDocs Firestore docs
 */
export function isFridgeTempsDayComplete(selectedDate, masterFridges, fridgelogDocs) {
  if (!masterFridges || masterFridges.length === 0) return true;

  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const logsByFridgeName = new Map();
  for (const docSnap of fridgelogDocs) {
    const data = docData(docSnap);
    const logDate = data.createdAt;
    const fridgeName = data.fridgeName || data.name || "Unknown Fridge";
    const fridgeKey = fridgeName.toLowerCase();
    let include = false;
    if (!logDate) {
      include = true;
    } else {
      try {
        let logDateTime;
        if (typeof logDate.toDate === "function") logDateTime = logDate.toDate();
        else if (logDate instanceof Date) logDateTime = logDate;
        else logDateTime = new Date(logDate);
        include =
          !isNaN(logDateTime.getTime()) &&
          logDateTime >= startOfDay &&
          logDateTime <= endOfDay;
      } catch {
        include = true;
      }
    }
    if (include) {
      const hasData =
        (data.temperatureAM && String(data.temperatureAM).trim() !== "") ||
        (data.temperaturePM && String(data.temperaturePM).trim() !== "") ||
        data.done === true;
      const existing = logsByFridgeName.get(fridgeKey);
      if (!existing || (hasData && !existing.hasData)) {
        logsByFridgeName.set(fridgeKey, {
          temperatureAM: data.temperatureAM || "",
          temperaturePM: data.temperaturePM || "",
          hasData,
        });
      }
    }
  }

  return masterFridges.every((fridge) => {
    const key = (fridge.fridgeName || "").toLowerCase();
    const logForDate = logsByFridgeName.get(key);
    if (!logForDate) return false;
    const am = String(logForDate.temperatureAM || "").trim() !== "";
    const pm = String(logForDate.temperaturePM || "").trim() !== "";
    return am && pm;
  });
}

/**
 * @param {object} params
 * @param {Date} params.weekMonday
 * @param {Set<string>} params.openingTaskIds
 * @param {Set<string>} params.closingTaskIds
 * @param {Record<string, Record<string, boolean>>} params.openingLogsByDate dateKey -> taskId -> completed
 * @param {Record<string, Record<string, boolean>>} params.closingLogsByDate
 * @param {Array} params.masterFridges
 * @param {Iterable} params.fridgelogDocs
 * @param {Iterable} params.deliveryLogDocs
 * @param {Record<string, boolean>} params.noDeliveryByDateKey
 * @param {Iterable} params.coolingReheatingDocs
 */
export function buildWeeklyComplianceReport({
  weekMonday,
  openingTaskIds,
  closingTaskIds,
  openingLogsByDate,
  closingLogsByDate,
  masterFridges,
  fridgelogDocs,
  deliveryLogDocs = [],
  noDeliveryByDateKey = {},
  coolingReheatingDocs = [],
}) {
  const dateKeys = getWeekDateKeys(weekMonday);
  const days = [];
  let completedUnits = 0;
  const totalUnits = dateKeys.length * REPORT_DAILY_CATEGORY_COUNT;

  for (const dateKey of dateKeys) {
    const [y, m, day] = dateKey.split("-").map(Number);
    const localDate = new Date(y, m - 1, day);

    const openingOk = isChecklistDayComplete(openingTaskIds, openingLogsByDate[dateKey] || {});
    const closingOk = isChecklistDayComplete(closingTaskIds, closingLogsByDate[dateKey] || {});
    const fridgeOk = isFridgeTempsDayComplete(localDate, masterFridges, fridgelogDocs);
    const deliveryOk = isDeliveryTempsDayComplete(localDate, deliveryLogDocs, noDeliveryByDateKey);
    const cookingOk = isCookingReheatingDayComplete(localDate, coolingReheatingDocs);

    if (openingOk) completedUnits += 1;
    if (closingOk) completedUnits += 1;
    if (fridgeOk) completedUnits += 1;
    if (deliveryOk) completedUnits += 1;
    if (cookingOk) completedUnits += 1;

    const missed = [];
    if (!openingOk) missed.push(REPORT_TASK_LABELS.opening);
    if (!closingOk) missed.push(REPORT_TASK_LABELS.closing);
    if (!fridgeOk) missed.push(REPORT_TASK_LABELS.fridge);
    if (!deliveryOk) missed.push(REPORT_TASK_LABELS.delivery);
    if (!cookingOk) missed.push(REPORT_TASK_LABELS.cookingReheating);

    const weekday = localDate.toLocaleDateString("en-US", { weekday: "long" });

    days.push({
      dateKey,
      weekday,
      shortLabel: formatShortDayLabel(dateKey),
      opening: openingOk,
      closing: closingOk,
      fridge: fridgeOk,
      delivery: deliveryOk,
      cookingReheating: cookingOk,
      missed,
      fullyComplete: missed.length === 0,
    });
  }

  const scorePercent = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;
  const missedSummaries = days.filter((d) => !d.fullyComplete);

  return {
    dateKeys,
    days,
    completedUnits,
    totalUnits,
    scorePercent,
    missedSummaries,
  };
}
