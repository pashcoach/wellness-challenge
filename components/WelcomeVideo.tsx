"use client";

import { useRef, useState } from "react";
import BrandMark from "./BrandMark";

export default function WelcomeVideo({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  function finish() {
    localStorage.setItem("welcomeSeen", "1");
    onDone();
  }

  function start() {
    setStarted(true);
    if (videoRef.current) {
      // User gesture lets us start WITH sound
      videoRef.current.muted = false;
      setMuted(false);
      videoRef.current.play().catch(() => {
        // If unmuted play is blocked, fall back to muted
        if (videoRef.current) {
          videoRef.current.muted = true;
          setMuted(true);
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  }

  function replay() {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/95">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl landscape:max-w-4xl sm:p-5">
          <div className="landscape:flex landscape:items-center landscape:gap-5">
            {/* Header — moves beside video in landscape */}
            <div className="mb-3 flex items-center gap-3 landscape:mb-0 landscape:w-64 landscape:shrink-0 landscape:flex-col landscape:items-start">
              <BrandMark size={36} />
              <div>
                <h2 className="font-bold text-emerald-800 landscape:text-xl">
                  Welcome to the challenge! 👋
                </h2>
                <p className="text-xs text-slate-500 landscape:mt-1 landscape:text-sm">
                  A 60-second tour — subtitled, so sound is optional. Tip: rotate your phone for a
                  bigger view! 📱↔️
                </p>
              </div>
            </div>

            {/* Video area */}
            <div className="landscape:flex-1">
              <div className="relative">
                <video
                  ref={videoRef}
                  src="/welcome.mp4"
                  muted={muted}
                  playsInline
                  onEnded={finish}
                  className="max-h-[50vh] w-full rounded-xl bg-black landscape:max-h-[62vh]"
                />
                {!started && (
                  <button
                    onClick={start}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60 text-white"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg">
                      ▶
                    </span>
                    <span className="mt-3 text-sm font-semibold">Tap to play with sound 🔊</span>
                    <span className="mt-1 text-xs text-white/70">(subtitled — sound optional)</span>
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={toggleMute}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {muted ? "🔇 Unmute" : "🔊 Mute"}
                  </button>
                  <button
                    onClick={replay}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    ↺ Replay
                  </button>
                </div>
                <button
                  onClick={finish}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Get started →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
