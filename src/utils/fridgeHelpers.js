/**
 * Shared fridge loading logic used by both Fridge Temperature Logs and Manage Fridges.
 * Source: fridgelogs collection, merged with fridges collection (admin panel).
 */
import { getDocs, addDoc, getDoc, setDoc, serverTimestamp, updateDoc, deleteDoc } from "firebase/firestore";
import { getRestaurantCollection, getRestaurantDoc } from "./firestoreHelpers";

function parseLogFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    fridgeName: data.fridgeName || data.name || "Unknown Fridge",
    fridgeId: data.fridgeId || docSnap.id,
    temperatureAM: data.temperatureAM || "",
    temperaturePM: data.temperaturePM || "",
    createdAt: data.createdAt,
    done: data.done || false,
    isNew: false,
    fridgeType: data.fridgeType || "fridge",
  };
}

function isLogInDateRange(log, startOfDay, endOfDay) {
  const logDate = log.createdAt;
  if (!logDate) return true;
  try {
    let logDateTime;
    if (typeof logDate.toDate === "function") logDateTime = logDate.toDate();
    else if (logDate instanceof Date) logDateTime = logDate;
    else logDateTime = new Date(logDate);
    return !isNaN(logDateTime.getTime()) && logDateTime >= startOfDay && logDateTime <= endOfDay;
  } catch {
    return true;
  }
}

function deduplicateByFridgeName(logs) {
  const fridgeNameTracker = new Map();
  logs.forEach((log) => {
    const hasActualData =
      (log.temperatureAM && log.temperatureAM.trim() !== "") ||
      (log.temperaturePM && log.temperaturePM.trim() !== "") ||
      log.done === true;
    const fridgeKey = (log.fridgeName || "").toLowerCase();
    if (hasActualData) {
      if (!fridgeNameTracker.has(fridgeKey) || fridgeNameTracker.get(fridgeKey).priority < 2) {
        fridgeNameTracker.set(fridgeKey, { log, priority: 2 });
      }
    }
  });
  logs.forEach((log) => {
    const fridgeKey = (log.fridgeName || "").toLowerCase();
    const hasActualData =
      (log.temperatureAM && log.temperatureAM.trim() !== "") ||
      (log.temperaturePM && log.temperaturePM.trim() !== "") ||
      log.done === true;
    if (!hasActualData && !fridgeNameTracker.has(fridgeKey)) {
      fridgeNameTracker.set(fridgeKey, { log, priority: 1 });
    }
  });
  const result = [];
  fridgeNameTracker.forEach(({ log }) => result.push(log));
  result.sort((a, b) => (a.fridgeName || "").toLowerCase().localeCompare((b.fridgeName || "").toLowerCase()));
  return result;
}

/**
 * Fetch fridge list from fridgelogs - same logic as Fridge Temperature Logs screen.
 * @param {string} restaurantId
 * @param {Date|null} selectedDate - If null, include all logs. If set, filter by date.
 * @returns {Promise<Array<{id, fridgeName, fridgeId, fridgeType, ...}>>}
 */
export async function fetchFridgeListFromFridgelogs(restaurantId, selectedDate = null) {
  if (!restaurantId) return [];

  const fridgeLogsCollection = getRestaurantCollection(restaurantId, "fridgelogs");
  const allLogsSnapshot = await getDocs(fridgeLogsCollection);

  let logs = [];
  const startOfDay = selectedDate ? new Date(selectedDate) : null;
  const endOfDay = selectedDate ? new Date(selectedDate) : null;
  if (startOfDay) startOfDay.setHours(0, 0, 0, 0);
  if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

  allLogsSnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const logDate = data.createdAt;

    if (!selectedDate) {
      logs.push(parseLogFromDoc(docSnap));
      return;
    }

    if (!logDate) {
      logs.push(parseLogFromDoc(docSnap));
    } else {
      const log = parseLogFromDoc(docSnap);
      if (isLogInDateRange(log, startOfDay, endOfDay)) {
        logs.push(log);
      }
    }
  });

  let result = deduplicateByFridgeName(logs);

  if (!selectedDate) {
    const fromFridges = await fetchFridgesFromFridgesCollection(restaurantId);
    result = mergeFridgeLists(result, fromFridges);
  }

  return result;
}

/**
 * Fetch fridges from the fridges collection (used by admin panel).
 * Supports both array doc (fridges/fridges) and individual docs.
 */
async function fetchFridgesFromFridgesCollection(restaurantId) {
  if (!restaurantId) return [];
  const fridgesCollection = getRestaurantCollection(restaurantId, "fridges");
  const snapshot = await getDocs(fridgesCollection);
  const byKey = new Map();
  snapshot.forEach((docSnap) => {
    if (docSnap.id === "fridges") {
      const data = docSnap.data();
      const arr = data.array || data.names || [];
      arr.forEach((item, idx) => {
        const name = typeof item === "string" ? item : (item.fridgeName || item.name || "");
        const type = typeof item === "object" ? (item.fridgeType || "fridge") : "fridge";
        if (name) {
          const key = name.toLowerCase();
          if (!byKey.has(key)) byKey.set(key, { id: `fridges-${idx}`, fridgeName: name, fridgeType: type });
        }
      });
    } else {
      const data = docSnap.data();
      const name = data.fridgeName || data.name || docSnap.id;
      const key = (name || "").toLowerCase();
      if (name && !byKey.has(key)) byKey.set(key, { id: docSnap.id, fridgeName: name, fridgeType: data.fridgeType || "fridge" });
    }
  });
  return Array.from(byKey.values());
}

