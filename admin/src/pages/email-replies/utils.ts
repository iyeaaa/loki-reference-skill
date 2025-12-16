/**
 * Get initials from email address
 */
export function getInitials(email: string): string {
  return email.substring(0, 2).toUpperCase()
}

/**
 * Get display name from email and optional lead name
 */
export function getName(email: string, leadName?: string | null): string {
  if (leadName) {
    return leadName
  }
  return email.split("@")[0]
}

/**
 * Get domain from email address
 */
export function getDomain(email: string): string {
  return email.split("@")[1]
}
