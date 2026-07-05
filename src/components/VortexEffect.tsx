"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Phase } from "@/lib/types";

const STREAK_COLORS = ["#a78bfa", "#60a5fa", "#e6c877"];

/**
 * 中央の光エフェクト群。
 * - expanding: 光のバースト + 魔法陣がフェードイン
 * - storm:     魔法陣が回転し続け、紫・青・金の光の軌跡(アーク)が周回する
 * - vortex:    光のリングが中央に収束する
 * すべて transform / opacity 中心で、box-shadowは使わない。
 */
function VortexEffect({ phase }: { phase: Phase }) {
  const circleVisible =
    phase === "expanding" || phase === "storm" || phase === "vortex";

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* シャッフル開始時の光のバースト */}
      <AnimatePresence>
        {phase === "expanding" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              key="burst"
              className="h-64 w-64 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(243,223,162,0.9) 0%, rgba(167,139,250,0.35) 45%, transparent 70%)",
              }}
              initial={{ scale: 0.1, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* 魔法陣 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative aspect-square w-[88%] max-w-[360px]"
          initial={false}
          animate={{
            opacity: circleVisible ? 0.9 : 0,
            scale: circleVisible ? 1 : 0.6,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* 外周(時計回り) */}
          <svg viewBox="0 0 200 200" className="spin-slow h-full w-full" aria-hidden>
            <circle cx="100" cy="100" r="96" fill="none" stroke="#d4af37" strokeWidth="0.9" opacity="0.9" />
            <circle cx="100" cy="100" r="90" fill="none" stroke="#a78bfa" strokeWidth="0.6" strokeDasharray="4 6" opacity="0.75" />
            <circle cx="100" cy="100" r="78" fill="none" stroke="#d4af37" strokeWidth="0.5" strokeDasharray="1 3" opacity="0.7" />
            {Array.from({ length: 12 }, (_, k) => {
              const a = (k * Math.PI) / 6;
              const x = 100 + Math.cos(a) * 84;
              const y = 100 + Math.sin(a) * 84;
              return (
                <path
                  key={k}
                  d={`M ${x} ${y - 3} l 2.2 3 l -2.2 3 l -2.2 -3 Z`}
                  fill="#e6c877"
                  opacity="0.85"
                />
              );
            })}
          </svg>
          {/* 内周(反時計回り):六芒星 */}
          <svg viewBox="0 0 200 200" className="spin-slow-rev absolute inset-0 h-full w-full" aria-hidden>
            <polygon points="100,42 150.2,129 49.8,129" fill="none" stroke="#e6c877" strokeWidth="0.8" opacity="0.75" />
            <polygon points="100,158 49.8,71 150.2,71" fill="none" stroke="#e6c877" strokeWidth="0.8" opacity="0.75" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="#60a5fa" strokeWidth="0.6" opacity="0.6" />
            <circle cx="100" cy="100" r="26" fill="none" stroke="#d4af37" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.8" />
          </svg>
        </motion.div>
      </div>

      {/* シャッフル中の光の軌跡(周回アーク) */}
      {phase === "storm" &&
        STREAK_COLORS.map((color, k) => (
          <div key={k} className="absolute inset-0 flex items-center justify-center">
            <div
              className="streak aspect-square"
              style={
                {
                  width: `${64 + k * 14}%`,
                  borderTopColor: color,
                  opacity: 0.55,
                  animationDirection: k % 2 ? "reverse" : "normal",
                  "--s-dur": `${1.1 + k * 0.45}s`,
                } as React.CSSProperties
              }
            />
          </div>
        ))}

      {/* 渦フェーズ:中央へ収束する光のリング */}
      {phase === "vortex" &&
        [0, 1, 2].map((k) => (
          <div key={k} className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="aspect-square w-[72%] rounded-full border-2"
              style={{ borderColor: k === 1 ? "#a78bfa" : "#e6c877" }}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 0.12, opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.85, delay: k * 0.14, ease: "easeIn" }}
            />
          </div>
        ))}
    </div>
  );
}

export default memo(VortexEffect);
