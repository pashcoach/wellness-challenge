"use client";

import { useEffect, useState } from "react";

// Photorealistic activity cutouts (AI-generated on matching dark green)
const ICONS = [
  "runner",
  "cyclist",
  "swimmer",
  "yoga",
  "hiker",
  "strength",
  "kettlebell",
  "dancer",
  "hockey",
  "golfer",
  "kids",
];

interface Floater {
  id: number;
  icon: string;
  left: number; // vw
  size: number; // px
  duration: number; // s
  delay: number; // s
  opacity: number;
  drift: number; // px horizontal sway
}

export default function ActivityBackdrop() {
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => {
    // Generate on client only to avoid hydration mismatch
    const items: Floater[] = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      icon: ICONS[i % ICONS.length],
      left: Math.random() * 88,
      size: 90 + Math.random() * 80, // 90–170px — large and clearly visible
      duration: 20 + Math.random() * 16,
      delay: -Math.random() * 36,
      opacity: 0.6 + Math.random() * 0.35,
      drift: 20 + Math.random() * 60,
    }));
    setFloaters(items);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950" />

      {/* Soft glowing orbs */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-teal-300/15 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />

      {/* Floating activity icons */}
      {floaters.map((f) => (
        <span
          key={f.id}
          className="activity-floater absolute select-none"
          style={
            {
              left: `${f.left}vw`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              "--drift": `${f.drift}px`,
              top: "110vh",
            } as React.CSSProperties
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/brand/people/${f.icon}.png`}
            alt=""
            width={f.size}
            height={f.size}
            draggable={false}
          />
        </span>
      ))}

      {/* Subtle ground-line silhouette */}
      <svg
        className="absolute bottom-0 left-0 w-full text-emerald-950/60"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path d="M0,80 C240,40 360,110 600,90 C840,70 960,20 1200,50 C1320,65 1380,60 1440,55 L1440,120 L0,120 Z" />
      </svg>
    </div>
  );
}
