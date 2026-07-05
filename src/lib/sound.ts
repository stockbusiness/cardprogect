// Web Audio APIだけで効果音を合成するサウンドマネージャ(音源ファイル不要)。
// ブラウザの自動再生制限のため、AudioContextは最初のユーザー操作
// (シャッフルボタンのタップなど)をきっかけに生成・再開する。

type ToneOpts = {
  type?: OscillatorType;
  start?: number;
  dur?: number;
  vol?: number;
  glideTo?: number;
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private storm: {
    src: AudioBufferSourceNode;
    gain: GainNode;
    lfo: OscillatorNode;
  } | null = null;
  private openingGain: GainNode | null = null;
  private openingNodes: AudioScheduledSourceNode[] = [];
  private _muted = false;

  get muted() {
    return this._muted;
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.3, this.ctx.currentTime, 0.04);
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.3;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  private tone(
    freq: number,
    { type = "sine", start = 0, dur = 0.6, vol = 0.3, glideTo }: ToneOpts = {}
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** シャッフル開始:風切り音+上昇するきらめき */
  playShuffle() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.8);

    this.tone(523.25, { type: "triangle", dur: 0.5, vol: 0.12, glideTo: 1568 });
    [1318.5, 1568, 2093].forEach((f, k) =>
      this.tone(f, { start: 0.12 + k * 0.09, dur: 0.5, vol: 0.08 })
    );
  }

  /** シャッフル中:柔らかい風のループ(LFOでうねりを付ける) */
  startStorm() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.storm) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.value = 700;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.6);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
    this.storm = { src, gain: g, lfo };
  }

  stopStorm() {
    const ctx = this.ctx;
    if (!ctx || !this.storm) return;
    const { src, gain, lfo } = this.storm;
    this.storm = null;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    src.stop(ctx.currentTime + 0.8);
    lfo.stop(ctx.currentTime + 0.8);
  }

  /**
   * オープニング演出のBGM(すべて合成)。
   * 「タップして始める」のユーザー操作直後に呼ぶ想定なので自動再生制限に掛からない。
   * キュー時刻はOpeningSequenceのタイムライン(全体約10秒)に合わせている。
   */
  startOpening(total: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.stopOpening();
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.master);
    this.openingGain = out;
    const t0 = ctx.currentTime;
    const keep = (n: AudioScheduledSourceNode) => this.openingNodes.push(n);

    const tone = (
      freq: number,
      { type = "sine", start = 0, dur = 1, vol = 0.1, glideTo }: ToneOpts = {}
    ) => {
      const t = t0 + start;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(0.4, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.1);
      keep(osc);
    };
    const wind = (
      start: number,
      dur: number,
      f0: number,
      f1: number,
      vol: number,
      q = 1
    ) => {
      const t = t0 + start;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(out);
      src.start(t);
      src.stop(t + dur + 0.1);
      keep(src);
    };

    // 闇と霧:低いドローンと風
    wind(0, total - 0.5, 240, 420, 0.1, 0.6);
    tone(65.41, { start: 0.2, dur: total - 1, vol: 0.1 });
    tone(98, { start: 0.6, dur: total - 1.6, vol: 0.07 });
    // 光の粒子:小さな鈴
    [1318.5, 1568, 1046.5].forEach((f, k) =>
      tone(f, { start: 1.6 + k * 0.8, dur: 1.4, vol: 0.05 })
    );
    // 魔法陣の浮上:上昇音+鐘の和音
    tone(262, { type: "triangle", start: 3.3, dur: 1.6, vol: 0.1, glideTo: 1046.5 });
    [523.25, 659.25, 783.99].forEach((f, k) =>
      tone(f, { start: 4.4 + k * 0.06, dur: 2.4, vol: 0.07 })
    );
    // カードが一斉に飛び出す:風切り
    wind(6.1, 1.2, 300, 2400, 0.32, 1.2);
    // 渦:上昇するライザー
    wind(7.4, 1.8, 500, 3000, 0.3, 1.4);
    tone(523.25, { type: "triangle", start: 7.6, dur: 1.5, vol: 0.09, glideTo: 2093 });
    // 最後の閃光:バースト+輝く和音
    wind(9.0, 0.5, 3200, 3400, 0.4, 0.7);
    [1046.5, 1318.5, 1568, 2093].forEach((f, k) =>
      tone(f, { start: 9.05 + k * 0.05, dur: 2, vol: 0.08 })
    );
    [261.63, 329.63, 392].forEach((f, k) =>
      tone(f, { type: "triangle", start: 9.1 + k * 0.04, dur: 2.4, vol: 0.07 })
    );
  }

  /** オープニングBGMを停止(スキップ時)。自然終了時は呼ばず余韻を残す */
  stopOpening() {
    const ctx = this.ctx;
    if (!ctx || !this.openingGain) return;
    const g = this.openingGain;
    this.openingGain = null;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    const nodes = this.openingNodes;
    this.openingNodes = [];
    setTimeout(() => {
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          // 既に停止済み
        }
      });
      g.disconnect();
    }, 600);
  }

  /** シャッフル中のタップ反応:小さな鈴 */
  playTap() {
    this.tone(1174.7, { dur: 0.28, vol: 0.1 });
    this.tone(1568, { start: 0.05, dur: 0.35, vol: 0.08 });
  }

  /** 渦への吸い込み:下降する風 */
  playVortex() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(2200, t);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 1);
    this.tone(1046.5, { type: "triangle", dur: 0.8, vol: 0.1, glideTo: 262 });
  }

  /** 閃光:ノイズバースト+高いきらめき */
  playFlash() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.7;
    bp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.35);
    this.tone(2093, { dur: 0.5, vol: 0.12 });
    this.tone(2637, { start: 0.06, dur: 0.6, vol: 0.09 });
  }

  /** カード選択:ベルのアルペジオ+低音の余韻 */
  playSelect() {
    [659.25, 783.99, 987.77, 1318.5].forEach((f, k) =>
      this.tone(f, { start: k * 0.07, dur: 1.1, vol: 0.16 })
    );
    this.tone(261.63, { type: "triangle", dur: 1.2, vol: 0.1 });
  }

  /** フリップ:短いチャイム */
  playFlip() {
    this.tone(880, { dur: 0.35, vol: 0.14 });
    this.tone(1318.5, { start: 0.08, dur: 0.6, vol: 0.12 });
  }

  /** 結果表示:柔らかい和音 */
  playResult() {
    [523.25, 659.25, 783.99].forEach((f, k) =>
      this.tone(f, { type: "triangle", start: k * 0.03, dur: 2.2, vol: 0.09 })
    );
    this.tone(1046.5, { start: 0.25, dur: 1.6, vol: 0.06 });
  }
}

export const soundManager = new SoundManager();
