import { LogOut, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type ProfileCardProps = {
  isOpen: boolean
  onClose: () => void
  user?: {
    username?: string | null
    email?: string
    image?: string | null
    userRole: string
    // user_role?: string | null
    // department_name?: string | null
    // employee_id?: string | null
  }
  isAdmin?: boolean
  onAdminClick?: () => void
  onLogout?: () => void
}

export function ProfileCard({ isOpen, onClose, user, onLogout }: ProfileCardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!(isOpen && mounted)) {
    return null
  }

  const displayName = user?.username || "김하나"
  const displayEmail = user?.email || "hana@hana.com"
  const userInitial = displayName.charAt(0).toUpperCase()

  // Role display mapping
  const getRoleDisplay = (role?: string | null) => {
    switch (role) {
      case "admin":
        return "관리자"
      case "internal_reviewer":
        return "내부 검수자"
      case "external_reviewer":
        return "외부 검수자"
      default:
        return "사용자"
    }
  }

  const roleLabel = getRoleDisplay(user?.userRole)

  const cardContent = (
    <>
      {/* Backdrop */}
      <button
        aria-label="프로필 카드 닫기"
        className="fixed inset-0 m-0 border-0 bg-transparent p-0"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClose()
          }
        }}
        type="button"
      />
      {/* Card */}
      <div className="fixed top-16 right-8 z-60">
        <Card className="w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="flex justify-end px-3 pb-0">
            <button
              className="rounded-full p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="px-4 text-center">
            <p className="mb-3 text-gray-600 text-sm dark:text-gray-400">{displayEmail}</p>

            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600">
              {user?.image ? (
                <Avatar className="h-full w-full">
                  <AvatarImage alt={displayName} src={user.image} />
                  <AvatarFallback className="bg-gray-200 font-bold text-gray-600 text-xl">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="font-bold text-gray-600 text-xl dark:text-gray-300">
                  {userInitial}
                </span>
              )}
            </div>

            <p className="mb-2 font-semibold text-base text-gray-900 dark:text-gray-100">
              안녕하세요, {displayName}님
            </p>

            <span className="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-0.5 font-medium text-gray-700 text-xs dark:border-gray-600 dark:text-gray-300">
              {roleLabel}
            </span>

            {/* Department and Employee ID */}
            {/* {(user?.department_name || user?.employee_id) && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {user?.department_name && `부서: ${user.department_name}`}
                  {user?.department_name && user?.employee_id && " | "}
                  {user?.employee_id && `사번: ${user.employee_id}`}
                </p>
              </div>
            )} */}
          </div>

          <div className="px-4 pt-4">
            <Button
              className="w-full justify-center gap-2"
              onClick={onLogout}
              size="sm"
              variant="outline"
            >
              <LogOut className="h-4 w-4" />
              <span>로그아웃</span>
            </Button>
          </div>

          <div className="px-4 pt-3 pb-4">
            <div className="flex justify-center gap-4 text-gray-500 text-xs dark:text-gray-400">
              <button
                className="transition-colors hover:text-gray-700 dark:hover:text-gray-300"
                type="button"
              >
                개인정보처리방침
              </button>
              <span className="text-gray-300">·</span>
              <button
                className="transition-colors hover:text-gray-700 dark:hover:text-gray-300"
                type="button"
              >
                이용약관
              </button>
            </div>
          </div>
        </Card>
      </div>
    </>
  )

  return createPortal(cardContent, document.body)
}
