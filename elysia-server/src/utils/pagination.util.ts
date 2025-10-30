/**
 * Pagination utility functions
 * Pure functions for pagination validation and calculations
 */

export const DEFAULT_PAGE_SIZE = 100
export const MAX_PAGE_SIZE = 10000
export const MIN_PAGE_SIZE = 1

/**
 * Validates and normalizes page size input
 * @param input - Page size as string or number
 * @returns Validated page size number
 * @throws Error if input is invalid
 */
export function validatePageSize(input: string | number | undefined): number {
  // Handle undefined or empty string - return default
  if (input === undefined || input === "") {
    return DEFAULT_PAGE_SIZE
  }

  // Parse string to number
  const parsed = typeof input === "string" ? Number.parseInt(input, 10) : input

  // Validate parsed number
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid page size: ${input}. Must be a positive integer`)
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid page size: ${input}. Must be finite`)
  }

  // Check for decimal numbers (only integers allowed)
  if (typeof input === "string" && input.includes(".")) {
    throw new Error(`Invalid page size: ${input}. Decimal numbers not allowed`)
  }

  // Enforce minimum (convert negatives and zero to MIN)
  if (parsed <= 0) {
    return MIN_PAGE_SIZE
  }

  // Cap at maximum
  if (parsed > MAX_PAGE_SIZE) {
    return MAX_PAGE_SIZE
  }

  return parsed
}

/**
 * Calculates the offset for database queries
 * @param page - Current page number (1-indexed)
 * @param limit - Number of records per page
 * @returns Offset value for database query
 */
export function calculateOffset(page: number, limit: number): number {
  // Ensure page is at least 1
  const validPage = Math.max(1, page)
  // Calculate offset: (page - 1) * limit
  return (validPage - 1) * limit
}

/**
 * Validates page number
 * @param page - Page number to validate
 * @returns Validated page number (minimum 1)
 */
export function validatePageNumber(page: string | number | undefined): number {
  // Handle undefined or empty string - return default (page 1)
  if (page === undefined || page === "") {
    return 1
  }

  // Parse string to number
  const parsed = typeof page === "string" ? Number.parseInt(page, 10) : page

  // Validate parsed number
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid page number: ${page}. Must be a positive integer`)
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid page number: ${page}. Must be finite`)
  }

  // Check for decimal numbers (only integers allowed)
  if (typeof page === "number" && !Number.isInteger(page)) {
    throw new Error(`Invalid page number: ${page}. Decimal numbers not allowed`)
  }

  if (typeof page === "string" && page.includes(".")) {
    throw new Error(`Invalid page number: ${page}. Decimal numbers not allowed`)
  }

  // Enforce minimum of 1
  if (parsed < 1) {
    return 1
  }

  return parsed
}
