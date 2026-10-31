"use client";

import { useReducedMotion } from "framer-motion";

export function useMotionSafe() {
  const reduce = useReducedMotion();
  return {
    reduce: !!reduce,
    fadeUp: reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
        },
    stagger: reduce ? 0 : 0.06,
  };
}
