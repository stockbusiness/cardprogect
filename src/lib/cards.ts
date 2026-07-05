export type TarotCardData = {
  id: number;
  name: string;
  message: string;
};

// デモ用の内部データ。本番ではDB/APIから取得する想定だが、
// このプロトタイプはフロントのみで完結させる。
export const CARD_COUNT = 48;

const DEMO_RESULT = {
  name: "光の導き",
  message:
    "今は新しい流れが始まるタイミングです。直感を信じて一歩進んでください。",
};

export const CARDS: TarotCardData[] = Array.from(
  { length: CARD_COUNT },
  (_, i) => ({
    id: i,
    // 提案用モックのため、どのカードを選んでも同じ結果を表示する
    name: DEMO_RESULT.name,
    message: DEMO_RESULT.message,
  })
);
