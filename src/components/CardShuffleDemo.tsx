"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import TarotCard from "@/components/TarotCard";
import ResultView from "@/components/ResultView";
import MagicParticles from "@/components/MagicParticles";
import VortexEffect from "@/components/VortexEffect";
import OpeningSequence from "@/components/OpeningSequence";
import FloatingReactionCard, {
  type ReactionMode,
} from "@/components/FloatingReactionCard";
import { CARDS, CARD_COUNT } from "@/lib/cards";
import { soundManager } from "@/lib/sound";
import type { Phase } from "@/lib/types";

// キーフレーム配列(nullは「現在値から」)にも対応した値型
type Kf = number | Array<number | null>;

// シャッフル中(storm)の周回軌道。傾いた楕円+半径のうねりをキーフレーム化し、
// repeat: Infinity + linear でシームレスに回し続ける。
// うねりにより中央横断・画面外への飛び出し・カード同士の交差が生まれる。
type StormOrbit = {
  front: boolean; // 前面で大きく舞うカードか(約1/3)
  closeup: boolean; // 奥から手前へ大きく迫ってくるカードか
  dir: 1 | -1; // 回転方向
  duration: number;
  x: number[];
  y: number[];
  rotate: number[];
  scale: number[];
  zIndex: number;
};

const COLS = 6;
const ROWS = 8;
const GAP = 5;
const CARD_RATIO = 1.5;
const ORBIT_STEPS = 12;
// 整列後にカードが正面(0度相当)を向くための累積回転量(360の倍数)
const SPIN_TURNS = 1440;

