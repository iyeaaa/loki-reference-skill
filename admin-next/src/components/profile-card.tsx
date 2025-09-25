'use client'

import { LogOut, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

interface ProfileCardProps {
  isOpen: boolean
  onClose: () => void
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    user_role?: string | null
    department_name?: string | null
    employee_id?: string | null
  }
  isAdmin?: boolean
  onAdminClick?: () => void
  onLogout?: () => void
}

export function ProfileCard({
  isOpen,
  onClose,
  user,
  onLogout,
}: ProfileCardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const displayName = user?.name || '김하나'
  const displayEmail = user?.email || 'hana@hana.com'
  const userInitial = displayName.charAt(0).toUpperCase()

  // Role display mapping
  const getRoleDisplay = (role?: string | null) => {
    switch (role) {
      case 'admin':
        return '관리자'
      case 'internal_reviewer':
        return '내부 검수자'
      case 'external_reviewer':
        return '외부 검수자'
      default:
        return '사용자'
    }
  }

  const roleLabel = getRoleDisplay(user?.user_role)

  const cardContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      {/* Card */}
      <div className="fixed top-16 right-8 z-60">
        <Card className="rounded-xl shadow-xl overflow-hidden w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-end px-3 pb-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="text-center px-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {displayEmail}
          </p>

          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mx-auto mb-3">
            {user?.image ? (
              <Avatar className="w-full h-full">
                <AvatarImage src={user.image} alt={displayName} />
                <AvatarFallback className="bg-gray-200 text-gray-600 text-xl font-bold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-gray-600 dark:text-gray-300 text-xl font-bold">
                {userInitial}
              </span>
            )}
          </div>

          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            안녕하세요, {displayName}님
          </p>

          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            {roleLabel}
          </span>

          {/* Department and Employee ID */}
          {(user?.department_name || user?.employee_id) && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {user?.department_name && `부서: ${user.department_name}`}
                {user?.department_name && user?.employee_id && ' | '}
                {user?.employee_id && `사번: ${user.employee_id}`}
              </p>
            </div>
          )}
        </div>

        <div className="px-4">
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>로그아웃</span>
          </Button>
        </div>

        <div className="px-4 pb-2 pt-1">
          <div className="flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <button className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              개인정보처리방침
            </button>
            <span className="text-gray-300">·</span>
            <button className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
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