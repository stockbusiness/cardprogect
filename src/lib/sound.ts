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
