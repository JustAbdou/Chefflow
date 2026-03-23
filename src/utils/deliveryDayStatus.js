/** Firestore collection under each restaurant for per-day delivery flags */
export const DELIVERY_DAY_STATUS_COLLECTION = 'deliverydaystatus';

/**
 * Stable local calendar key YYYY-MM-DD (matches delivery log createdAt local days).
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Each calendar day from start through end (inclusive), local midnight dates.
 * @param {Date} start
 * @param {Date} end
 * @returns {Date[]}
 */
export function eachLocalCalendarDate(start, end) {
  const out = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * @param {{ createdAt?: Date | null }} log
 * @param {Date} dayDate
 */
export function deliveryLogMatchesLocalDate(log, dayDate) {
  if (!log?.createdAt) return false;
  const dt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
  if (isNaN(dt.getTime())) return false;
  return toLocalDateKey(dt) === toLocalDateKey(dayDate);
}

/**
 * Build delivery section table rows for PDF: per calendar day, either "No delivery" or supplier rows.
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {Record<string, boolean>} noDeliveryByDateKey
 * @param {Array<{ supplierName?: string, frozen?: string, chilled?: string, createdAt?: Date | null, date?: string }>} deliveryLogs
 * @param {(d: Date) => string} formatCellDate en-GB style
 */
export function buildDeliveryTemperaturePdfRows(
  rangeStart,
  rangeEnd,
  noDeliveryByDateKey,
  deliveryLogs,
  formatCellDate
) {
  const days = eachLocalCalendarDate(rangeStart, rangeEnd);
  const rows = [];
  for (const day of days) {
    const key = toLocalDateKey(day);
    if (noDeliveryByDateKey[key]) {
      rows.push({
        supplier: 'No delivery',
        frozen: '—',
        chilled: '—',
        dateLabel: formatCellDate(day),
      });
      continue;
    }
    const logsForDay = deliveryLogs.filter((log) => deliveryLogMatchesLocalDate(log, day));
    if (logsForDay.length === 0) continue;
    for (const log of logsForDay) {
      rows.push({
        supplier: log.supplierName || 'Unknown',
        frozen: log.frozen != null && String(log.frozen).trim() !== '' ? `${log.frozen}°C` : '--°C',
        chilled: log.chilled != null && String(log.chilled).trim() !== '' ? `${log.chilled}°C` : '--°C',
        dateLabel:
          log.date ||
          (log.createdAt
            ? formatCellDate(log.createdAt)
            : formatCellDate(day)),
      });
    }
  }
  return rows;
}
