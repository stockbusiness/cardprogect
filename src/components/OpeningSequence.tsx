"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import MagicCircle from "@/components/MagicCircle";
import { soundManager } from "@/lib/sound";

// SSRとクライアントで一致する決定的な擬似乱数
function pr(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const SIL_COUNT = 14;
const TOTAL = 10; // 本編の長さ(秒)

/**
 * ページアクセス時のオープニング演出。
 * 最初に「タップして始める」ゲートを表示し、そのタップ(ユーザー操作)を
 * きっかけにBGM付きの本編(約10秒)を再生する。ブラウザの自動再生制限のため、
 * 音を鳴らすにはこのゲートが必要。
 *
 * 本編:闇と霧 → 光の粒子 → 宇宙的な背景 → 魔法陣 → カードの影 →
 * 一斉に舞い上がって渦を描く → 閃光 → 霧が晴れてトップ画面へ。
 * 本編中のタップでスキップ可能。すべて transform / opacity のみ。
 */
export default function OpeningSequence({ onDone }: { onDone: () => void }) {
  const reduced = !!useReducedMotion();
  const [started, setStarted] = useState(false);
  const doneRef = useRef(false);

  const finish = (skipped: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (skipped) soundManager.stopOpening(); // 自然終了時は余韻を残す
    onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(
      () => finishRef.current(false),
      reduced ? 1400 : TOTAL * 1000
    );
    return () => clearTimeout(t);
  }, [started, reduced]);

  const handleTap = () => {
    if (!started) {
      if (!reduced) soundManager.startOpening(TOTAL);
      setStarted(true);
      return;
    }
    finish(true);
  };

  // カードの影の軌道(出現位置・飛散方向・渦の経由点)
  const sils = useMemo(
    () =>
      Array.from({ length: SIL_COUNT }, (_, i) => {
        const a = (i / SIL_COUNT) * Math.PI * 2 + pr(i) * 0.5;
        const a2 = a + 1.9; // 渦を描くための位相ずらし
        const dir = i % 2 === 0 ? 1 : -1;
        return {
          // 出現時:霧の中に散らばる影
          ax: `${Math.cos(a) * (12 + pr(i + 20) * 10)}vw`,
          ay: `${Math.sin(a) * (8 + pr(i + 40) * 8)}vh`,
          // 一斉に飛び出す(画面外近くまで)
          bx: `${Math.cos(a) * 46}vw`,
          by: `${Math.sin(a) * 34}vh`,
          // 渦の経由点
          cx: `${Math.cos(a2) * 26}vw`,
          cy: `${Math.sin(a2) * 20}vh`,
          rot: dir * (540 + Math.floor(pr(i + 60) * 3) * 180),
          delay: pr(i + 80) * 0.2,
        };
      }),
    []
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: `${pr(i * 7 + 5) * 100}%`,
        top: `${pr(i * 7 + 6) * 100}%`,
        size: 1 + pr(i * 7 + 7) * 2.6,
        delay: `${pr(i * 7 + 8) * 2.5}s`,
      })),
    []
  );

  // ---- ゲート画面(タップで開始 = 音声の解禁) ----
  if (!started) {
    return (
      <motion.div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 overflow-hidden"
        style={{ background: "#04060f" }}
        onTap={handleTap}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
          <div className="relative aspect-square w-[110%] max-w-[460px]">
            <MagicCircle />
          </div>
        </div>
        {stars.slice(0, 18).map((s, i) => (
          <span
            key={`gs-${i}`}
            className="star"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
            }}
          />
        ))}
        <p className="text-[10px] tracking-[0.5em] text-gold-500/70">
          TAROT READING
        </p>
        <h1 className="text-2xl font-semibold tracking-[0.3em] text-gold-300">
          運命のカード診断
        </h1>
        <motion.p
          className="mt-8 text-sm tracking-[0.35em] text-gold-300/90"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          タップして始める
        </motion.p>
        <p className="text-[10px] tracking-[0.2em] text-gold-300/40">
          ※ 音が流れます
        </p>
      </motion.div>
    );
  }

  if (reduced) {
    // 動きを減らす設定では黒からのフェードのみ
    return (
      <motion.div
        className="fixed inset-0 z-40 bg-navy-950"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.2, delay: 0.2 }}
        onTap={handleTap}
      />
    );
  }

  // ---- 本編(約10秒) ----
  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-hidden"
      style={{ background: "#04060f" }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: TOTAL, times: [0, 0.92, 1], ease: "easeInOut" }}
      onTap={handleTap}
    >
      {/* 宇宙のような背景(ゆっくり見えてくる) */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 30% 30%, rgba(88,58,160,0.35), transparent 65%), radial-gradient(ellipse 60% 45% at 70% 65%, rgba(37,60,150,0.3), transparent 65%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.0, delay: 2.2 }}
      />

      {/* 霧(ゆっくり広がる) */}
      {[
        { left: "-25%", top: "8%", w: 340, h: 220, c: "rgba(110,120,190,0.2)", d: "0s" },
        { left: "35%", top: "45%", w: 400, h: 260, c: "rgba(90,80,170,0.18)", d: "-6s" },
        { left: "-10%", top: "62%", w: 320, h: 210, c: "rgba(70,90,180,0.16)", d: "-11s" },
      ].map((f, i) => (
        <motion.span
          key={`fog-${i}`}
          className="fog"
          style={{
            left: f.left,
            top: f.top,
            width: f.w,
            height: f.h,
            background: `radial-gradient(ellipse, ${f.c} 0%, transparent 70%)`,
            animationDelay: f.d,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2.0, delay: 0.2 + i * 0.4 }}
        />
      ))}

      {/* 光の粒子 */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 1.2 }}
      >
        {stars.map((s, i) => (
          <span
            key={`st-${i}`}
            className="star"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
            }}
          />
        ))}
      </motion.div>

      {/* 金色の魔法陣がゆっくり浮かび上がる */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative aspect-square w-[92%] max-w-[380px]"
          initial={{ opacity: 0, scale: 0.55 }}
          animate={{ opacity: [0, 0.95, 0.95, 0.4], scale: [0.55, 1, 1.05, 1.18] }}
          transition={{ duration: TOTAL - 3.2, delay: 3.2, times: [0, 0.3, 0.85, 1] }}
        >
          <MagicCircle />
        </motion.div>
      </div>

      {/* カードのシルエット:霧の中に現れ、一斉に飛び出し、渦を描いて収束 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {sils.map((s, i) => (
          <motion.div
            key={`sil-${i}`}
            className="absolute h-[13vh] w-[6.2vh] rounded-[10%] border border-gold-500/45 will-change-transform"
            style={{
              background:
                "linear-gradient(160deg, rgba(22,34,79,0.95) 0%, rgba(7,11,28,0.98) 70%)",
            }}
            initial={{ x: s.ax, y: s.ay, rotate: 0, scale: 0.9, opacity: 0 }}
            animate={{
              x: [s.ax, s.ax, s.bx, s.cx, "0vw"],
              y: [s.ay, s.ay, s.by, s.cy, "0vh"],
              rotate: [0, 0, s.rot * 0.4, s.rot * 0.75, s.rot],
              scale: [0.9, 1, 1.2, 1, 0.3],
              opacity: [0, 0.85, 1, 1, 0],
            }}
            transition={{
              duration: 4.6,
              delay: 5.0 + s.delay,
              times: [0, 0.26, 0.52, 0.78, 1],
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* 渦の光の軌跡 */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 2.6, delay: 7.2, times: [0, 0.5, 1] }}
      >
        <div
          className="streak aspect-square w-[70%]"
          style={{ borderTopColor: "#a78bfa", "--s-dur": "1.1s" } as React.CSSProperties}
        />
        <div
          className="streak absolute aspect-square w-[86%]"
          style={
            {
              borderTopColor: "#e6c877",
              "--s-dur": "1.5s",
              animationDirection: "reverse",
            } as React.CSSProperties
          }
        />
      </motion.div>

      {/* 最後の閃光 */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(243,223,162,0.95) 0%, rgba(167,139,250,0.5) 35%, transparent 70%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ duration: TOTAL, times: [0, 0.88, 0.925, 1] }}
      />

      {/* スキップ案内 */}
      <motion.p
        className="absolute inset-x-0 bottom-8 text-center text-[11px] tracking-[0.3em] text-gold-300/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 1, delay: 1.2 }}
      >
        タップでスキップ
      </motion.p>
    </motion.div>
  );
}
