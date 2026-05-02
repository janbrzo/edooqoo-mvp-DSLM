/**
 * Promotion Utils
 * Handles checking if any promotional period is active
 */

// OLD FREE DEMO WEEK dates (UTC+0) - EXPIRED
const FREE_DEMO_WEEK_START = new Date('2025-09-23T00:00:00.000Z');
const FREE_DEMO_WEEK_END = new Date('2025-10-05T23:59:59.999Z');

// FREE CHRISTMAS WEEK dates (UTC+0)
const FREE_CHRISTMAS_WEEK_START = new Date('2025-12-25T01:00:00.000Z'); // Start: 25.12.2025 01:00 UTC
const FREE_CHRISTMAS_WEEK_END = new Date('2026-01-04T23:59:59.999Z');   // End: 4.01.2026 23:59 UTC

/**
 * Check if FREE CHRISTMAS WEEK promotion is currently active
 * @returns {boolean} True if the promotion is active, false otherwise
 */
export const isFreeChristmasWeek = (): boolean => {
  const now = new Date();
  return now >= FREE_CHRISTMAS_WEEK_START && now <= FREE_CHRISTMAS_WEEK_END;
};

/**
 * Check if any FREE WEEK promotion is currently active
 * This is the main function used throughout the app
 * @returns {boolean} True if any promotion is active, false otherwise
 */
export const isFreeCustomDemoWeek = (): boolean => {
  // Currently only Christmas Week is active
  return isFreeChristmasWeek();
};

/**
 * Get the end date of the current active promotion for display purposes
 * @returns {Date} The end date of the promotion
 */
export const getFreeWeekEndDate = (): Date => {
  return FREE_CHRISTMAS_WEEK_END;
};

/**
 * Get formatted end date string for display
 * @returns {string} Formatted end date string
 */
export const getFreeWeekEndDateString = (): string => {
  return getFreeWeekEndDate().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
};

/**
 * Get the name of the current promotion
 * @returns {string} Name of the current promotion
 */
export const getPromoName = (): string => {
  if (isFreeChristmasWeek()) return 'FREE CHRISTMAS WEEK';
  return 'FREE WEEK';
};

/**
 * Check if current promotion is for logged-in users only
 * @returns {boolean} True if only for logged-in users
 */
export const isPromoForLoggedInOnly = (): boolean => {
  // Christmas Week is for logged-in users only
  return isFreeChristmasWeek();
};

/**
 * Check if promotion ends today
 * @returns {boolean} True if promotion ends today
 */
export const isLastDayOfFreeWeek = (): boolean => {
  const now = new Date();
  const endDate = getFreeWeekEndDate();
  
  return now.getUTCFullYear() === endDate.getUTCFullYear() &&
         now.getUTCMonth() === endDate.getUTCMonth() &&
         now.getUTCDate() === endDate.getUTCDate();
};
