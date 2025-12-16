/**
 * 공통 애니메이션 variants 및 유틸리티
 * Framer Motion을 활용한 일관된 애니메이션 시스템
 */

import type { Transition, Variants } from "framer-motion"

/**
 * 공통 트랜지션 설정
 */
export const transitions = {
  // 부드러운 스프링 애니메이션
  spring: {
    type: "spring",
    stiffness: 260,
    damping: 20,
  } as Transition,

  // 빠른 스프링
  springFast: {
    type: "spring",
    stiffness: 400,
    damping: 25,
  } as Transition,

  // 부드러운 스프링
  springSmooth: {
    type: "spring",
    stiffness: 200,
    damping: 30,
  } as Transition,

  // Tween 애니메이션
  ease: {
    duration: 0.3,
    ease: [0.4, 0.0, 0.2, 1],
  } as Transition,

  easeFast: {
    duration: 0.2,
    ease: [0.4, 0.0, 0.2, 1],
  } as Transition,

  easeSlow: {
    duration: 0.5,
    ease: [0.4, 0.0, 0.2, 1],
  } as Transition,
}

/**
 * 페이지 트랜지션 variants
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: transitions.ease,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: transitions.easeFast,
  },
}

/**
 * Fade 애니메이션
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.ease,
  },
  exit: {
    opacity: 0,
    transition: transitions.easeFast,
  },
}

/**
 * Scale + Fade 애니메이션 (모달, 다이얼로그용)
 */
export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.easeFast,
  },
}

/**
 * Slide up 애니메이션
 */
export const slideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
}

/**
 * Slide down 애니메이션
 */
export const slideDownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
}

/**
 * Stagger children 컨테이너
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

/**
 * Stagger children - 빠른 버전
 */
export const staggerContainerFastVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
}

/**
 * Stagger item
 */
export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
}

/**
 * 카드 호버 효과
 */
export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
    y: 0,
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: transitions.springFast,
  },
  tap: {
    scale: 0.98,
  },
}

/**
 * 버튼 애니메이션
 */
export const buttonVariants: Variants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.03,
    transition: transitions.springFast,
  },
  tap: {
    scale: 0.97,
    transition: transitions.springFast,
  },
}

/**
 * 아이콘 회전 애니메이션
 */
export const iconRotateVariants: Variants = {
  rest: { rotate: 0 },
  hover: {
    rotate: 0, // Disabled rotation - no tilt effect
    transition: transitions.springFast,
  },
}

/**
 * 배지 펄스 애니메이션
 */
export const badgePulseVariants: Variants = {
  initial: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  },
}

/**
 * 백드롭 애니메이션
 */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
}

/**
 * 숫자 카운트업 애니메이션을 위한 유틸리티
 */
export function useCountUpAnimation(end: number, duration = 1000) {
  // Framer Motion의 useSpring, useTransform과 함께 사용
  return {
    from: 0,
    to: end,
    duration,
  }
}

/**
 * 접근성: prefers-reduced-motion 체크
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * 조건부 애니메이션 적용
 */
export function getAnimationProps(variants: Variants, reducedMotion = false) {
  if (reducedMotion || shouldReduceMotion()) {
    return {
      initial: false,
      animate: false,
      exit: false,
    }
  }
  return {
    variants,
    initial: "hidden",
    animate: "visible",
    exit: "exit",
  }
}
