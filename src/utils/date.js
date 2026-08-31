/**
 * Date utilities for PACT app
 * All dates stored as YYYY-MM-DD strings (ISO date only)
 */

/**
 * Get today's date as YYYY-MM-DD string in local timezone
 * @returns {string}
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date string for N days ago
 * @param {number} daysAgo
 * @returns {string}
 */
export function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string to Date object (local midnight)
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format date for display (e.g., "Mon, Jan 15")
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get day name for date (e.g., "Mon")
 * @param {string} dateStr
 * @returns {string}
 */
export function getDayName(dateStr) {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * Check if date is today
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isToday(dateStr) {
  return dateStr === getTodayString();
}

/**
 * Check if date is in the past
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isPast(dateStr) {
  return dateStr < getTodayString();
}

/**
 * Check if date is in the future
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isFuture(dateStr) {
  return dateStr > getTodayString();
}

/**
 * Get array of last N date strings including today
 * @param {number} count
 * @returns {string[]}
 */
export function getLastNDates(count) {
  const dates = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(getDateString(i));
  }
  return dates;
}

/**
 * Get array of next N date strings starting tomorrow
 * @param {number} count
 * @returns {string[]}
 */
export function getNextNDates(count) {
  const dates = [];
  for (let i = 1; i <= count; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}