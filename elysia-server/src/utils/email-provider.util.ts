/**
 * Email Provider Utility
 *
 * Utilities for detecting and filtering free email provider domains
 * Used to filter out generic company emails on free providers (Gmail, Yahoo, etc.)
 * while allowing personal C-level emails on those same providers.
 */

/**
 * List of free email provider domains to filter from GENERIC emails
 *
 * Note: Personal C-level emails CAN be on these domains - this filtering
 * only applies to generic/company emails (contact@, info@, etc.)
 */
const FREE_EMAIL_PROVIDERS = [
  // Gmail
  "gmail.com",
  "googlemail.com",

  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.jp",
  "yahoo.fr",
  "yahoo.de",
  "yahoo.it",
  "yahoo.es",
  "yahoo.ca",
  "yahoo.com.br",
  "yahoo.com.mx",
  "yahoo.com.au",
  "yahoo.in",

  // Hotmail/Outlook/Microsoft
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "outlook.com",
  "live.com",
  "msn.com",

  // Other common free providers
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "protonmail.ch",
  "pm.me",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "gmx.com",
  "gmx.net",
]

/**
 * Check if an email address is on a free email provider domain
 *
 * @param email - Email address to check
 * @returns true if email is on a free provider, false otherwise
 *
 * @example
 * ```typescript
 * isFreeEmailProvider('user@gmail.com') // true
 * isFreeEmailProvider('contact@company.com') // false
 * ```
 */
export function isFreeEmailProvider(email: string): boolean {
  if (!email || !email.includes("@")) {
    return false
  }

  const parts = email.split("@")
  // Ensure there's a local part (before @) and a domain part (after @)
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false
  }

  const domain = parts[1].toLowerCase()
  return FREE_EMAIL_PROVIDERS.includes(domain)
}

/**
 * Check if a generic email should be filtered out
 *
 * Returns true only for GENERIC emails on free providers.
 * Personal emails are NEVER filtered, even if on free providers,
 * because C-level executives may legitimately use Gmail, etc.
 *
 * @param email - Email address to check
 * @param type - Email type: 'personal' or 'generic'
 * @returns true if email should be filtered, false otherwise
 *
 * @example
 * ```typescript
 * shouldFilterGenericEmail('contact@gmail.com', 'generic') // true (filter generic on Gmail)
 * shouldFilterGenericEmail('ceo@gmail.com', 'personal') // false (personal C-level OK)
 * shouldFilterGenericEmail('contact@company.com', 'generic') // false (company domain OK)
 * ```
 */
export function shouldFilterGenericEmail(email: string, type: "personal" | "generic"): boolean {
  // Never filter personal emails, regardless of domain
  if (type === "personal") {
    return false
  }

  // Only filter generic emails on free providers
  return isFreeEmailProvider(email)
}

/**
 * Check if an email can send via Gmail API
 *
 * Gmail API can only send emails from:
 * 1. Personal Gmail accounts (gmail.com or googlemail.com)
 * 2. Google Workspace accounts (has hosted domain)
 *
 * Other email providers (naver.com, outlook.com, etc.) cannot send via Gmail API
 * even if they're used as a Google account login.
 *
 * @param email - Email address to check
 * @param hostedDomain - Google Workspace hosted domain (hd field from OAuth)
 * @returns true if email can send via Gmail API, false otherwise
 *
 * @example
 * ```typescript
 * canSendGmail('user@gmail.com') // true (personal Gmail)
 * canSendGmail('user@company.com', 'company.com') // true (Google Workspace)
 * canSendGmail('user@naver.com') // false (not Gmail or Workspace)
 * ```
 */
export function canSendGmail(email: string, hostedDomain?: string): boolean {
  if (!email || !email.includes("@")) {
    return false
  }

  const parts = email.split("@")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false
  }

  const domain = parts[1].toLowerCase()

  // Allow personal Gmail accounts
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return true
  }

  // Allow Google Workspace accounts (has hosted domain)
  if (hostedDomain && hostedDomain.length > 0) {
    return true
  }

  // Reject all other email providers
  return false
}
