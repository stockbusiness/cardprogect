"use client";

import { memo } from "react";

/**
 * 回転する二重の魔法陣(SVGのみ)。
 * 親要素のサイズいっぱいに描画する。回転はCSSアニメーション。
 */
function MagicCircle() {
  return (
    <>
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
    </>
  );
}

export default memo(MagicCircle);
