import { useEffect, useState } from "react"

/**
 * Check if localStorage is available and enabled
 * Returns false for:
 * - Safari private browsing mode
 * - Firefox private browsing mode
 * - Browser settings that disable storage
 * - iOS Safari in private mode
 */
export function useLocalStorageEnabled(): boolean {
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    try {
      // Test localStorage availability
      const testKey = "__rinda_storage_test__"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      setIsEnabled(true)
    } catch (error) {
      // localStorage is not available (Safari private mode, etc.)
      console.warn("⚠️ [useLocalStorageEnabled] localStorage is not available:", error)
      setIsEnabled(false)
    }
  }, [])

  return isEnabled
}
