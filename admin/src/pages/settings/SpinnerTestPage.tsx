import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// CSS-based Spinner Components
function DotSpinner() {
  return (
    <div className="flex items-center gap-1">
      <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
    </div>
  )
}

function RippleSpinner() {
  return (
    <div className="relative h-8 w-8">
      <div className="absolute inset-0 animate-ping rounded-full border-2 border-blue-500/30" />
      <div className="absolute inset-1 animate-ping rounded-full border-2 border-blue-500/50 [animation-delay:0.3s]" />
      <div className="absolute inset-2 animate-ping rounded-full border-2 border-blue-500 [animation-delay:0.6s]" />
    </div>
  )
}

function PulseSpinner() {
  return (
    <div className="h-6 w-6 animate-pulse rounded-full bg-blue-500 shadow-blue-500/50 shadow-lg" />
  )
}

function RotatingSpinner() {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
  )
}

function BarSpinner() {
  return (
    <div className="flex h-6 items-end gap-1">
      {[...new Array(5)].map((_, i) => (
        <div
          className="w-1 animate-pulse rounded-full bg-blue-500"
          key={i}
          style={{
            height: `${20 + i * 10}%`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  )
}

// Framer Motion-based Spinners
function MotionDotSpinner() {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -6 },
  }

  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          animate="animate"
          className="h-2 w-2 rounded-full bg-blue-500"
          initial="initial"
          key={i}
          transition={{
            duration: 0.5,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            delay: i * 0.15,
          }}
          variants={dotVariants}
        />
      ))}
    </div>
  )
}

function MotionCircleSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      className="h-6 w-6 rounded-full border-2 border-blue-200 border-t-blue-500"
      transition={{
        duration: 1,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    />
  )
}

