import { useCallback, useEffect, useState } from "react"
import { getLicenseKey, LicenseKeyModal, verifyLicenseKey } from "@/components/LicenseKeyModal"
import LoginPage from "./LoginPage"

/**
 * License-protected login page for production environment.
 * Shows a license key modal if no valid license is found.
 * Once verified, shows the standard LoginPage.
 */
export default function LicenseProtectedLoginPage() {
  const [isLicenseVerified, setIsLicenseVerified] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Check existing license key on mount
  const checkLicense = useCallback(async () => {
    setIsChecking(true)
    const storedKey = getLicenseKey()

    if (storedKey) {
      const isValid = await verifyLicenseKey(storedKey)
      if (isValid) {
        setIsLicenseVerified(true)
        setShowModal(false)
        setIsChecking(false)
        return
      }
    }

    // No valid license key found
    setShowModal(true)
    setIsChecking(false)
  }, [])

  useEffect(() => {
    checkLicense()
  }, [checkLicense])

  const handleVerified = () => {
    setIsLicenseVerified(true)
    setShowModal(false)
  }

  // Show loading while checking license
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-indigo-600 border-b-2" />
          <p className="text-gray-600 text-sm">라이센스 확인 중...</p>
        </div>
      </div>
    )
  }

  // Show license modal if not verified
  if (!isLicenseVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        <LicenseKeyModal
          onOpenChange={(open) => {
            // Don't allow closing without valid license
            if (!(open || isLicenseVerified)) {
              return
            }
            setShowModal(open)
          }}
          onVerified={handleVerified}
          open={showModal}
          showDeleteButton={false}
        />
      </div>
    )
  }

  // License verified - show login page
  return <LoginPage />
}
