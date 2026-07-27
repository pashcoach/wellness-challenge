"use client";

import { useRef, useState } from "react";
import BrandMark from "./BrandMark";

export default function WelcomeVideo({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function finish() {
    localStorage.setItem("welcomeSeen", "1");
    onDone();
  }

  function replay() {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/95 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <h2 className="font-bold text-emerald-800">Welcome to the challenge! 👋</h2>
            <p className="text-xs text-slate-500">A 60-second tour (subtitled — sound optional)</p>
          </div>
        </div>

        <video
          ref={videoRef}
          src="/welcome.mp4"
          autoPlay
          muted={muted}
          playsInline
          onEnded={finish}
          className="w-full rounded-xl bg-black"
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMuted(!muted);
                if (videoRef.current) videoRef.current.muted = !muted;
              }}
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
  );
}
