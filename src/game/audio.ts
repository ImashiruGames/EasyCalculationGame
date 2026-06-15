import { getSharedAudioContext } from './bgm';

/** BGMと共有しているAudioContextを取得し、停止中なら再開を試みます。 */
function getAudioContext(): AudioContext | null {
  const context = getSharedAudioContext();
  if (context?.state === 'suspended') {
    void context.resume().catch(() => {
      // ブラウザが再生を許可しない場合は、効果音なしでゲームを続けます。
    });
  }

  return context;
}

/** 正解時に短い明るい音を鳴らします。ブラウザが音を止める場合は何もしません。 */
export function playCorrectSound(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  playTone(context, 740, start, 0.08);
  playTone(context, 980, start + 0.08, 0.1);
}

/** 共通ボタンを押した時の、短いクリック音です。 */
export function playButtonTapSound(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  playTone(context, 880, start, 0.045, { wave: 'triangle', volume: 0.045 });
  playTone(context, 1320, start + 0.025, 0.05, { wave: 'sine', volume: 0.035 });
}

/** まちがえた時に、きつすぎない短い下降音を鳴らします。 */
export function playWrongAnswerSound(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  playTone(context, 392, start, 0.12, { wave: 'triangle', volume: 0.075 });
  playTone(context, 330, start + 0.1, 0.16, { wave: 'sine', volume: 0.07 });
  window.navigator.vibrate?.(35);
}

/** 捕獲成功時に、着弾・上昇・きらめきを重ねたご褒美音とバイブレーションを発火します。 */
export function playCaptureFeedback(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;

    playTone(context, 196, start, 0.16, { wave: 'triangle', volume: 0.18 });
    playTone(context, 392, start + 0.03, 0.13, { wave: 'square', volume: 0.08 });
    playSweep(context, start + 0.1, 360, 1240, 0.42, 0.08);

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      playTone(context, frequency, start + 0.12 + index * 0.075, 0.18, {
        wave: 'triangle',
        volume: 0.13,
      });
    });

    [1318.51, 1567.98, 2093].forEach((frequency, index) => {
      playTone(context, frequency, start + 0.45 + index * 0.055, 0.16, {
        wave: 'sine',
        volume: 0.08,
      });
    });
  }

  window.navigator.vibrate?.([45, 30, 65, 35, 110]);
}

/** ログインボーナスのスタンプが押された瞬間の、紙に押すような短い音です。 */
export function playStampSound(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playTone(context, 176, start, 0.055, { wave: 'square', volume: 0.09 });
    playTone(context, 352, start + 0.018, 0.07, { wave: 'triangle', volume: 0.065 });
    playTone(context, 704, start + 0.06, 0.08, { wave: 'sine', volume: 0.045 });
  }

  window.navigator.vibrate?.([35, 20, 45]);
}

/** 報酬のポップアップが出る時の、軽いきらめき音です。 */
export function playRewardPopupSound(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  [659.25, 783.99, 1046.5].forEach((frequency, index) => {
    playTone(context, frequency, start + index * 0.07, 0.15, {
      wave: 'sine',
      volume: 0.055,
    });
  });
}

/** ショップ購入時の、コインが跳ねるような音です。 */
export function playShopPurchaseSound(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playTone(context, 523.25, start, 0.08, { wave: 'triangle', volume: 0.07 });
    playTone(context, 783.99, start + 0.07, 0.11, { wave: 'triangle', volume: 0.06 });
    playTone(context, 1174.66, start + 0.16, 0.16, { wave: 'sine', volume: 0.045 });
  }

  window.navigator.vibrate?.(35);
}

/** かけらやアメを交換した時の、変換完了を伝える音です。 */
export function playExchangeSound(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playSweep(context, start, 440, 880, 0.22, 0.045);
    playTone(context, 659.25, start + 0.16, 0.11, { wave: 'triangle', volume: 0.055 });
    playTone(context, 987.77, start + 0.24, 0.14, { wave: 'sine', volume: 0.045 });
  }

  window.navigator.vibrate?.([30, 25, 45]);
}

/** バトルでこちらが攻撃する時の、短い突進音です。 */
export function playBattleAttackSound(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  playSweep(context, start, 520, 1220, 0.13, 0.045);
  playTone(context, 196, start + 0.08, 0.08, { wave: 'square', volume: 0.045 });
}

/** バトルでダメージが入った時の、軽いヒット音です。 */
export function playBattleHitSound(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playTone(context, 164.81, start, 0.08, { wave: 'square', volume: 0.075 });
    playTone(context, 246.94, start + 0.035, 0.08, { wave: 'triangle', volume: 0.055 });
  }

  window.navigator.vibrate?.(28);
}

