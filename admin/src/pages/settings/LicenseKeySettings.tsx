import { Eye, EyeOff, Key, RefreshCw, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  getLicenseKey,
  LicenseKeyModal,
  removeLicenseKey,
  verifyLicenseKey,
} from "@/components/LicenseKeyModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LicenseKeySettings() {
  const [showKey, setShowKey] = useState(false)
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Load license key on mount
  useEffect(() => {
    const stored = getLicenseKey()
    setLicenseKey(stored)
  }, [])

  // Verify the stored license key
  const handleVerify = async () => {
    if (!licenseKey) {
      toast.error("저장된 라이센스 키가 없습니다")
      return
    }

    setIsVerifying(true)
    try {
      const valid = await verifyLicenseKey(licenseKey)
      setIsValid(valid)
      if (valid) {
        toast.success("라이센스가 유효합니다")
      } else {
        toast.error("라이센스가 유효하지 않습니다")
      }
    } catch {
      toast.error("라이센스 확인 중 오류가 발생했습니다")
      setIsValid(false)
    } finally {
      setIsVerifying(false)
    }
  }

  // Delete the license key
  const handleDelete = () => {
    removeLicenseKey()
    setLicenseKey(null)
    setIsValid(null)
    toast.success("라이센스 키가 삭제되었습니다")
  }

  // Handle license key updated from modal
  const handleLicenseUpdated = () => {
    const stored = getLicenseKey()
    setLicenseKey(stored)
    setIsValid(true)
  }

  // Mask the license key for display
  const getMaskedKey = (key: string | null) => {
    if (!key) {
      return ""
    }
    if (key.length <= 8) {
      return "****"
    }
    return `${key.substring(0, 4)}${"*".repeat(key.length - 8)}${key.substring(key.length - 4)}`
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-1.5">
            <Key className="h-4 w-4" />
            <CardTitle className="text-base">라이센스 키</CardTitle>
          </div>
          <CardDescription className="text-xs">
            관리자 페이지 접근을 위한 라이센스 키를 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current License Key Display */}
          <div className="space-y-3">
            <Label>현재 라이센스 키</Label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Key className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                <Input
                  className="h-11 pr-10 pl-10 font-mono"
                  placeholder="라이센스 키가 없습니다"
                  readOnly
                  type={showKey ? "text" : "password"}
                  value={showKey ? licenseKey || "" : getMaskedKey(licenseKey)}
                />
                {licenseKey && (
                  <button
                    className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Status Badge */}
            {isValid !== null && (
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${isValid ? "bg-green-500" : "bg-red-500"}`}
                />
                <span className={`text-sm ${isValid ? "text-green-600" : "text-red-600"}`}>
                  {isValid ? "유효한 라이센스" : "유효하지 않은 라이센스"}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={() => setShowModal(true)}>
              <Key className="h-4 w-4" />
              {licenseKey ? "라이센스 변경" : "라이센스 등록"}
            </Button>

            {licenseKey && (
              <>
                <Button
                  className="gap-2"
                  disabled={isVerifying}
                  onClick={handleVerify}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 ${isVerifying ? "animate-spin" : ""}`} />
                  {isVerifying ? "확인 중..." : "유효성 확인"}
                </Button>

                <Button
                  className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDelete}
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </Button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 font-medium text-blue-900 text-sm">라이센스 키 안내</h4>
            <ul className="list-inside list-disc space-y-1 text-blue-800 text-sm">
              <li>라이센스 키는 프로덕션 환경에서 관리자 페이지 접근에 필요합니다.</li>
              <li>라이센스 키는 브라우저의 로컬 스토리지에 저장됩니다.</li>
              <li>라이센스 키 분실 시 시스템 관리자에게 문의하세요.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* License Key Modal */}
      <LicenseKeyModal
        onOpenChange={setShowModal}
        onVerified={handleLicenseUpdated}
        open={showModal}
        showDeleteButton={false}
      />
    </>
  )
}
