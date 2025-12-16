import { motion } from "framer-motion"

/**
 * StarSpinner - Animated star spinner for thinking indicator
 * Extracted from SpinnerTestPage
 */
export function StarSpinner({ size = 16 }: { size?: number }) {
  // Create star shape using clip-path
  const starPath =
    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Main star */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
        }}
        className="absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600"
        style={{
          clipPath: starPath,
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Inner star glow */}
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          rotate: [360, 180, 0],
          opacity: [0.6, 1, 0.6],
        }}
        className="absolute bg-blue-300"
        style={{
          clipPath: starPath,
          inset: size * 0.125, // 1/8 of size for inner glow
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Outer glow effect */}
      <motion.div
        animate={{
          scale: [1.2, 1.5, 1.2],
          opacity: [0.4, 0.7, 0.4],
        }}
        className="absolute inset-0"
        style={{
          clipPath: starPath,
          filter: "blur(4px)",
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.6), transparent)",
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}
