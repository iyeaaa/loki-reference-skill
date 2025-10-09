/**
 * Timezone utility functions for sequence scheduling
 *
 * This module provides functions to calculate scheduled times in KST (Korea Standard Time)
 * and convert them to UTC for database storage.
 */

/**
 * Calculate scheduled time based on Korean timezone (KST = UTC+9)
 *
 * @param fromDate - Base date to calculate from
 * @param delayDays - Number of days to delay
 * @param hour - Hour to schedule (0-23)
 * @param minute - Minute to schedule (0-59)
 * @param _timezone - Target timezone (default: Asia/Seoul) - currently unused, KST hardcoded
 * @returns Date object in UTC
 *
 * @example
 * // Schedule 3 days from now at 09:00 KST
 * const scheduledDate = calculateScheduledTime(new Date(), 3, 9, 0)
 */
export function calculateScheduledTime(
  fromDate: Date,
  delayDays: number,
  hour: number,
  minute: number,
  _timezone: string = "Asia/Seoul",
): Date {
  // Create a new date for calculation
  const baseDate = new Date(fromDate)

  // Add delay days
  baseDate.setDate(baseDate.getDate() + delayDays)

  // For KST (UTC+9), we need to:
  // 1. Get the date in UTC
  // 2. Calculate what time it would be in KST
  // 3. Adjust to get the desired KST time in UTC

  // KST offset in milliseconds (9 hours ahead of UTC)
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000

  // Get the base date in UTC milliseconds
  const baseDateUTC = baseDate.getTime()

  // Convert to KST to get the date
  const baseDateKST = new Date(baseDateUTC + KST_OFFSET_MS)

  // Set the target time in KST
  baseDateKST.setUTCHours(hour, minute, 0, 0)

  // Convert back to UTC
  const scheduledUTC = new Date(baseDateKST.getTime() - KST_OFFSET_MS)

  return scheduledUTC
}

/**
 * Format a date in Korean timezone
 *
 * @param date - Date to format
 * @returns Formatted string in KST
 *
 * @example
 * formatKST(new Date()) // "2025-10-10 09:00:00 KST"
 */
export function formatKST(date: Date): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS)

  const year = kstDate.getUTCFullYear()
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(kstDate.getUTCDate()).padStart(2, "0")
  const hours = String(kstDate.getUTCHours()).padStart(2, "0")
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, "0")
  const seconds = String(kstDate.getUTCSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} KST`
}

/**
 * Get current time in KST
 *
 * @returns Current date in KST as Date object (but stored as UTC)
 */
export function getCurrentKST(): Date {
  return new Date()
}

/**
 * Convert UTC date to KST hours and minutes
 *
 * @param date - UTC date
 * @returns Object with hour and minute in KST
 */
export function getKSTHourMinute(date: Date): { hour: number; minute: number } {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS)

  return {
    hour: kstDate.getUTCHours(),
    minute: kstDate.getUTCMinutes(),
  }
}