/** バトル勝利時の短いファンファーレです。 */
export function playBattleWinFanfare(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playChord(context, [523.25, 659.25, 783.99], start, 0.16, 0.07);
    playChord(context, [587.33, 739.99, 880], start + 0.16, 0.16, 0.068);
    playChord(context, [659.25, 830.61, 987.77], start + 0.32, 0.18, 0.068);
    playChord(context, [783.99, 987.77, 1174.66], start + 0.54, 0.38, 0.075);
  }

  window.navigator.vibrate?.([45, 30, 90]);
}

/** バトル敗北時の、暗くなりすぎない終了ジングルです。 */
export function playBattleLoseJingle(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playTone(context, 392, start, 0.16, { wave: 'triangle', volume: 0.065 });
    playTone(context, 349.23, start + 0.17, 0.18, { wave: 'triangle', volume: 0.06 });
    playTone(context, 293.66, start + 0.36, 0.32, { wave: 'sine', volume: 0.055 });
  }

  window.navigator.vibrate?.([55, 35, 55]);
}

/** 進化前の「ようすが…？」で期待感が上がる、だんだん高くなる効果音です。 */
export function playEvolutionBuildUp(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  playSweep(context, start, 220, 1568, 1.25, 0.075);
  playSweep(context, start + 0.24, 330, 2093, 1.05, 0.05);

  [392, 494, 587, 740, 880, 1175, 1397].forEach((frequency, index) => {
    playTone(context, frequency, start + index * 0.16, 0.13, {
      wave: index % 2 === 0 ? 'triangle' : 'sine',
      volume: 0.075 + index * 0.006,
    });
  });

  [1046.5, 1318.51, 1567.98].forEach((frequency, index) => {
    playTone(context, frequency, start + 0.86 + index * 0.09, 0.18, {
      wave: 'sine',
      volume: 0.055,
    });
  });
}

/** 進化後の姿が出た瞬間に鳴る、短い勝利ファンファーレです。 */
export function playEvolutionFanfare(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playChord(context, [523.25, 659.25, 783.99], start, 0.2, 0.085);
    playChord(context, [659.25, 783.99, 987.77], start + 0.18, 0.2, 0.08);
    playChord(context, [783.99, 987.77, 1174.66], start + 0.36, 0.24, 0.075);
    playChord(context, [1046.5, 1318.51, 1567.98], start + 0.62, 0.46, 0.085);
    playTone(context, 2093, start + 0.7, 0.16, { wave: 'sine', volume: 0.055 });
    playTone(context, 2637.02, start + 0.82, 0.18, { wave: 'sine', volume: 0.045 });
  }

  window.navigator.vibrate?.([55, 35, 95, 35, 140]);
}

/** ランクアップ時に、短い上昇音と明るいファンファーレを重ねて達成感を出します。 */
export function playRankUpFanfare(): void {
  const context = getAudioContext();
  if (context) {
    const start = context.currentTime;
    playSweep(context, start, 392, 1568, 0.5, 0.06);
    playChord(context, [523.25, 659.25, 783.99], start + 0.08, 0.18, 0.075);
    playChord(context, [587.33, 739.99, 880], start + 0.28, 0.18, 0.075);
    playChord(context, [659.25, 830.61, 987.77], start + 0.48, 0.2, 0.08);
    playChord(context, [783.99, 987.77, 1174.66], start + 0.74, 0.42, 0.085);
    playTone(context, 1567.98, start + 0.82, 0.16, { wave: 'sine', volume: 0.055 });
    playTone(context, 2093, start + 0.96, 0.2, { wave: 'sine', volume: 0.045 });
  }

  window.navigator.vibrate?.([40, 30, 70, 35, 130]);
}

interface ToneOptions {
  wave?: OscillatorType;
  volume?: number;
}

/** 短い効果音の基本音を鳴らします。音色と音量を渡して演出ごとに使い分けます。 */
function playTone(
  context: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  options: ToneOptions = {},
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const wave = options.wave ?? 'sine';
  const volume = options.volume ?? 0.14;

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

/** 複数の周波数を同時に鳴らし、短い和音を作ります。 */
function playChord(
  context: AudioContext,
  frequencies: number[],
  startTime: number,
  duration: number,
  volume: number,
): void {
  frequencies.forEach((frequency) => {
    playTone(context, frequency, startTime, duration, {
      wave: 'triangle',
      volume,
    });
  });
}

/** 捕獲成功時の高揚感を出すため、低音から高音へ駆け上がる音を重ねます。 */
function playSweep(
  context: AudioContext,
  startTime: number,
  fromFrequency: number,
  toFrequency: number,
  duration: number,
  volume: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(fromFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(toFrequency, startTime + duration);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}
