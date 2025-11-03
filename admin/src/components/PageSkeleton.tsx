/**
 * PageSkeleton 컴포넌트
 * 페이지 로딩 중 표시되는 스켈레톤 레이아웃
 */

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fadeVariants,
  shouldReduceMotion,
  staggerContainerFastVariants,
  staggerItemVariants,
} from "@/lib/animations"

export function PageSkeleton() {
  const reducedMotion = shouldReduceMotion()

  return (
    <motion.div
      className="space-y-6"
      variants={reducedMotion ? undefined : fadeVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 통계 카드 그리드 */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={reducedMotion ? undefined : staggerContainerFastVariants}
      >
        {[...Array(4)].map((_, i) => (
          <motion.div key={i} variants={reducedMotion ? undefined : staggerItemVariants}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* 콘텐츠 카드들 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

/**
 * TableSkeleton - 테이블 페이지용 스켈레톤
 */
export function TableSkeleton() {
  const reducedMotion = shouldReduceMotion()

  return (
    <motion.div
      className="space-y-4"
      variants={reducedMotion ? undefined : fadeVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 헤더 & 액션 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <Skeleton className="h-10 w-full max-w-sm" />
          </div>
          <div className="divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * FormSkeleton - 폼 페이지용 스켈레톤
 */
export function FormSkeleton() {
  const reducedMotion = shouldReduceMotion()

  return (
    <motion.div
      className="space-y-6"
      variants={reducedMotion ? undefined : fadeVariants}
      initial="hidden"
      animate="visible"
    >
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
