/**
 * AnimatedPage 래퍼 컴포넌트
 * 페이지 전환 시 부드러운 애니메이션 제공
 */

import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { pageVariants, shouldReduceMotion } from "@/lib/animations"

type AnimatedPageProps = {
  children: ReactNode
  className?: string
}

export function AnimatedPage({ children, className }: AnimatedPageProps) {
  const reducedMotion = shouldReduceMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      animate="enter"
      className={className}
      exit="exit"
      initial="initial"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  )
}
