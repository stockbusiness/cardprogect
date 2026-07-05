"use client";

import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MagicCircle from "@/components/MagicCircle";
import type { Phase } from "@/lib/types";

const STREAK_COLORS = ["#a78bfa", "#60a5fa", "#e6c877"];

// SSRとクライアントで一致する決定的な擬似乱数
function pr(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 中央の光エフェクト群。
 * - expanding: 光のバースト + 魔法陣がフェードイン
 * - storm:     魔法陣の回転、光の軌跡(アーク)、中央を通るカードを照らす明滅
 * - vortex:    光のリングが収束し、粒子が中央に吸い込まれる
 * - grid:      整列の瞬間に閃光
 * すべて transform / opacity 中心で、box-shadowは使わない。
 */
function VortexEffect({ phase }: { phase: Phase }) {
  const circleVisible =
    phase === "expanding" || phase === "storm" || phase === "vortex";

  // 渦フェーズで中央に吸い込まれる粒子
  const implosion = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + pr(i + 3) * 0.6;
        const r = 46 + pr(i + 9) * 30;
        return {
          x: Math.cos(a) * r,
          y: Math.sin(a) * r * 0.8,
          color: ["#e6c877", "#a78bfa", "#60a5fa"][i % 3],
          delay: pr(i + 15) * 0.25,
        };
      }),
    []
  );

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
          <MagicCircle />
        </motion.div>
      </div>

      {/* シャッフル中:中央を通るカードを照らす淡い光 */}
      {phase === "storm" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="center-pulse h-48 w-48 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(243,223,162,0.5) 0%, rgba(167,139,250,0.2) 45%, transparent 70%)",
            }}
          />
        </div>
      )}

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

      {/* 渦フェーズ:収束する光のリング+吸い込まれる粒子 */}
      {phase === "vortex" && (
        <>
          {[0, 1, 2].map((k) => (
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
          <div className="absolute inset-0 flex items-center justify-center">
            {implosion.map((p, i) => (
              <motion.span
                key={`imp-${i}`}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={{ background: p.color }}
                initial={{ x: `${p.x}vw`, y: `${p.y}vh`, opacity: 0, scale: 1 }}
                animate={{ x: "0vw", y: "0vh", opacity: [0, 1, 0.9, 0], scale: 0.3 }}
                transition={{ duration: 0.8, delay: p.delay, ease: "easeIn" }}
              />
            ))}
          </div>
        </>
      )}

      {/* 整列の瞬間の閃光 */}
      {phase === "grid" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="h-72 w-72 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(243,223,162,0.85) 0%, rgba(167,139,250,0.4) 40%, transparent 70%)",
            }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 3.2, opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.7, times: [0, 0.25, 1], ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}

export default memo(VortexEffect);
