"use client";

import { memo, useMemo } from "react";

const COLORS = ["#e6c877", "#a78bfa", "#60a5fa", "#f3dfa2"];

// SSRとクライアントで一致する決定的な擬似乱数
function pr(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type MagicParticlesProps = {
  /** シャッフル中など、粒子を強めるフェーズかどうか */
  active: boolean;
};

/**
 * CSSのみで表現する背景エフェクト。
 * - 瞬く星屑
 * - 紫・青のぼんやりした光のオーブ(星雲風)
 * - 上昇していく金・紫・青の光の粒子
 * すべて transform / opacity のCSSアニメーションで、JSは介在しない。
 */
function MagicParticles({ active }: MagicParticlesProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${pr(i * 3 + 1) * 100}%`,
        top: `${pr(i * 3 + 2) * 100}%`,
        size: 1 + pr(i * 3 + 3) * 2,
        delay: `${pr(i * 5 + 4) * 3}s`,
      })),
    []
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        left: `${5 + pr(i * 7 + 11) * 90}%`,
        top: `${20 + pr(i * 7 + 12) * 75}%`,
        size: 2 + pr(i * 7 + 13) * 3.5,
        color: COLORS[i % COLORS.length],
        dur: `${3.5 + pr(i * 7 + 14) * 4}s`,
        delay: `${pr(i * 7 + 15) * 4}s`,
        dx: `${(pr(i * 7 + 16) - 0.5) * 70}px`,
        dy: `${-(50 + pr(i * 7 + 17) * 130)}px`,
        op: String(0.45 + pr(i * 7 + 18) * 0.5),
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={`s-${i}`}
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

      {/* 流れる霧 */}
      <span
        className="fog"
        style={{
          left: "-20%",
          top: "12%",
          width: 320,
          height: 200,
          background: "radial-gradient(ellipse, rgba(110,120,190,0.14) 0%, transparent 70%)",
        }}
      />
      <span
        className="fog"
        style={{
          left: "40%",
          top: "58%",
          width: 380,
          height: 240,
          background: "radial-gradient(ellipse, rgba(90,80,170,0.12) 0%, transparent 70%)",
          animationDelay: "-8s",
          animationDuration: "20s",
        }}
      />

      {/* 星雲風のオーブ */}
      <span
        className="orb"
        style={{
          left: "6%",
          top: "20%",
          width: 170,
          height: 170,
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
          animationDuration: "11s",
        }}
      />
      <span
        className="orb"
        style={{
          left: "58%",
          top: "56%",
          width: 210,
          height: 210,
          background: "radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 70%)",
          animationDuration: "14s",
        }}
      />
      <span
        className="orb"
        style={{
          left: "34%",
          top: "36%",
          width: 150,
          height: 150,
          background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
          animationDuration: "9s",
        }}
      />

      {/* 上昇する光の粒子(シャッフル中に強まる) */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          active ? "opacity-100" : "opacity-25"
        }`}
      >
        {particles.map((p, i) => (
          <span
            key={`p-${i}`}
            className="particle"
            style={
              {
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 6px ${p.color}`,
                "--p-dur": p.dur,
                "--p-delay": p.delay,
                "--p-dx": p.dx,
                "--p-dy": p.dy,
                "--p-op": p.op,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

export default memo(MagicParticles);
