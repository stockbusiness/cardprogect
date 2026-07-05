export type Phase =
  | "idle" // カードの山
  | "expanding" // 扇状に広がる
  | "storm" // 激しく舞う(タップで反応演出)
  | "vortex" // 渦を巻いて中央に集まる
  | "grid" // 整列・選択待ち
  | "selected" // 選択確定(拡大+フリップ)
  | "result"; // 結果表示
