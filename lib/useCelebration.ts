"use client";

import { useEffect, useRef } from "react";
import canvasConfetti from "canvas-confetti";

const CELEBRATION_MILESTONES = [10, 140, 280, 420, 560] as const;

export function useCelebration(totalPoints: number): void {
  const previousPoints = useRef(totalPoints);
  const celebratedMilestones = useRef(new Set<number>());

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (const milestone of CELEBRATION_MILESTONES) {
      const isFirstActivity = milestone === 10 && totalPoints === 10;
      const crossedMilestone = milestone !== 10
        && previousPoints.current < milestone
        && totalPoints >= milestone;

      if ((isFirstActivity || crossedMilestone) && !celebratedMilestones.current.has(milestone)) {
        celebratedMilestones.current.add(milestone);
        if (!reducedMotion) {
          canvasConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
    }

    previousPoints.current = totalPoints;
  }, [totalPoints]);
}
