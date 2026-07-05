"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export type ReactionMode =
  | "none"
  | "react" // シャッフル中のタップ反応:一瞬浮き上がって光る(選択確定ではない)
  | "chosen"; // 整列後の選択確定:強く光り続ける

type FloatingReactionCardProps = {
  mode: ReactionMode;
  reduced: boolean;
  children: ReactNode;
};

/**
 * カードを包むタップ反応レイヤー。
 * 外側のレイヤー(位置・軌道)には触れず、内側だけを拡大+ゴールドの縁取りで光らせるため、
 * シャッフルの動きを止めずに「浮き上がる」演出ができる。
 */
const SPARKS = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 + 0.4;
  return {
    dx: `${Math.cos(a) * (26 + (i % 3) * 10)}px`,
    dy: `${Math.sin(a) * (26 + ((i + 1) % 3) * 10)}px`,
    delay: `${i * 0.03}s`,
  };
});

export default function FloatingReactionCard({
  mode,
  reduced,
  children,
}: FloatingReactionCardProps) {
  const popScale = mode === "react" ? (reduced ? 1.15 : 1.7) : 1;

  return (
    <motion.div
      className="relative h-full w-full"
      animate={{ scale: popScale }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* 背後の光(radial-gradientのみ) */}
      {mode !== "none" && (
        <div
          className="pointer-events-none absolute -inset-[45%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(230,200,119,0.4) 0%, rgba(167,139,250,0.2) 40%, transparent 70%)",
          }}
        />
      )}

      {/* タップの瞬間に飛び散る光の粒 */}
      {mode !== "none" &&
        !reduced &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            className="sparkle"
            style={
              {
                "--sp-dx": s.dx,
                "--sp-dy": s.dy,
                animationDelay: s.delay,
              } as React.CSSProperties
            }
          />
        ))}

      {children}

      {/* ゴールドの縁取り */}
      <motion.div
        className="pointer-events-none absolute -inset-[5%] rounded-[10%] border-2 border-gold-300"
        style={{
          boxShadow:
            "0 0 16px 3px rgba(230,200,119,0.8), 0 0 42px 9px rgba(167,139,250,0.4)",
        }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: mode === "none" ? 0 : 1,
          scale: mode === "chosen" && !reduced ? [1, 1.05, 1] : 1,
        }}
        transition={
          mode === "chosen"
            ? {
                opacity: { duration: 0.3 },
                scale: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
              }
            : { duration: 0.2 }
        }
      />
    </motion.div>
  );
}
