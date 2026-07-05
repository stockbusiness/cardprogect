"use client";

import { memo } from "react";
import { motion } from "framer-motion";

type TarotCardProps = {
  width: number;
  height: number;
  flipped: boolean;
  /** フリップ開始までの遅延(秒)。浮き上がり演出の完了後に反転させる用途 */
  flipDelay?: number;
  name: string;
};

/**
 * ネイビー×ゴールドのタロット風カード。
 * 画像アセトは使わず、CSS + インラインSVGだけで裏面/表面を描画する。
 * flipped で裏面 → 表面へ3Dフリップする。
 */
function TarotCard({ width, height, flipped, flipDelay = 0.45, name }: TarotCardProps) {
  return (
    <div className="perspective-1200" style={{ width, height }}>
      <motion.div
        className="preserve-3d relative h-full w-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, delay: flipped ? flipDelay : 0, ease: [0.45, 0, 0.25, 1] }}
      >
        {/* ---- 裏面 ---- */}
        <div
          className="backface-hidden absolute inset-0 overflow-hidden rounded-[8%_/_5.5%] border border-gold-500/80 shadow-[0_4px_18px_rgba(0,0,0,0.55)]"
          style={{
            background: "linear-gradient(160deg, #16224f 0%, #0b1230 55%, #0e1638 100%)",
          }}
        >
          {/* 斜めの織り模様 */}
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #d4af37 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, #d4af37 0 1px, transparent 1px 7px)",
            }}
          />
          {/* 内枠 */}
          <div className="absolute inset-[6%] rounded-[6%_/_4%] border border-gold-500/50" />
          {/* 中央の月と星の紋様 */}
          <svg
            viewBox="0 0 100 150"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <g fill="none" stroke="#d4af37" strokeWidth="1.6">
              <circle cx="50" cy="75" r="26" opacity="0.9" />
              <circle cx="50" cy="75" r="20" opacity="0.5" />
            </g>
            {/* 三日月 */}
            <path
              d="M58 61 A17 17 0 1 0 58 89 A13.5 13.5 0 1 1 58 61 Z"
              fill="#e6c877"
              opacity="0.95"
            />
            {/* 星 */}
            <path
              d="M62 70 l2.2 4.6 4.8 0.7 -3.5 3.4 0.8 4.9 -4.3 -2.3 -4.3 2.3 0.8 -4.9 -3.5 -3.4 4.8 -0.7 Z"
              fill="#f3dfa2"
            />
            {/* 上下の飾り */}
            <g fill="#d4af37" opacity="0.85">
              <path d="M50 22 l3 6 -3 6 -3 -6 Z" />
              <path d="M50 116 l3 6 -3 6 -3 -6 Z" />
              <circle cx="38" cy="28" r="1.4" />
              <circle cx="62" cy="28" r="1.4" />
              <circle cx="38" cy="122" r="1.4" />
              <circle cx="62" cy="122" r="1.4" />
            </g>
          </svg>
        </div>

        {/* ---- 表面 ---- */}
        <div
          className="backface-hidden absolute inset-0 overflow-hidden rounded-[8%_/_5.5%] border border-gold-400 shadow-[0_6px_24px_rgba(212,175,55,0.35)]"
          style={{
            transform: "rotateY(180deg)",
            background:
              "radial-gradient(circle at 50% 38%, #23306b 0%, #101a44 55%, #0b1230 100%)",
          }}
        >
          <div className="absolute inset-[5%] rounded-[6%_/_4%] border border-gold-500/60" />
          {/* 太陽と光条 */}
          <svg viewBox="0 0 100 150" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="sunGlow" cx="50%" cy="42%" r="45%">
                <stop offset="0%" stopColor="#f3dfa2" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#f3dfa2" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100" height="150" fill="url(#sunGlow)" />
            <g stroke="#e6c877" strokeWidth="1.4" opacity="0.9">
              {Array.from({ length: 12 }, (_, k) => {
                const a = (k * Math.PI) / 6;
                const x1 = 50 + Math.cos(a) * 17;
                const y1 = 63 + Math.sin(a) * 17;
                const x2 = 50 + Math.cos(a) * (k % 2 === 0 ? 27 : 22);
                const y2 = 63 + Math.sin(a) * (k % 2 === 0 ? 27 : 22);
                return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />;
              })}
            </g>
            <circle cx="50" cy="63" r="13" fill="#e6c877" />
            <circle cx="50" cy="63" r="13" fill="none" stroke="#f3dfa2" strokeWidth="1" />
            <text
              x="50"
              y="121"
              textAnchor="middle"
              fill="#f3dfa2"
              fontSize="10.5"
              fontFamily="'Shippori Mincho', serif"
              letterSpacing="1.5"
            >
              {name}
            </text>
            <text x="50" y="18" textAnchor="middle" fill="#d4af37" fontSize="7" letterSpacing="2">
              ✦ ✦ ✦
            </text>
          </svg>
        </div>
      </motion.div>
    </div>
  );
}

export default memo(TarotCard);