// SSRとクライアントで一致する決定的な擬似乱数(初期スタックの揺らぎ用)
function pseudoRandom(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeStormOrbits(bw: number, bh: number): StormOrbit[] {
  let closeupLeft = 6;
  return Array.from({ length: CARD_COUNT }, (_, i) => {
    const front = Math.random() < 0.36;
    let closeup = false;
    if (front && closeupLeft > 0 && Math.random() < 0.35) {
      closeup = true;
      closeupLeft--;
    }
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    // 前面カードは画面外まで飛び出す大きな軌道
    const rx0 = (front ? 0.3 + Math.random() * 0.45 : 0.14 + Math.random() * 0.18) * bw;
    const ry0 = (front ? 0.22 + Math.random() * 0.26 : 0.1 + Math.random() * 0.12) * bh;
    const tilt = Math.random() * Math.PI; // 楕円軌道の傾き
    const wob = 0.25 + Math.random() * 0.4; // 半径のうねり(中央横断・交差を生む)
    const wphase = Math.random() * Math.PI * 2;
    const cx = (Math.random() * 2 - 1) * bw * 0.08;
    const cy = (Math.random() * 2 - 1) * bh * 0.08;
    const phi = Math.random() * Math.PI * 2;
    const turns = front ? (Math.random() < 0.5 ? 2 : 4) : 2; // 高速回転(720°/1440°)
    const base = closeup
      ? 1.6
      : front
        ? 0.9 + Math.random() * 0.7
        : 0.5 + Math.random() * 0.25;
    const amp = closeup ? 0.6 : front ? 0.45 : 0.15; // 奥→手前の深度変化

    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const x: number[] = [];
    const y: number[] = [];
    const rotate: number[] = [];
    const scale: number[] = [];
    for (let t = 0; t <= ORBIT_STEPS; t++) {
      const a = phi + (dir * Math.PI * 2 * t) / ORBIT_STEPS;
      // sin(2a)の整数周期なのでループ境界でも半径が一致する
      const r = 1 + wob * Math.sin(2 * a + wphase);
      const ex = Math.cos(a) * rx0 * r;
      const ey = Math.sin(a) * ry0 * r;
      x.push(cx + ex * cosT - ey * sinT);
      y.push(cy + ex * sinT + ey * cosT);
      // 360の倍数はループ境界(0°)と見た目が一致するため継ぎ目が出ない
      rotate.push((dir * 360 * turns * t) / ORBIT_STEPS);
      scale.push(base * (1 + amp * Math.sin(phi * 3 + (Math.PI * 2 * t) / ORBIT_STEPS)));
    }
    return {
      front,
      closeup,
      dir,
      duration: front ? 1.3 + Math.random() * 0.8 : 1.8 + Math.random() * 0.8,
      x,
      y,
      rotate,
      scale,
      zIndex: closeup ? 60 : front ? 40 : 10 + (i % 8),
    };
  });
}

const PHASE_TEXT: Record<Phase, string> = {
  opening: "",
  idle: "カードを選ぶ準備をしましょう",
  expanding: "シャッフルしています…",
  storm: "舞うカードに触れてみてください",
  vortex: "運命のカードが集まっていきます…",
  grid: "直感で1枚選んでください",
  selected: "",
  result: "",
};

export default function CardShuffleDemo() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>("opening");
  const [selectable, setSelectable] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reactingId, setReactingId] = useState<number | null>(null);
  const [orbits, setOrbits] = useState<StormOrbit[] | null>(null);
  const [muted, setMuted] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = !!useReducedMotion();

  // 盤面サイズを計測(リサイズにも追従)
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoard({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      soundManager.stopStorm();
    };
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  const later = (fn: () => void, ms: number) =>
    timersRef.current.push(setTimeout(fn, ms));

  // カードの基準サイズ:横6枚・縦8枚が収まる最大サイズ
  const cardW = useMemo(() => {
    if (!board.w || !board.h) return 0;
    const byWidth = (board.w - GAP * (COLS - 1) - 8) / COLS;
    const byHeight = (board.h - GAP * (ROWS - 1) - 8) / ROWS / CARD_RATIO;
    return Math.floor(Math.min(byWidth, byHeight));
  }, [board]);
  const cardH = Math.floor(cardW * CARD_RATIO);

  const getTarget = useCallback(
    (i: number): Record<string, Kf> => {
      const o = orbits?.[i];
      const dir = o?.dir ?? 1;
      const spin = dir * SPIN_TURNS; // 360の倍数なので見た目は正面

      switch (phase) {
        case "expanding": {
          // 扇状に一気に展開
          const t = i / (CARD_COUNT - 1);
          const angle = -75 + 150 * t;
          const rad = (angle * Math.PI) / 180;
          const radius = Math.min(board.h * 0.3, board.w * 0.62);
          return {
            x: Math.sin(rad) * radius,
            y: (1 - Math.cos(rad)) * radius * 0.7 - board.h * 0.06,
            rotate: angle,
            scale: 1.25,
            opacity: 1,
          };
        }
        case "vortex": {
          // 吸い込まれるように中央へ収束(スパイラルの中間点を経由)
          if (reduced) {
            return { x: 0, y: 0, rotate: spin, scale: 1.05, opacity: 1 };
          }
          const theta = (i / CARD_COUNT) * Math.PI * 4 + dir; // 2本腕の渦
          return {
            x: [null, Math.cos(theta) * board.w * 0.28, 0],
            y: [null, Math.sin(theta) * board.h * 0.21, 0],
            rotate: [null, spin - dir * 160, spin],
            scale: [null, 0.95, 1.08],
            opacity: 1,
          };
        }
        case "grid": {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          return {
            x: (col - (COLS - 1) / 2) * (cardW + GAP),
            y: (row - (ROWS - 1) / 2) * (cardH + GAP),
            rotate: spin,
            scale: 1,
            opacity: 1,
          };
        }
        case "selected":
        case "result": {
          if (i === selectedId) {
            // 選ばれた1枚だけ、ゆっくり中央へ浮き上がる
            const scale = Math.min(
              (board.w * 0.52) / cardW,
              (board.h * 0.62) / cardH
            );
            return { x: 0, y: -board.h * 0.13, rotate: spin, scale, opacity: 1 };
          }
          // 他のカードは整列位置のまま暗くフェードアウト
          return {
            x: ((i % COLS) - (COLS - 1) / 2) * (cardW + GAP),
            y: (Math.floor(i / COLS) - (ROWS - 1) / 2) * (cardH + GAP),
            rotate: spin,
            scale: 0.82,
            opacity: 0,
          };
        }
        default: {
          // opening / idle: 中央に積まれた山札
          return {
            x: (pseudoRandom(i) - 0.5) * 3,
            y: -i * 0.35 + (pseudoRandom(i + 50) - 0.5) * 2,
            rotate: (pseudoRandom(i + 100) - 0.5) * 5,
            scale: 1.75,
            opacity: 1,
          };
        }
      }
    },
    [phase, board, cardW, cardH, orbits, selectedId, reduced]
  );

  const transitionFor = (i: number): Transition => {
    switch (phase) {
      case "expanding":
        return { duration: 0.5, delay: i * 0.006, ease: [0.2, 0.8, 0.3, 1] };
      case "vortex":
        return reduced
          ? { duration: 0.5 }
          : { duration: 0.9, delay: i * 0.004, times: [0, 0.55, 1], ease: "easeInOut" };
      case "grid":
        return { duration: 0.65, delay: i * 0.0035, ease: [0.22, 1, 0.36, 1] };
      case "selected":
      case "result":
        return i === selectedId
          ? reduced
            ? { duration: 0.5 }
            : { duration: 1.6, ease: [0.22, 0.6, 0.2, 1] } // ゆっくり浮き上がる
          : { duration: 0.7, ease: "easeOut" };
      default:
        return { duration: 0.55, ease: "easeOut" };
    }
  };

  // 演出フロー:
  // expanding(0.7s) → storm(4.2s / タップは反応演出) → vortex(0.95s) → grid(整列後タップで選択確定)
  const handleShuffle = () => {
    if (phase !== "idle" || !board.w) return;
    clearTimers();
    setSelectable(false);
    setSelectedId(null);
    setReactingId(null);
    setOrbits(makeStormOrbits(board.w, board.h));
    setPhase("expanding");
    soundManager.playShuffle(); // ボタンタップ直後なので自動再生制限に掛からない
    later(() => {
      setPhase("storm");
      soundManager.startStorm();
    }, 700);
    later(() => {
      setPhase("vortex");
      soundManager.stopStorm();
      soundManager.playVortex();
    }, 4900);
    later(() => {
      setPhase("grid");
      soundManager.playFlash();
    }, 5850);
    later(() => setSelectable(true), 6600);
  };

  const handleTap = (i: number) => {
    if (phase === "storm") {
      // シャッフル中のタップは「反応演出」のみ。選択確定にはしない
      if (reactingId !== null) return;
      setReactingId(i);
      soundManager.playTap();
      reactionTimerRef.current = setTimeout(() => setReactingId(null), 700);
      return;
    }
    if (phase === "grid" && selectable) {
      // 整列後のタップで選択確定(以降の再選択は不可)
      setSelectable(false);
      setSelectedId(i);
      setPhase("selected");
      soundManager.playSelect();
      later(() => soundManager.playFlip(), reduced ? 300 : 1450);
      later(() => {
        setPhase("result");
        soundManager.playResult();
      }, reduced ? 1200 : 2600);
    }
  };

  const handleRetry = () => {
    clearTimers();
    soundManager.stopStorm();
    setSelectedId(null);
    setReactingId(null);
    setSelectable(false);
    setPhase("idle");
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundManager.setMuted(next);
  };

  const storming = phase === "storm" && !!orbits;
  const revealed = phase === "selected" || phase === "result";
  const effectsActive =
    phase === "expanding" || phase === "storm" || phase === "vortex";
  const selectedCard = selectedId !== null ? CARDS[selectedId] : null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <MagicParticles active={effectsActive} />

      {/* サウンドON/OFF */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "サウンドをオンにする" : "サウンドをオフにする"}
        className="absolute right-4 top-8 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/50 bg-navy-900/60 text-gold-300/90 transition active:scale-90"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" stroke="none" />
          {muted ? (
            <>
              <line x1="16" y1="9" x2="21" y2="15" />
              <line x1="21" y1="9" x2="16" y2="15" />
            </>
          ) : (
            <>
              <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
              <path d="M17 7a7 7 0 0 1 0 10" />
            </>
          )}
        </svg>
      </button>

      {/* ヘッダー */}
      <header className="z-20 flex flex-col items-center gap-2 pb-2 pt-8">
        <p className="text-[10px] tracking-[0.5em] text-gold-500/70">
          TAROT READING
        </p>
        <h1 className="text-lg font-semibold tracking-[0.3em]">
          運命のカード診断
        </h1>
      </header>

      {/* メッセージ */}
      <div className="z-20 flex h-8 items-center justify-center">
        <motion.p
          key={PHASE_TEXT[phase]}
          className="text-sm tracking-[0.15em] text-gold-300/90"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {PHASE_TEXT[phase]}
        </motion.p>
      </div>

      {/* 盤面 */}
      <div ref={boardRef} className="relative z-10 mx-4 flex-1">
        <VortexEffect phase={phase} />

        {/* トップ画面:山札の周囲の脈動する光 */}
        {(phase === "idle" || phase === "opening") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="pulse-glow h-64 w-64 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(230,200,119,0.35) 0%, rgba(167,139,250,0.15) 45%, transparent 70%)",
              }}
            />
          </div>
        )}

        {/* トップ画面ではカード群全体がゆっくり上下に漂う */}
        <motion.div
          className="absolute inset-0"
          animate={
            phase === "idle" && !reduced
              ? { y: [0, -7, 0] }
              : { y: 0 }
          }
          transition={
            phase === "idle" && !reduced
              ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4 }
          }
        >
          {/* motion blur風の残像ゴースト(前面カードの軌道を少し遅れて追従) */}
          {storming &&
            !reduced &&
            cardW > 0 &&
            orbits!.map((o, i) =>
              o.front ? (
                <motion.div
                  key={`ghost-${i}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 rounded-[8%] border border-gold-500/25 will-change-transform"
                  style={{
                    width: cardW,
                    height: cardH,
                    marginLeft: -cardW / 2,
                    marginTop: -cardH / 2,
                    zIndex: 5,
                    background:
                      "linear-gradient(150deg, rgba(96,165,250,0.25), rgba(167,139,250,0.3) 50%, rgba(230,200,119,0.25))",
                  }}
                  initial={{
                    x: o.x[0],
                    y: o.y[0],
                    rotate: 0,
                    scale: o.scale[0],
                    opacity: 0,
                  }}
                  animate={{
                    x: o.x,
                    y: o.y,
                    rotate: o.rotate,
                    scale: o.scale,
                    opacity: 0.35,
                  }}
                  transition={{
                    duration: o.duration,
                    ease: "linear",
                    repeat: Infinity,
                    delay: 0.1,
                    opacity: { duration: 0.3, delay: 0.2 },
                  }}
                />
              ) : null
            )}

          {/* カード本体 */}
          {cardW > 0 &&
            CARDS.map((card, i) => {
              const o = orbits?.[i];
              let animateTarget: Record<string, Kf>;
              let trans: Transition;
              let z: number;

              if (storming && o) {
                if (reduced) {
                  animateTarget = {
                    x: o.x[1],
                    y: o.y[1],
                    rotate: 0,
                    scale: o.scale[0],
                    opacity: o.front ? 1 : 0.6,
                  };
                  trans = { duration: 0.5 };
                } else {
                  animateTarget = {
                    x: o.x,
                    y: o.y,
                    rotate: o.rotate,
                    scale: o.scale,
                    opacity: o.front ? 1 : 0.6,
                  };
                  trans = {
                    duration: o.duration,
                    ease: "linear",
                    repeat: Infinity,
                    opacity: { duration: 0.4, repeat: 0 },
                  };
                }
                z = o.zIndex;
              } else {
                animateTarget = getTarget(i);
                trans = transitionFor(i);
                z = revealed && i === selectedId ? 100 : o?.zIndex ?? i;
              }
              if (reactingId === i) z = 200;

              const mode: ReactionMode =
                reactingId === i
                  ? "react"
                  : revealed && selectedId === i
                    ? "chosen"
                    : "none";

              return (
                <motion.div
                  key={card.id}
                  className="absolute left-1/2 top-1/2 will-change-transform"
                  style={{
                    width: cardW,
                    height: cardH,
                    marginLeft: -cardW / 2,
                    marginTop: -cardH / 2,
                    zIndex: z,
                    // 手前に迫るカードだけ縁をゴールドに発光させる(枚数を絞って軽量化)
                    boxShadow:
                      storming && o?.closeup
                        ? "0 0 14px 2px rgba(230,200,119,0.55)"
                        : undefined,
                  }}
                  animate={animateTarget}
                  transition={trans}
                  onTap={() => handleTap(i)}
                  whileTap={
                    selectable && phase === "grid" ? { scale: 1.12 } : undefined
                  }
                >
                  <FloatingReactionCard mode={mode} reduced={reduced}>
                    <TarotCard
                      width={cardW}
                      height={cardH}
                      flipped={revealed && selectedId === i}
                      flipDelay={reduced ? 0.3 : 1.45}
                      name={card.name}
                    />
                  </FloatingReactionCard>
                </motion.div>
              );
            })}
        </motion.div>
      </div>

      {/* フッター(ボタン) */}
      <footer className="z-20 flex h-32 items-start justify-center pt-4">
        {phase === "idle" && (
          <motion.button
            type="button"
            onClick={handleShuffle}
            className="rounded-full border border-gold-500/80 bg-gradient-to-b from-navy-700 to-navy-800 px-14 py-4 text-base tracking-[0.3em] text-gold-300 shadow-[0_0_24px_rgba(212,175,55,0.3)] transition active:scale-95"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            シャッフルする
          </motion.button>
        )}
      </footer>

      {/* 結果表示 */}
      {phase === "result" && selectedCard && (
        <ResultView
          name={selectedCard.name}
          message={selectedCard.message}
          onRetry={handleRetry}
        />
      )}

      {/* ページアクセス時のオープニング演出 */}
      {phase === "opening" && (
        <OpeningSequence onDone={() => setPhase("idle")} />
      )}
    </div>
  );
}
