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
      videoRef.current.muted = false;
      setMuted(false);
      videoRef.current.play().catch(() => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/95">
      <div className="flex h-full w-full flex-col p-3 sm:p-4 landscape:justify-center">
        <div
          /* max-w-lg on portrait, full on landscape */
          className={
            "mx-auto w-full rounded-2xl bg-white shadow-2xl " +
            "max-w-md landscape:max-w-[90vw] landscape:lg:max-w-4xl p-4 sm:p-5"
          }
        >
          <div className="gap-4 landscape:flex landscape:items-start">
            {/* Header — compact row in portrait, column sidebar in landscape */}
            <div
              className={
                "mb-3 landscape:mb-0 landscape:w-40 landscape:shrink-0 landscape:pt-1 " +
                "flex items-center gap-3 landscape:flex-col landscape:items-start"
              }
            >
              <BrandMark size={36} />
              <div>
                <h2 className="font-bold text-emerald-800 landscape:text-base">
                  Welcome! 👋
                </h2>
                <p className="text-xs text-slate-500 landscape:text-xs landscape:mt-1">
                  A 60-second tour
                  <br />
                  <span className="hidden landscape:inline">(voiceover + subtitles)</span>
                  <span className="landscape:hidden">(subtitled)</span>
                </p>
              </div>
            </div>

            {/* Video area — fills remaining space */}
            <div className="min-w-0 flex-1">
              <div className="relative mx-auto max-w-full landscape:max-w-3xl">
                <video
                  ref={videoRef}
                  src="/welcome.mp4"
                  muted={muted}
                  playsInline
                  onEnded={finish}
                  className="h-auto w-full rounded-xl bg-black object-contain landscape:max-h-[80vh]"
                />
                {!started && (
                  <button
                    onClick={start}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60 text-white"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg">
                      ▶
                    </span>
                    <span className="mt-3 text-sm font-semibold">Tap to play with voiceover 🔊</span>
                    <span className="mt-1 text-xs text-white/70">(subtitled too)</span>
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
