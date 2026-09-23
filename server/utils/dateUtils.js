/**
 * Calendar Date Utilities
 * Pure string-based (YYYY-MM-DD) calendar arithmetic.
 * Completely immune to UTC / Local timezone date-slippage.
 */

/**
 * Checks if a string is a valid YYYY-MM-DD date.
 * @param {string} str
 * @returns {boolean}
 */
const isValidDateString = (str) => {
  if (typeof str !== "string") return false;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  const daysInMonth = getDaysInMonth(year, month);
  return day >= 1 && day <= daysInMonth;
};

/**
 * Returns the number of days in a given year and month (1-indexed).
 * @param {number} year
 * @param {number} month (1 - 12)
 * @returns {number}
 */
const getDaysInMonth = (year, month) => {
  // February
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeapYear ? 29 : 28;
  }
  // April, June, September, November
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
};

/**
 * Formats a Date object or year/month/day integers into YYYY-MM-DD
 * @param {number} year
 * @param {number} month (1 - 12)
 * @param {number} day (1 - 31)
 * @returns {string}
 */
const toDateString = (year, month, day) => {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Parse YYYY-MM-DD into [year, month, day]
 * @param {string} dateStr
 * @returns {{ year: number, month: number, day: number }}
 */
const parseDateParts = (dateStr) => {
  const parts = String(dateStr).slice(0, 10).split("-");
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
};

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 * @returns {string}
 */
const getTodayDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return toDateString(y, m, d);
};

/**
 * Add N calendar days to a YYYY-MM-DD date.
 * Uses epoch UTC millisecond addition to avoid any local DST shift.
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
const addCalendarDays = (dateStr, days) => {
  const { year, month, day } = parseDateParts(dateStr);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + parseInt(days, 10));
  return toDateString(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate()
  );
};

/**
 * Add N calendar months to a YYYY-MM-DD date.
 * Preserves the day of month; clamps to the last day of target month if target month has fewer days.
 * E.g. Jan 31 + 1 month = Feb 28 (or 29); March 31 + 1 month = April 30.
 * @param {string} dateStr
 * @param {number} months
 * @returns {string}
 */
const addCalendarMonths = (dateStr, months) => {
  const { year, month, day } = parseDateParts(dateStr);
  const nMonths = parseInt(months, 10);

  let targetYear = year + Math.floor((month - 1 + nMonths) / 12);
  let targetMonth = ((month - 1 + nMonths) % 12 + 12) % 12 + 1;

  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(day, maxDays);

  return toDateString(targetYear, targetMonth, targetDay);
};

/**
 * Add N calendar years to a YYYY-MM-DD date.
 * E.g. 2024-02-29 + 1 year = 2025-02-28.
 * @param {string} dateStr
 * @param {number} years
 * @returns {string}
 */
const addCalendarYears = (dateStr, years) => {
  const { year, month, day } = parseDateParts(dateStr);
  const targetYear = year + parseInt(years, 10);
  const maxDays = getDaysInMonth(targetYear, month);
  const targetDay = Math.min(day, maxDays);

  return toDateString(targetYear, month, targetDay);
};

/**
 * Calculate the difference in calendar days: (dateStrA - dateStrB).
 * Positive if A is in the future relative to B; negative if past.
 * @param {string} dateStrA
 * @param {string} dateStrB
 * @returns {number}
 */
const diffCalendarDays = (dateStrA, dateStrB) => {
  const pA = parseDateParts(dateStrA);
  const pB = parseDateParts(dateStrB);

  const utcA = Date.UTC(pA.year, pA.month - 1, pA.day);
  const utcB = Date.UTC(pB.year, pB.month - 1, pB.day);

  const diffMs = utcA - utcB;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

module.exports = {
  isValidDateString,
  getDaysInMonth,
  toDateString,
  parseDateParts,
  getTodayDateString,
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  diffCalendarDays,
};
