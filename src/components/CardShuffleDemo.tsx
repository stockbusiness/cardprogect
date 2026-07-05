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
import FloatingReactionCard, {
  type ReactionMode,
} from "@/components/FloatingReactionCard";
import { CARDS, CARD_COUNT } from "@/lib/cards";
import type { Phase } from "@/lib/types";

// シャッフル中(storm)の周回軌道。楕円軌道をキーフレーム化し、
// repeat: Infinity + linear でタップされるまでシームレスに回し続ける。
type StormOrbit = {
  front: boolean; // 前面で大きく舞うカードか(約1/3)
  closeup: boolean; // 手前に大きく迫ってくるカードか
  dir: 1 | -1; // 回転方向
  duration: number;
  x: number[];
  y: number[];
  rotate: number[];
  scale: number[];
  zIndex: number;
};

// カードの基準サイズ算出用(見た目のバランス調整のための分割数)
const SIZE_COLS = 6;
const SIZE_ROWS = 8;
const GAP = 5;
const CARD_RATIO = 1.5;
const ORBIT_STEPS = 8;
// 浮き上がり後にカードが正面(0度相当)を向くための累積回転量(360の倍数)
const SPIN_TURNS = 1080;

// SSRとクライアントで一致する決定的な擬似乱数(初期スタックの揺らぎ用)
function pseudoRandom(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeStormOrbits(bw: number, bh: number): StormOrbit[] {
  let closeupLeft = 5;
  return Array.from({ length: CARD_COUNT }, (_, i) => {
    const front = Math.random() < 0.34;
    let closeup = false;
    if (front && closeupLeft > 0 && Math.random() < 0.35) {
      closeup = true;
      closeupLeft--;
    }
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const rx = (front ? 0.26 + Math.random() * 0.16 : 0.12 + Math.random() * 0.14) * bw;
    const ry = (front ? 0.2 + Math.random() * 0.14 : 0.1 + Math.random() * 0.1) * bh;
    const cx = (Math.random() * 2 - 1) * bw * 0.1;
    const cy = (Math.random() * 2 - 1) * bh * 0.1;
    const phi = Math.random() * Math.PI * 2;
    const base = closeup
      ? 1.7
      : front
        ? 1.0 + Math.random() * 0.5
        : 0.55 + Math.random() * 0.2;
    const amp = closeup ? 0.55 : front ? 0.3 : 0.12;

    const x: number[] = [];
    const y: number[] = [];
    const rotate: number[] = [];
    const scale: number[] = [];
    for (let t = 0; t <= ORBIT_STEPS; t++) {
      const a = phi + (dir * Math.PI * 2 * t) / ORBIT_STEPS;
      x.push(cx + Math.cos(a) * rx);
      y.push(cy + Math.sin(a) * ry);
      // 720°はループ境界(0°)と見た目が一致するため継ぎ目が出ない
      rotate.push((dir * 720 * t) / ORBIT_STEPS);
      // sinの1周期分なのでループ境界でスケールも一致する
      scale.push(base * (1 + amp * Math.sin(phi * 3 + (Math.PI * 2 * t) / ORBIT_STEPS)));
    }
    return {
      front,
      closeup,
      dir,
      duration: 1.5 + Math.random() * 0.9,
      x,
      y,
      rotate,
      scale,
      zIndex: closeup ? 60 : front ? 40 : 10 + (i % 8),
    };
  });
}

const PHASE_TEXT: Record<Phase, string> = {
  idle: "カードを選ぶ準備をしましょう",
  expanding: "シャッフルしています…",
  storm: "直感で1枚、カードに触れてください",
  selected: "",
  result: "",
};

export default function CardShuffleDemo() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [orbits, setOrbits] = useState<StormOrbit[] | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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
    return () => timers.forEach(clearTimeout);
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  const later = (fn: () => void, ms: number) =>
    timersRef.current.push(setTimeout(fn, ms));

  // カードの基準サイズ
  const cardW = useMemo(() => {
    if (!board.w || !board.h) return 0;
    const byWidth = (board.w - GAP * (SIZE_COLS - 1) - 8) / SIZE_COLS;
    const byHeight = (board.h - GAP * (SIZE_ROWS - 1) - 8) / SIZE_ROWS / CARD_RATIO;
    return Math.floor(Math.min(byWidth, byHeight));
  }, [board]);
  const cardH = Math.floor(cardW * CARD_RATIO);

  const getTarget = useCallback(
    (i: number) => {
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
        default: {
          // idle: 中央に積まれた山札
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
    [phase, board]
  );

  // 演出フロー:expanding(0.7s) → storm(タップされるまで舞い続ける)
  const handleShuffle = () => {
    if (phase !== "idle" || !board.w) return;
    clearTimers();
    setSelectedId(null);
    setOrbits(makeStormOrbits(board.w, board.h));
    setPhase("expanding");
    later(() => setPhase("storm"), 700);
  };

  // シャッフル中のタップ=選択確定。
  // 選ばれたカードはゆっくり中央へ浮き上がり、他のカードはその場で静止して暗転する。
  const handleTap = (i: number) => {
    if (phase !== "storm") return;
    setSelectedId(i);
    setPhase("selected");
    later(() => setPhase("result"), reduced ? 1200 : 2600);
  };

  const handleRetry = () => {
    clearTimers();
    setSelectedId(null);
    setPhase("idle");
  };

  const storming = phase === "storm" && !!orbits;
  const revealed = phase === "selected" || phase === "result";
  const effectsActive = phase === "expanding" || phase === "storm";
  const selectedCard = selectedId !== null ? CARDS[selectedId] : null;

  // 浮き上がり後の拡大率
  const chosenScale =
    cardW > 0
      ? Math.min((board.w * 0.52) / cardW, (board.h * 0.62) / cardH)
      : 1;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <MagicParticles active={effectsActive} />

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
            let animateTarget: Record<string, number | number[]>;
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
            } else if (revealed && i === selectedId) {
              // 選ばれた1枚だけ、現在位置からゆっくり中央へ浮き上がる
              animateTarget = {
                x: 0,
                y: -board.h * 0.13,
                rotate: (o?.dir ?? 1) * SPIN_TURNS, // 360の倍数なので正面で止まる
                scale: chosenScale,
                opacity: 1,
              };
              trans = reduced
                ? { duration: 0.5 }
                : { duration: 1.6, ease: [0.22, 0.6, 0.2, 1] };
              z = 100;
            } else if (revealed) {
              // 他のカードはその場で静止し、暗くフェードアウト
              // (x/y/rotateを指定しないことで現在位置に凍結される)
              animateTarget = { opacity: 0, scale: 0.72 };
              trans = { duration: 0.8, ease: "easeOut" };
              z = o?.zIndex ?? i;
            } else {
              const t = getTarget(i);
              animateTarget = t;
              trans =
                phase === "expanding"
                  ? { duration: 0.5, delay: i * 0.006, ease: [0.2, 0.8, 0.3, 1] }
                  : { duration: 0.55, ease: "easeOut" };
              z = i;
            }

            const mode: ReactionMode =
              revealed && selectedId === i ? "chosen" : "none";

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
                }}
                animate={animateTarget}
                transition={trans}
                onTap={() => handleTap(i)}
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
    </div>
  );
}