/**
 * Merge fridge lists from fridgelogs and fridges collection.
 * Fridgelogs take precedence for duplicates (by fridgeName).
 */
function mergeFridgeLists(fromFridgelogs, fromFridges) {
  const byKey = new Map();
  fromFridgelogs.forEach((f) => {
    const key = (f.fridgeName || "").toLowerCase();
    byKey.set(key, { ...f, source: "fridgelogs" });
  });
  fromFridges.forEach((f) => {
    const key = (f.fridgeName || "").toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { ...f, source: "fridges" });
  });
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => (a.fridgeName || "").toLowerCase().localeCompare((b.fridgeName || "").toLowerCase()));
  return merged;
}

/**
 * Add a fridge to the fridges collection (for admin panel sync).
 * Writes to both the array doc and as an individual doc.
 */
export async function addFridgeToFridgesCollection(restaurantId, fridgeName, fridgeType, createdBy) {
  if (!restaurantId || !fridgeName?.trim()) return;
  const fridgesCollection = getRestaurantCollection(restaurantId, "fridges");
  const fridgesDocRef = getRestaurantDoc(restaurantId, "fridges", "fridges");
  const entry = { fridgeName: fridgeName.trim(), fridgeType: fridgeType || "fridge" };

  const docSnap = await getDoc(fridgesDocRef);
  const existing = docSnap.exists() ? (docSnap.data().array || docSnap.data().names || []) : [];
  const arr = Array.isArray(existing) ? existing : [];
  const key = fridgeName.trim().toLowerCase();
  if (arr.some((x) => (typeof x === "string" ? x : (x.fridgeName || "").toLowerCase()) === key)) return;
  arr.push(entry);
  await setDoc(fridgesDocRef, { array: arr, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });

  await addDoc(fridgesCollection, {
    fridgeName: fridgeName.trim(),
    fridgeType: fridgeType || "fridge",
    createdAt: serverTimestamp(),
    createdBy: createdBy || null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update a fridge in the fridges collection (for admin panel sync).
 */
export async function updateFridgeInFridgesCollection(restaurantId, oldFridgeName, newFridgeName, newFridgeType) {
  if (!restaurantId || !oldFridgeName?.trim()) return;
  const fridgesDocRef = getRestaurantDoc(restaurantId, "fridges", "fridges");
  const fridgesCollection = getRestaurantCollection(restaurantId, "fridges");
  const oldKey = oldFridgeName.trim().toLowerCase();
  const entry = { fridgeName: newFridgeName.trim(), fridgeType: newFridgeType || "fridge" };

  const docSnap = await getDoc(fridgesDocRef);
  const existing = docSnap.exists() ? (docSnap.data().array || docSnap.data().names || []) : [];
  const arr = Array.isArray(existing) ? existing : [];
  const updated = arr.map((x) => {
    const n = typeof x === "string" ? x : (x.fridgeName || "").toLowerCase();
    return n === oldKey ? entry : x;
  });
  await setDoc(fridgesDocRef, { array: updated, updatedAt: serverTimestamp() });

  const snap = await getDocs(fridgesCollection);
  for (const d of snap.docs) {
    if (d.id === "fridges") continue;
    const data = d.data();
    const name = (data.fridgeName || data.name || "").toLowerCase();
    if (name === oldKey) {
      await updateDoc(d.ref, { fridgeName: newFridgeName.trim(), fridgeType: newFridgeType || "fridge", updatedAt: serverTimestamp() });
    }
  }
}

/**
 * Delete a fridge from the fridges collection (for admin panel sync).
 */
export async function deleteFridgeFromFridgesCollection(restaurantId, fridgeName) {
  if (!restaurantId || !fridgeName?.trim()) return;
  const fridgesDocRef = getRestaurantDoc(restaurantId, "fridges", "fridges");
  const fridgesCollection = getRestaurantCollection(restaurantId, "fridges");
  const key = fridgeName.trim().toLowerCase();

  const docSnap = await getDoc(fridgesDocRef);
  const existing = docSnap.exists() ? (docSnap.data().array || docSnap.data().names || []) : [];
  const arr = Array.isArray(existing) ? existing : [];
  const updated = arr.filter((x) => (typeof x === "string" ? x : (x.fridgeName || "").toLowerCase()) !== key);
  await setDoc(fridgesDocRef, { array: updated, updatedAt: serverTimestamp() });

  const snap = await getDocs(fridgesCollection);
  for (const d of snap.docs) {
    if (d.id === "fridges") continue;
    const data = d.data();
    const name = (data.fridgeName || data.name || "").toLowerCase();
    if (name === key) await deleteDoc(d.ref);
  }
}
