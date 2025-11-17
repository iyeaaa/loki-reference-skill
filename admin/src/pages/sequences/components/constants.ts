/**
 * Shared constants for campaign creation
 */

export const MAX_STEPS = 4

// Variables that can be inserted - use getVariables() to get localized labels
export const getVariables = (t: (key: string) => string) => [
  { label: t("sequences.constants.companyName"), value: "{{회사명}}" },
  { label: t("sequences.constants.contactName"), value: "{{담당자명}}" },
  { label: t("sequences.constants.email"), value: "{{이메일}}" },
  { label: t("sequences.constants.website"), value: "{{웹사이트}}" },
  { label: t("sequences.constants.phone"), value: "{{전화번호}}" },
  { label: t("sequences.constants.address"), value: "{{주소}}" },
]

// Helper function to get current hour rounded up (ceil)
export const getCeiledHour = () => {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  // If there are minutes, round up to next hour
  return currentMinute > 0 ? Math.min(currentHour + 1, 23) : currentHour
}
