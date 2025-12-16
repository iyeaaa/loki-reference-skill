/**
 * AnimatedNumber 컴포넌트
 * 숫자 카운트업 애니메이션을 제공합니다
 */

import { animate, motion, useMotionValue } from "framer-motion"
import { useEffect, useState } from "react"
import { shouldReduceMotion } from "@/lib/animations"

type AnimatedNumberProps = {
  value: number
  duration?: number
  decimals?: number
  className?: string
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({
  value,
  duration = 1,
  decimals = 0,
  className,
  prefix = "",
  suffix = "",
}: AnimatedNumberProps) {
  const reducedMotion = shouldReduceMotion()
  const [displayValue, setDisplayValue] = useState(value)
  const motionValue = useMotionValue(0)

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value)
      return
    }

    const controls = animate(motionValue, value, {
      duration,
      onUpdate: (latest) => {
        setDisplayValue(latest)
      },
    })

    return () => controls.stop()
  }, [value, duration, reducedMotion, motionValue])

  if (reducedMotion) {
    return (
      <span className={className}>
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
    )
  }

  return (
    <motion.span className={className}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </motion.span>
  )
}
