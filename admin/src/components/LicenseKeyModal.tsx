import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Key, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" />
            라이센스 키 입력
          </DialogTitle>
          <DialogDescription>
            관리자 페이지에 접근하려면 유효한 라이센스 키가 필요합니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="licenseKey">라이센스 키</Label>
            <div className="relative">
              <Key className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
              <Input
                className="h-11 pr-10 pl-10"
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
            {form.formState.errors.licenseKey && (
              <p className="text-red-600 text-sm">{form.formState.errors.licenseKey.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {showDeleteButton && getLicenseKey() && (
              <Button
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </Button>
            )}
            <Button
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              disabled={isVerifying}
              type="submit"
            >
              {isVerifying ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
                  확인 중...
                </div>
              ) : (
                "확인"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