function MotionScaleSpinner() {
  // Create star shape using clip-path
  const starPath =
    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"

  return (
    <div className="relative h-8 w-8">
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
        className="absolute inset-2 bg-blue-300"
        style={{
          clipPath: starPath,
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
          filter: "blur(8px)",
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

// 3D Rotating Spinners
function Cube3DSpinner() {
  return (
    <div className="perspective-1000">
      <motion.div
        animate={{
          rotateX: 360,
          rotateY: 360,
        }}
        className="relative h-8 w-8"
        style={{
          transformStyle: "preserve-3d",
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 border border-blue-600 bg-blue-500/80"
          style={{ transform: "translateZ(16px)" }}
        />
        {/* Back */}
        <div
          className="absolute inset-0 border border-purple-600 bg-purple-500/80"
          style={{ transform: "translateZ(-16px) rotateY(180deg)" }}
        />
        {/* Right */}
        <div
          className="absolute inset-0 border border-cyan-600 bg-cyan-500/80"
          style={{ transform: "rotateY(90deg) translateZ(16px)" }}
        />
        {/* Left */}
        <div
          className="absolute inset-0 border border-pink-600 bg-pink-500/80"
          style={{ transform: "rotateY(-90deg) translateZ(16px)" }}
        />
        {/* Top */}
        <div
          className="absolute inset-0 border border-green-600 bg-green-500/80"
          style={{ transform: "rotateX(90deg) translateZ(16px)" }}
        />
        {/* Bottom */}
        <div
          className="absolute inset-0 border border-orange-600 bg-orange-500/80"
          style={{ transform: "rotateX(-90deg) translateZ(16px)" }}
        />
      </motion.div>
    </div>
  )
}

function Sphere3DSpinner() {
  return (
    <div className="relative h-8 w-8">
      <motion.div
        animate={{ rotateY: 360 }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {[...new Array(8)].map((_, i) => (
          <motion.div
            className="absolute h-full w-full rounded-full border border-blue-500"
            key={i}
            style={{
              transform: `rotateY(${i * 22.5}deg)`,
              opacity: 0.6,
            }}
          />
        ))}
      </motion.div>
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
        }}
        className="absolute inset-2 rounded-full bg-blue-500"
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}

function Ring3DSpinner() {
  return (
    <div className="relative h-10 w-10">
      <motion.div
        animate={{
          rotateX: [0, 360],
          rotateZ: [0, 180],
        }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {[...new Array(12)].map((_, i) => (
          <div
            className="absolute h-1.5 w-1.5 rounded-full bg-blue-500"
            key={i}
            style={{
              transform: `rotateZ(${i * 30}deg) translateY(-16px)`,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

function DNA3DSpinner() {
  return (
    <div className="relative h-12 w-10">
      <motion.div
        animate={{ rotateY: 360 }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {[...new Array(8)].map((_, i) => (
          <div key={i}>
            {/* Left strand */}
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
              }}
              className="absolute h-1 w-1 rounded-full bg-blue-500"
              style={{
                left: "20%",
                top: `${i * 12}%`,
                transform: `rotateY(${i * 45}deg) translateZ(10px)`,
              }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1,
              }}
            />
            {/* Right strand */}
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
              }}
              className="absolute h-1 w-1 rounded-full bg-purple-500"
              style={{
                right: "20%",
                top: `${i * 12}%`,
                transform: `rotateY(${i * 45 + 180}deg) translateZ(10px)`,
              }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1 + 0.75,
              }}
            />
          </div>
        ))}
      </motion.div>
    </div>
  )
}

function Orbit3DSpinner() {
  return (
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="z-10 h-2 w-2 rounded-full bg-blue-600" />
      </div>
      <motion.div
        animate={{ rotateY: 360 }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <motion.div
          className="absolute h-1.5 w-1.5 rounded-full bg-blue-400"
          style={{
            top: "50%",
            left: "50%",
            marginTop: "-3px",
            marginLeft: "-3px",
            transform: "translateZ(20px)",
          }}
        />
      </motion.div>
      <motion.div
        animate={{ rotateX: 360 }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <motion.div
          className="absolute h-1 w-1 rounded-full bg-purple-400"
          style={{
            top: "50%",
            left: "50%",
            marginTop: "-2px",
            marginLeft: "-2px",
            transform: "translateZ(15px)",
          }}
        />
      </motion.div>
    </div>
  )
}

function Globe3DSpinner() {
  // Create sphere vertices using latitude/longitude grid
  const latSegments = 16
  const lonSegments = 24

  return (
    <div className="relative h-24 w-24">
      {/* Main sphere with realistic shading - STATIC */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #3b82f6 0%, #1e40af 40%, #1e3a8a 70%, #0f172a 100%)",
          boxShadow:
            "inset -15px -15px 40px rgba(0,0,0,0.6), " +
            "inset 5px 5px 20px rgba(255,255,255,0.1), " +
            "0 0 40px rgba(59, 130, 246, 0.4)",
        }}
      />

      {/* Atmospheric glow layer - STATIC */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, rgba(147, 197, 253, 0.2) 0%, transparent 70%)",
          transform: "scale(1.05)",
        }}
      />

      {/* Rotating grid lines and dots */}
      <motion.div
        animate={{
          rotateY: 360,
        }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {/* Latitude rings for 3D effect */}
        {[...new Array(latSegments)].map((_, latIndex) => {
          const lat = (latIndex / latSegments) * 180 - 90 // -90 to 90 degrees
          const radius = Math.cos((lat * Math.PI) / 180)
          const yOffset = Math.sin((lat * Math.PI) / 180)

          return (
            <div
              className="absolute top-1/2 left-1/2 border border-white/10"
              key={`lat-${latIndex}`}
              style={{
                width: `${radius * 100}%`,
                height: `${radius * 100}%`,
                marginLeft: `${-(radius * 100) / 2}%`,
                marginTop: `${yOffset * 50}%`,
                borderRadius: "50%",
                transform: "translateY(-50%) rotateX(90deg)",
                transformStyle: "preserve-3d",
              }}
            />
          )
        })}

        {/* Longitude lines - vertical meridians */}
        {[...new Array(lonSegments)].map((_, i) => {
          const angle = (i * 360) / lonSegments
          // Skip center lines (0 and 180 degrees)
          if (angle === 0 || angle === 180) {
            return null
          }

          return (
            <div
              className="absolute top-1/2 left-1/2 h-full w-full"
              key={`lon-${i}`}
              style={{
                transform: `translate(-50%, -50%) rotateY(${angle}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className="absolute top-0 left-1/2 h-full w-px"
                style={{
                  transform: "translateX(-50%)",
                  background:
                    "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.15) 80%, transparent 100%)",
                }}
              />
            </div>
          )
        })}

        {/* Sphere surface dots for texture - 20 dots */}
        {[...new Array(20)].map((_, i) => {
          const lat = Math.random() * 160 - 80 // -80 to 80
          const lon = Math.random() * 360
          const phi = (90 - lat) * (Math.PI / 180)
          const theta = lon * (Math.PI / 180)
          const radius = 48 // Match half of 96px (w-24)

          const x = radius * Math.sin(phi) * Math.cos(theta)
          const y = -radius * Math.cos(phi)
          const z = radius * Math.sin(phi) * Math.sin(theta)

          return (
            <div
              className="absolute h-1 w-1 rounded-full bg-cyan-300/40"
              key={`dot-${i}`}
              style={{
                left: "50%",
                top: "50%",
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                transformStyle: "preserve-3d",
              }}
            />
          )
        })}
      </motion.div>

      {/* Orbit ring */}
      <motion.div
        animate={{ rotateZ: 360 }}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: "140%",
            height: "140%",
            marginLeft: "-70%",
            marginTop: "-70%",
            border: "2px solid rgba(96, 165, 250, 0.3)",
            borderRadius: "50%",
            transform: "rotateX(75deg)",
            transformStyle: "preserve-3d",
            boxShadow: "0 0 20px rgba(96, 165, 250, 0.2)",
          }}
        />
      </motion.div>
    </div>
  )
}

// LLM Response Loading Spinner
function LLMLoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="relative">
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          className="h-16 w-16 rounded-full border-4 border-blue-200 border-t-blue-500"
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />

        {/* Inner pulsing circle */}
        <motion.div
          animate={{
            scale: [0.8, 1, 0.8],
            opacity: [0.5, 1, 0.5],
          }}
          className="absolute inset-3 rounded-full bg-blue-500"
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Loading text */}
      <div className="flex gap-1">
        {["A", "I", " ", "is", " ", "thinking"].map((char, i) => (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            className="text-muted-foreground text-sm"
            initial={{ opacity: 0.3 }}
            key={i}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.1,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

// Typing Indicator for Chat
function TypingIndicator() {
  return (
    <div className="flex w-fit gap-1.5 rounded-lg bg-muted/50 p-4">
      {[0, 1, 2].map((i) => (
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          className="h-2.5 w-2.5 rounded-full bg-foreground/40"
          key={i}
          transition={{
            duration: 0.6,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  )
}

export default function SpinnerTestPage() {
  const [isSimulating, setIsSimulating] = useState(false)

  const simulateLLMResponse = () => {
    setIsSimulating(true)
    setTimeout(() => {
      setIsSimulating(false)
    }, 5000)
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">Spinner Animation Test</h1>
        <p className="text-muted-foreground">LLM 응답 로딩을 위한 다양한 스피너 애니메이션 모음</p>
      </div>

      {/* CSS-based Spinners */}
      <Card>
        <CardHeader>
          <CardTitle>CSS-based Spinners</CardTitle>
          <CardDescription>Tailwind CSS 애니메이션을 활용한 스피너</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <DotSpinner />
              <span className="text-muted-foreground text-sm">Dot Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <RippleSpinner />
              <span className="text-muted-foreground text-sm">Ripple Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <PulseSpinner />
              <span className="text-muted-foreground text-sm">Pulse Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <RotatingSpinner />
              <span className="text-muted-foreground text-sm">Rotating Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <BarSpinner />
              <span className="text-muted-foreground text-sm">Bar Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
              <span className="text-muted-foreground text-sm">Lucide Icon</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framer Motion Spinners */}
      <Card>
        <CardHeader>
          <CardTitle>Framer Motion Spinners</CardTitle>
          <CardDescription>Framer Motion을 활용한 고급 애니메이션</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <MotionDotSpinner />
              <span className="text-muted-foreground text-sm">Motion Dots</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <MotionCircleSpinner />
              <span className="text-muted-foreground text-sm">Motion Circle</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
              <MotionScaleSpinner />
              <span className="text-muted-foreground text-sm">Star Spinner</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3D Rotating Spinners */}
      <Card>
        <CardHeader>
          <CardTitle>3D Rotating Spinners</CardTitle>
          <CardDescription>3차원 회전 효과를 활용한 고급 스피너</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div
              className="flex flex-col items-center gap-4 rounded-lg border p-6"
              style={{ perspective: "1000px" }}
            >
              <Cube3DSpinner />
              <span className="text-muted-foreground text-sm">3D Cube</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 rounded-lg border p-6"
              style={{ perspective: "1000px" }}
            >
              <Sphere3DSpinner />
              <span className="text-muted-foreground text-sm">3D Sphere</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 rounded-lg border p-6"
              style={{ perspective: "1000px" }}
            >
              <Ring3DSpinner />
              <span className="text-muted-foreground text-sm">3D Ring</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 rounded-lg border p-6"
              style={{ perspective: "1000px" }}
            >
              <DNA3DSpinner />
              <span className="text-muted-foreground text-sm">DNA Helix</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 rounded-lg border p-6"
              style={{ perspective: "1000px" }}
            >
              <Orbit3DSpinner />
              <span className="text-muted-foreground text-sm">3D Orbit</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 rounded-lg border bg-gradient-to-b from-slate-900 to-slate-800 p-6"
              style={{ perspective: "1000px" }}
            >
              <Globe3DSpinner />
              <span className="text-sm text-white/90">3D Globe</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LLM Response Spinners */}
      <Card>
        <CardHeader>
          <CardTitle>LLM Response Loading</CardTitle>
          <CardDescription>LLM 응답 대기 시 최적화된 스피너</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-background p-6">
              <LLMLoadingSpinner />
              <span className="text-muted-foreground text-sm">LLM Loading Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-lg border bg-background p-6">
              <TypingIndicator />
              <span className="text-muted-foreground text-sm">Typing Indicator</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Demo */}
      <Card>
        <CardHeader>
          <CardTitle>LLM Response Simulation</CardTitle>
          <CardDescription>실제 LLM 응답 대기 시나리오 시뮬레이션</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button disabled={isSimulating} onClick={simulateLLMResponse}>
              {isSimulating ? "Waiting for response..." : "Simulate LLM Request"}
            </Button>

            {isSimulating && (
              <div className="rounded-lg border bg-muted/30 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <LLMLoadingSpinner />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-sm">Processing your request...</p>
                    <p className="text-muted-foreground text-xs">
                      AI is analyzing your query and generating a response
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isSimulating && (
              <div className="rounded-lg border bg-background p-6">
                <p className="text-muted-foreground text-sm">
                  버튼을 클릭하여 LLM 응답 대기 상태를 시뮬레이션하세요.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
