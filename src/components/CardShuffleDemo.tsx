"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import TarotCard from "@/components/TarotCard";
import ResultView from "@/components/ResultView";
import { CARDS, CARD_COUNT } from "@/lib/cards";

type Phase = "idle" | "fan" | "scatter" | "grid" | "reveal";

type Target = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  zIndex: number;
};

const COLS = 6;
const ROWS = 8;
const GAP = 5;
const CARD_RATIO = 1.5; // 縦横比(タロット風の縦長)

// SSRとクライアントで一致する決定的な擬似乱数(初期スタックの揺らぎ用)
function pseudoRandom(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const PHASE_TEXT: Record<Phase, string> = {
  idle: "カードを選ぶ準備をしましょう",
  fan: "シャッフルしています…",
  scatter: "シャッフルしています…",
  grid: "直感で1枚選んでください",
  reveal: "",
};

export default function CardShuffleDemo() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectable, setSelectable] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scatterSeed, setScatterSeed] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 盤面サイズを計測(リサイズにも追従)
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () =>
      setBoard({ w: el.clientWidth, h: el.clientHeight });
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

  // カードサイズ:横6枚・縦8枚が収まる最大サイズ
  const cardW = useMemo(() => {
    if (!board.w || !board.h) return 0;
    const byWidth = (board.w - GAP * (COLS - 1) - 8) / COLS;
    const byHeight = (board.h - GAP * (ROWS - 1) - 8) / ROWS / CARD_RATIO;
    return Math.floor(Math.min(byWidth, byHeight));
  }, [board]);
  const cardH = Math.floor(cardW * CARD_RATIO);

  // シャッフル中のランダムな飛散位置(seedが変わるたびに再生成)
  const scatterTargets = useMemo(() => {
    if (!board.w || scatterSeed === 0) return null;
    const rangeX = board.w / 2 - cardW * 0.7;
    const rangeY = board.h / 2 - cardH * 0.7;
    return Array.from({ length: CARD_COUNT }, () => ({
      x: (Math.random() * 2 - 1) * rangeX,
      y: (Math.random() * 2 - 1) * rangeY,
      rotate: (Math.random() * 2 - 1) * 200,
      scale: 0.85 + Math.random() * 0.6,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scatterSeed, board, cardW, cardH]);

  const getTarget = useCallback(
    (i: number): Target => {
      const base: Target = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, zIndex: i };

      switch (phase) {
        case "idle": {
          // 中央に積まれた山札。わずかな揺らぎで「束」に見せる
          return {
            ...base,
            x: (pseudoRandom(i) - 0.5) * 3,
            y: -i * 0.35 + (pseudoRandom(i + 50) - 0.5) * 2,
            rotate: (pseudoRandom(i + 100) - 0.5) * 5,
            scale: 1.75,
          };
        }
        case "fan": {
          // 扇状に展開
          const t = i / (CARD_COUNT - 1);
          const angle = -75 + 150 * t;
          const rad = (angle * Math.PI) / 180;
          const radius = Math.min(board.h * 0.3, board.w * 0.62);
          return {
            ...base,
            x: Math.sin(rad) * radius,
            y: (1 - Math.cos(rad)) * radius * 0.7 - board.h * 0.06,
            rotate: angle,
            scale: 1.25,
          };
        }
        case "scatter": {
          const s = scatterTargets?.[i];
          if (!s) return base;
          return { ...base, ...s };
        }
        case "grid": {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          return {
            ...base,
            x: (col - (COLS - 1) / 2) * (cardW + GAP),
            y: (row - (ROWS - 1) / 2) * (cardH + GAP),
          };
        }
        case "reveal": {
          if (i === selectedId) {
            // 選ばれた1枚だけ中央に拡大
            const scale = Math.min((board.w * 0.52) / cardW, (board.h * 0.62) / cardH);
            return { ...base, y: -board.h * 0.13, scale, zIndex: 100 };
          }
          // 他のカードは薄くフェードアウト
          return {
            ...base,
            x: (i % COLS - (COLS - 1) / 2) * (cardW + GAP),
            y: (Math.floor(i / COLS) - (ROWS - 1) / 2) * (cardH + GAP),
            scale: 0.85,
            opacity: 0,
          };
        }
      }
    },
    [phase, board, cardW, cardH, scatterTargets, selectedId]
  );

  const transitionFor = (i: number) => {
    switch (phase) {
      case "fan":
        return { duration: 0.55, delay: i * 0.003, ease: [0.3, 0.7, 0.4, 1] as const };
      case "scatter":
        return { duration: 0.68, delay: pseudoRandom(i + 7) * 0.08, ease: "easeInOut" as const };
      case "grid":
        return { duration: 0.62, delay: i * 0.0035, ease: [0.22, 1, 0.36, 1] as const };
      case "reveal":
        return { duration: 0.55, ease: [0.3, 0.7, 0.3, 1] as const };
      default:
        return { duration: 0.5, ease: "easeOut" as const };
    }
  };

  // 演出フロー:扇(0.7s) → 舞う(1.5s / 中間で再拡散) → 整列(0.8s)
  const handleShuffle = () => {
    if (phase !== "idle") return;
    clearTimers();
    setSelectable(false);
    setSelectedId(null);
    setPhase("fan");
    const t = (fn: () => void, ms: number) =>
      timersRef.current.push(setTimeout(fn, ms));
    t(() => {
      setScatterSeed(Date.now());
      setPhase("scatter");
    }, 700);
    t(() => setScatterSeed(Date.now() + 1), 1450); // 中間でもう一度舞わせる
    t(() => setPhase("grid"), 2200);
    t(() => setSelectable(true), 3000); // 整列完了後のみタップ可能
  };

  const handleSelect = (id: number) => {
    if (!selectable || phase !== "grid") return; // 選択後の再選択は不可
    setSelectable(false);
    setSelectedId(id);
    setPhase("reveal");
  };

  const handleRetry = () => {
    clearTimers();
    setSelectedId(null);
    setSelectable(false);
    setPhase("idle");
  };

  // 背景の星(決定的な位置なのでSSRでも安全)
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${pseudoRandom(i * 3 + 1) * 100}%`,
        top: `${pseudoRandom(i * 3 + 2) * 100}%`,
        size: 1 + pseudoRandom(i * 3 + 3) * 2,
        delay: pseudoRandom(i * 5 + 4) * 3,
      })),
    []
  );

  const selectedCard = selectedId !== null ? CARDS[selectedId] : null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      {/* 星空 */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* ヘッダー */}
      <header className="z-10 flex flex-col items-center gap-2 pb-2 pt-8">
        <p className="text-[10px] tracking-[0.5em] text-gold-500/70">
          TAROT READING
        </p>
        <h1 className="text-lg font-semibold tracking-[0.3em]">
          運命のカード診断
        </h1>
      </header>

      {/* メッセージ */}
      <div className="z-10 flex h-8 items-center justify-center">
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
        {cardW > 0 &&
          CARDS.map((card, i) => {
            const target = getTarget(i);
            return (
              <motion.div
                key={card.id}
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{
                  width: cardW,
                  height: cardH,
                  marginLeft: -cardW / 2,
                  marginTop: -cardH / 2,
                  zIndex: target.zIndex,
                }}
                animate={{
                  x: target.x,
                  y: target.y,
                  rotate: target.rotate,
                  scale: target.scale,
                  opacity: target.opacity,
                }}
                transition={transitionFor(i)}
                onTap={() => handleSelect(i)}
                whileTap={selectable && phase === "grid" ? { scale: 1.12 } : undefined}
              >
                <TarotCard
                  width={cardW}
                  height={cardH}
                  flipped={phase === "reveal" && selectedId === i}
                  name={card.name}
                />
              </motion.div>
            );
          })}
      </div>

      {/* フッター(ボタン) */}
      <footer className="z-10 flex h-32 items-start justify-center pt-4">
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
      {phase === "reveal" && selectedCard && (
        <ResultView
          name={selectedCard.name}
          message={selectedCard.message}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
