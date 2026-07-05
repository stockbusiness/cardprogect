"use client";

import { motion } from "framer-motion";

type ResultViewProps = {
  name: string;
  message: string;
  onRetry: () => void;
};

/**
 * カードフリップ後に表示する結果ビュー。
 * カード名・メッセージ・「もう一度試す」ボタンをフェードインさせる。
 */
export default function ResultView({ name, message, onRetry }: ResultViewProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 px-8 pb-10 text-center"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 1.15, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3 text-gold-500/80">
        <span className="h-px w-10 bg-gold-500/50" />
        <span className="text-xs tracking-[0.35em]">YOUR CARD</span>
        <span className="h-px w-10 bg-gold-500/50" />
      </div>

      <h2 className="text-2xl font-semibold tracking-[0.2em] text-gold-300">
        {name}
      </h2>

      <p className="max-w-[18rem] text-sm leading-7 text-gold-300/80">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="pointer-events-auto mt-2 rounded-full border border-gold-500/70 bg-navy-800/70 px-10 py-3 text-sm tracking-[0.25em] text-gold-300 shadow-[0_0_18px_rgba(212,175,55,0.25)] transition active:scale-95"
      >
        もう一度試す
      </button>
    </motion.div>
  );
}
