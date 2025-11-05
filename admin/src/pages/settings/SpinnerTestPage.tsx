import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// CSS-based Spinner Components
function DotSpinner() {
  return (
    <div className="flex gap-1 items-center">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
    </div>
  )
}

function RippleSpinner() {
  return (
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-ping" />
      <div className="absolute inset-1 border-2 border-blue-500/50 rounded-full animate-ping [animation-delay:0.3s]" />
      <div className="absolute inset-2 border-2 border-blue-500 rounded-full animate-ping [animation-delay:0.6s]" />
    </div>
  )
}

function PulseSpinner() {
  return (
    <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50" />
  )
}

function RotatingSpinner() {
  return (
    <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
  )
}

function BarSpinner() {
  return (
    <div className="flex gap-1 items-end h-6">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-blue-500 rounded-full animate-pulse"
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
          key={i}
          className="w-2 h-2 bg-blue-500 rounded-full"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{
            duration: 0.5,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  )
}

function MotionCircleSpinner() {
  return (
    <motion.div
      className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full"
      animate={{ rotate: 360 }}
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
    <div className="relative w-8 h-8">
      {/* Main star */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600"
        style={{
          clipPath: starPath,
        }}
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Inner star glow */}
      <motion.div
        className="absolute inset-2 bg-blue-300"
        style={{
          clipPath: starPath,
        }}
        animate={{
          scale: [1, 1.5, 1],
          rotate: [360, 180, 0],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Outer glow effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          clipPath: starPath,
          filter: "blur(8px)",
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.6), transparent)",
        }}
        animate={{
          scale: [1.2, 1.5, 1.2],
          opacity: [0.4, 0.7, 0.4],
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
        className="relative w-8 h-8"
        style={{
          transformStyle: "preserve-3d",
        }}
        animate={{
          rotateX: 360,
          rotateY: 360,
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 bg-blue-500/80 border border-blue-600"
          style={{ transform: "translateZ(16px)" }}
        />
        {/* Back */}
        <div
          className="absolute inset-0 bg-purple-500/80 border border-purple-600"
          style={{ transform: "translateZ(-16px) rotateY(180deg)" }}
        />
        {/* Right */}
        <div
          className="absolute inset-0 bg-cyan-500/80 border border-cyan-600"
          style={{ transform: "rotateY(90deg) translateZ(16px)" }}
        />
        {/* Left */}
        <div
          className="absolute inset-0 bg-pink-500/80 border border-pink-600"
          style={{ transform: "rotateY(-90deg) translateZ(16px)" }}
        />
        {/* Top */}
        <div
          className="absolute inset-0 bg-green-500/80 border border-green-600"
          style={{ transform: "rotateX(90deg) translateZ(16px)" }}
        />
        {/* Bottom */}
        <div
          className="absolute inset-0 bg-orange-500/80 border border-orange-600"
          style={{ transform: "rotateX(-90deg) translateZ(16px)" }}
        />
      </motion.div>
    </div>
  )
}

function Sphere3DSpinner() {
  return (
    <div className="relative w-8 h-8">
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: 360 }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-full h-full border border-blue-500 rounded-full"
            style={{
              transform: `rotateY(${i * 22.5}deg)`,
              opacity: 0.6,
            }}
          />
        ))}
      </motion.div>
      <motion.div
        className="absolute inset-2 bg-blue-500 rounded-full"
        animate={{
          scale: [1, 1.2, 1],
        }}
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
    <div className="relative w-10 h-10">
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{
          rotateX: [0, 360],
          rotateZ: [0, 180],
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-blue-500 rounded-full"
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
    <div className="relative w-10 h-12">
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: 360 }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {[...Array(8)].map((_, i) => (
          <div key={i}>
            {/* Left strand */}
            <motion.div
              className="absolute w-1 h-1 bg-blue-500 rounded-full"
              style={{
                left: "20%",
                top: `${i * 12}%`,
                transform: `rotateY(${i * 45}deg) translateZ(10px)`,
              }}
              animate={{
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1,
              }}
            />
            {/* Right strand */}
            <motion.div
              className="absolute w-1 h-1 bg-purple-500 rounded-full"
              style={{
                right: "20%",
                top: `${i * 12}%`,
                transform: `rotateY(${i * 45 + 180}deg) translateZ(10px)`,
              }}
              animate={{
                scale: [1, 1.3, 1],
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
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 bg-blue-600 rounded-full z-10" />
      </div>
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: 360 }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <motion.div
          className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full"
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
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateX: 360 }}
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <motion.div
          className="absolute w-1 h-1 bg-purple-400 rounded-full"
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
    <div className="relative w-24 h-24">
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
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, rgba(147, 197, 253, 0.2) 0%, transparent 70%)",
          transform: "scale(1.05)",
        }}
      />

      {/* Rotating grid lines and dots */}
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{
          rotateY: 360,
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        {/* Latitude rings for 3D effect */}
        {[...Array(latSegments)].map((_, latIndex) => {
          const lat = (latIndex / latSegments) * 180 - 90 // -90 to 90 degrees
          const radius = Math.cos((lat * Math.PI) / 180)
          const yOffset = Math.sin((lat * Math.PI) / 180)

          return (
            <div
              key={`lat-${latIndex}`}
              className="absolute left-1/2 top-1/2 border border-white/10"
              style={{
                width: `${radius * 100}%`,
                height: `${radius * 100}%`,
                marginLeft: `${-(radius * 100) / 2}%`,
                marginTop: `${yOffset * 50}%`,
                borderRadius: "50%",
                transform: `translateY(-50%) rotateX(90deg)`,
                transformStyle: "preserve-3d",
              }}
            />
          )
        })}

        {/* Longitude lines - vertical meridians */}
        {[...Array(lonSegments)].map((_, i) => {
          const angle = (i * 360) / lonSegments
          // Skip center lines (0 and 180 degrees)
          if (angle === 0 || angle === 180) return null

          return (
            <div
              key={`lon-${i}`}
              className="absolute left-1/2 top-1/2 w-full h-full"
              style={{
                transform: `translate(-50%, -50%) rotateY(${angle}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className="absolute left-1/2 top-0 w-px h-full"
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
        {[...Array(20)].map((_, i) => {
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
              key={`dot-${i}`}
              className="absolute w-1 h-1 bg-cyan-300/40 rounded-full"
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
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateZ: 360 }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
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
          className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />

        {/* Inner pulsing circle */}
        <motion.div
          className="absolute inset-3 bg-blue-500 rounded-full"
          animate={{
            scale: [0.8, 1, 0.8],
            opacity: [0.5, 1, 0.5],
          }}
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
            key={i}
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
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
    <div className="flex gap-1.5 p-4 bg-muted/50 rounded-lg w-fit">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2.5 h-2.5 bg-foreground/40 rounded-full"
          animate={{
            y: [0, -8, 0],
          }}
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Spinner Animation Test</h1>
        <p className="text-muted-foreground">LLM 응답 로딩을 위한 다양한 스피너 애니메이션 모음</p>
      </div>

      {/* CSS-based Spinners */}
      <Card>
        <CardHeader>
          <CardTitle>CSS-based Spinners</CardTitle>
          <CardDescription>Tailwind CSS 애니메이션을 활용한 스피너</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <DotSpinner />
              <span className="text-sm text-muted-foreground">Dot Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <RippleSpinner />
              <span className="text-sm text-muted-foreground">Ripple Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <PulseSpinner />
              <span className="text-sm text-muted-foreground">Pulse Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <RotatingSpinner />
              <span className="text-sm text-muted-foreground">Rotating Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <BarSpinner />
              <span className="text-sm text-muted-foreground">Bar Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              <span className="text-sm text-muted-foreground">Lucide Icon</span>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <MotionDotSpinner />
              <span className="text-sm text-muted-foreground">Motion Dots</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <MotionCircleSpinner />
              <span className="text-sm text-muted-foreground">Motion Circle</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <MotionScaleSpinner />
              <span className="text-sm text-muted-foreground">Star Spinner</span>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div
              className="flex flex-col items-center gap-4 p-6 border rounded-lg"
              style={{ perspective: "1000px" }}
            >
              <Cube3DSpinner />
              <span className="text-sm text-muted-foreground">3D Cube</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 p-6 border rounded-lg"
              style={{ perspective: "1000px" }}
            >
              <Sphere3DSpinner />
              <span className="text-sm text-muted-foreground">3D Sphere</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 p-6 border rounded-lg"
              style={{ perspective: "1000px" }}
            >
              <Ring3DSpinner />
              <span className="text-sm text-muted-foreground">3D Ring</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 p-6 border rounded-lg"
              style={{ perspective: "1000px" }}
            >
              <DNA3DSpinner />
              <span className="text-sm text-muted-foreground">DNA Helix</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 p-6 border rounded-lg"
              style={{ perspective: "1000px" }}
            >
              <Orbit3DSpinner />
              <span className="text-sm text-muted-foreground">3D Orbit</span>
            </div>

            <div
              className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-gradient-to-b from-slate-900 to-slate-800"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-background">
              <LLMLoadingSpinner />
              <span className="text-sm text-muted-foreground">LLM Loading Spinner</span>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-background">
              <TypingIndicator />
              <span className="text-sm text-muted-foreground">Typing Indicator</span>
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
            <Button onClick={simulateLLMResponse} disabled={isSimulating}>
              {isSimulating ? "Waiting for response..." : "Simulate LLM Request"}
            </Button>

            {isSimulating && (
              <div className="p-6 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <LLMLoadingSpinner />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">Processing your request...</p>
                    <p className="text-xs text-muted-foreground">
                      AI is analyzing your query and generating a response
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isSimulating && (
              <div className="p-6 border rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">
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
