import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Key, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api/client"

const LICENSE_KEY_STORAGE_KEY = "rinda_license_key"

const licenseKeySchema = z.object({
  licenseKey: z.string().min(1, "라이센스 키를 입력해주세요"),
})

type LicenseKeyFormValues = z.infer<typeof licenseKeySchema>

type LicenseVerifyResponse = {
  valid: boolean
  message: string
}

// License key localStorage utilities
export function getLicenseKey(): string | null {
  try {
    return localStorage.getItem(LICENSE_KEY_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setLicenseKey(key: string): void {
  try {
    localStorage.setItem(LICENSE_KEY_STORAGE_KEY, key)
  } catch (error) {
    console.error("Failed to save license key:", error)
  }
}

export function removeLicenseKey(): void {
  try {
    localStorage.removeItem(LICENSE_KEY_STORAGE_KEY)
  } catch (error) {
    console.error("Failed to remove license key:", error)
  }
}

// Verify license key with backend
export async function verifyLicenseKey(licenseKey: string): Promise<boolean> {
  try {
    const response = await apiFetch<LicenseVerifyResponse>("/api/v1/auth/verify-license", {
      method: "POST",
      body: JSON.stringify({ licenseKey }),
    })
    return response.valid
  } catch {
    return false
  }
}

type LicenseKeyModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified: () => void
  showDeleteButton?: boolean
}

export function LicenseKeyModal({
  open,
  onOpenChange,
  onVerified,
  showDeleteButton = false,
}: LicenseKeyModalProps) {
  const navigate = useNavigate()
  const [showKey, setShowKey] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const form = useForm<LicenseKeyFormValues>({
    resolver: zodResolver(licenseKeySchema),
    defaultValues: {
      licenseKey: "",
    },
  })

  // Load existing license key on mount
  useEffect(() => {
    const storedKey = getLicenseKey()
    if (storedKey) {
      form.setValue("licenseKey", storedKey)
    }
  }, [form])

  const onSubmit = async (data: LicenseKeyFormValues) => {
    setIsVerifying(true)
    try {
      const isValid = await verifyLicenseKey(data.licenseKey)

      if (isValid) {
        setLicenseKey(data.licenseKey)
        toast.success("라이센스가 확인되었습니다")
        onVerified()
        onOpenChange(false)
      } else {
        toast.error("유효하지 않은 라이센스 키입니다")
      }
    } catch {
      toast.error("라이센스 확인 중 오류가 발생했습니다")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDelete = () => {
    removeLicenseKey()
    form.reset({ licenseKey: "" })
    toast.success("라이센스 키가 삭제되었습니다")
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        {/* Header with Logo */}
        <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-6 pt-8 pb-6 text-center">
          <div className="mx-auto mb-4 h-16 w-16">
            <img
              alt="Rinda Logo"
              className="h-full w-full rounded-2xl object-contain"
              src="/images/rinda-logo.png"
            />
          </div>
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-semibold text-gray-900 text-xl">
              라이센스 키 입력
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              서비스 이용을 위해 라이센스 키를 입력해주세요
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form */}
        <div className="px-6 pb-6">
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                  <Input
                    className="h-12 border-gray-200 pr-10 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                    id="licenseKey"
                    placeholder="라이센스 키를 입력하세요"
                    type={showKey ? "text" : "password"}
                    {...form.register("licenseKey")}
                    disabled={isVerifying}
                  />
                  <button
                    className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  className="h-12 bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] px-6 shadow-md hover:from-[#5936B1] hover:to-[#2B72E6]"
                  disabled={isVerifying}
                  type="submit"
                >
                  {isVerifying ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
                  ) : (
                    "확인"
                  )}
                </Button>
              </div>
              {form.formState.errors.licenseKey && (
                <p className="text-red-600 text-sm">{form.formState.errors.licenseKey.message}</p>
              )}
            </div>

            {showDeleteButton && getLicenseKey() && (
              <div className="flex justify-end">
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDelete}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  삭제
                </Button>
              </div>
            )}
          </form>

          {/* Trial Link */}
          <div className="mt-6 border-gray-100 border-t pt-4">
            <p className="mb-3 text-center text-gray-500 text-sm">Rinda에 처음 방문하셨나요?</p>
            <Button
              className="h-11 w-full"
              onClick={() => navigate("/trial/survey/1")}
              variant="outline"
            >
              무료 체험 시작하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
