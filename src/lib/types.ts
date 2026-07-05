export type Phase =
  | "idle" // カードの山
  | "expanding" // 扇状に広がる
  | "storm" // 激しく舞う(タップで選択確定)
  | "selected" // 選択したカードがゆっくり浮き上がる
  | "result"; // 結果表示
