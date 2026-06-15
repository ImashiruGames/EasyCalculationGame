import { normalizeStageId } from '../data/stageIdAliases';
import type { StageId } from './types';

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export type BaseBgmTrack = 'title' | 'home' | 'capture' | 'battle' | 'boss' | 'bossStrong' | 'dex' | 'shop';
export type BgmTrack = BaseBgmTrack | `capture:${StageId}`;

export interface BgmTrackOption {
  id: BgmTrack;
  label: string;
}

interface BgmPattern {
  bpm: number;
  wave: OscillatorType;
  volume: number;
  melody: Array<number | null>;
  bass: Array<number | null>;
  support: BgmSupportLayer;
  loopStart?: number;
}

interface BgmSupportLayer {
  wave: OscillatorType;
  volume: number;
  gate: number;
  notes: Array<number | null>;
}

interface BgmSection {
  repeats: number;
  melody: Array<number | null>;
  bass: Array<number | null>;
  support: Array<number | null>;
}

const BATTLE_SECTIONS: BgmSection[] = [
  {
    repeats: 1,
    melody: [67, null, 70, null, 72, null, 75, null, 74, null, 72, null, 70, null, 67, null],
    bass: [36, null, null, null, 36, null, null, null, 34, null, null, null, 36, null, null, null],
    support: [31, null, 31, null, 34, null, 36, null, 31, null, 34, null, 36, null, 38, null],
  },
  {
    repeats: 2,
    melody: [72, 72, 75, 72, 79, null, 77, null, 72, 72, 75, 72, 81, null, 79, null],
    bass: [43, null, 43, null, 46, null, 48, null, 43, null, 43, null, 50, null, 48, null],
    support: [31, 31, null, 31, 34, null, 36, null, 31, 31, null, 31, 38, null, 36, null],
  },
  {
    repeats: 2,
    melody: [74, null, 77, 79, null, 82, 81, null, 79, 77, 74, null, 72, null, 74, null],
    bass: [41, null, 41, null, 45, null, 48, null, 41, null, 45, null, 47, null, 48, null],
    support: [29, null, 36, 29, null, 36, 41, null, 29, null, 36, 29, 41, null, 43, null],
  },
  {
    repeats: 2,
    melody: [76, 76, 79, null, 83, 81, 79, null, 76, 79, 81, null, 84, null, 83, null],
    bass: [38, null, 38, null, 41, null, 43, null, 38, null, 41, null, 45, null, 43, null],
    support: [26, 26, null, 26, 31, null, 33, null, 26, 26, 31, null, 33, null, 38, null],
  },
  {
    repeats: 2,
    melody: [79, 81, 83, 84, 83, 81, 79, null, 77, 79, 81, 83, 86, null, 84, null],
    bass: [43, null, 43, 43, 46, null, 48, null, 50, null, 50, 48, 46, null, 43, null],
    support: [31, 31, 38, 31, 34, 34, 36, null, 38, 38, 43, 38, 46, null, 43, null],
  },
  {
    repeats: 1,
    melody: [72, null, null, 75, null, null, 77, null, 74, null, null, 72, null, 70, null, null],
    bass: [36, null, null, null, 43, null, null, null, 34, null, null, null, 41, null, null, null],
    support: [24, null, null, null, 31, null, null, null, 29, null, null, null, 36, null, null, null],
  },
  {
    repeats: 2,
    melody: [72, 75, 79, null, 77, 75, 72, null, 74, 77, 81, null, 79, 77, 75, null],
    bass: [43, null, 46, null, 48, null, 46, null, 41, null, 45, null, 47, null, 48, null],
    support: [31, null, 38, 31, 34, null, 36, null, 29, null, 36, 29, 41, null, 43, null],
  },
];

const CANON_BASS_LINE = [
  48, null, 55, null,
  43, null, 50, null,
  45, null, 52, null,
  40, null, 47, null,
  41, null, 48, null,
  48, null, 55, null,
  41, null, 48, null,
  43, null, 50, null,
];

const CANON_ARPEGGIO = [
  60, 64, 67, 72,
  59, 62, 67, 71,
  57, 60, 64, 69,
  55, 59, 64, 67,
  53, 57, 60, 65,
  52, 55, 60, 64,
  53, 57, 60, 65,
  55, 59, 62, 67,
];

// タイトルは C-C-G-G を土台にした、短く覚えやすいオリジナル進行です。
const TITLE_MELODY = [
  72, null, 76, 79, 84, null, 79, 76,
  72, 76, 79, null, 81, 79, 76, null,
  74, null, 77, 79, 83, null, 79, 77,
  74, 77, 79, null, 86, 83, 79, null,
];

const TITLE_BASS_LINE = [
  48, null, null, null, 55, null, null, null,
  48, null, null, null, 55, null, null, null,
  43, null, null, null, 50, null, null, null,
  43, null, null, null, 50, null, null, null,
];

const TITLE_ARPEGGIO = [
  60, 64, 67, 72, 60, 67, 64, 72,
  60, 64, 67, 72, 64, 67, 72, 76,
  55, 59, 62, 67, 55, 62, 59, 67,
  55, 59, 62, 67, 59, 62, 67, 71,
];

// ホームは Bb-F-Gm-Dm を基準に、落ち着いた冒険の支度感へ寄せています。
const HOME_MELODY = [
  70, null, 74, 75, 77, 75, 74, null,
  72, null, 76, 77, 79, 77, 76, null,
  74, 77, 79, 82, 79, 77, 74, null,
  72, 76, 77, 81, 77, 76, 72, null,
];

const HOME_BASS_LINE = [
  46, null, null, null, 53, null, null, null,
  41, null, null, null, 48, null, null, null,
  43, null, null, null, 50, null, null, null,
  38, null, null, null, 45, null, null, null,
];

const HOME_ARPEGGIO = [
  58, 62, 65, 70, 58, 65, 62, 70,
  53, 57, 60, 65, 53, 60, 57, 65,
  55, 58, 62, 67, 55, 62, 58, 67,
  50, 53, 57, 62, 50, 57, 53, 62,
];

export const BASE_BGM_TRACK_OPTIONS: BgmTrackOption[] = [
  { id: 'title', label: 'タイトル' },
  { id: 'home', label: 'ホーム' },
  { id: 'capture', label: 'つかまえる' },
  { id: 'battle', label: 'バトル' },
  { id: 'boss', label: 'ボス' },
  { id: 'bossStrong', label: 'ボスつよめ' },
  { id: 'dex', label: 'ずかん' },
  { id: 'shop', label: 'ショップ' },
];

const BOSS_LOOP_START = 8;

// ボス通常曲は最初の4音だけ落ち着いた入りにして、その後は Gm-Eb-F-D を長めにループします。
const BOSS_MELODY = [
  67, null, 70, null, 74, null, 72, null,
  74, null, 77, 74, 70, null, 74, null,
  75, null, 79, 75, 70, null, 75, null,
  77, 81, 77, 74, 72, null, 77, null,
  74, 78, 81, null, 78, 74, 69, null,
  74, null, 82, 81, 77, null, 74, null,
  75, 79, 82, null, 79, 75, 70, null,
  77, null, 84, 81, 77, null, 72, null,
  74, 78, 81, 86, 84, 81, 78, 74,
];

const BOSS_BASS_LINE = [
  43, null, null, null, 38, null, null, null,
  43, null, null, null, 43, null, null, null,
  39, null, null, null, 39, null, null, null,
  41, null, null, null, 41, null, null, null,
  38, null, null, null, 38, null, null, null,
  43, null, null, null, 43, null, null, null,
  39, null, null, null, 39, null, null, null,
  41, null, null, null, 41, null, null, null,
  38, null, null, null, 38, null, null, null,
];

const BOSS_ARPEGGIO = [
  55, null, 58, null, 62, null, 58, null,
  55, 58, 62, 67, 55, 62, 58, 67,
  51, 55, 58, 63, 51, 58, 55, 63,
  53, 57, 60, 65, 53, 60, 57, 65,
  50, 54, 57, 62, 50, 57, 54, 62,
  55, 62, 67, 70, 67, 62, 58, 55,
  51, 58, 63, 67, 63, 58, 55, 51,
  53, 60, 65, 69, 65, 60, 57, 53,
  50, 57, 62, 66, 62, 57, 54, 50,
];

// 強ボス曲は Gm-Eb-C-D。CからDへ押し上げる終止で、より危険な圧を出します。
const BOSS_STRONG_MELODY = [
  74, 74, 82, 81, 78, null, 74, null,
  75, 75, 82, 80, 78, null, 75, null,
  72, 72, 79, 76, 72, 76, 79, null,
  74, 78, 81, 86, 84, 81, 78, null,
  86, null, 82, 78, 74, 78, 82, null,
  87, null, 82, 80, 75, 80, 82, null,
  84, 79, 76, 72, 79, 76, 72, null,
  81, 78, 74, 69, 74, 78, 81, null,
];

const BOSS_STRONG_BASS_LINE = [
  31, null, 43, 31, 38, null, 43, null,
  27, null, 39, 27, 34, null, 39, null,
  24, null, 36, 24, 31, null, 36, null,
  26, null, 38, 26, 33, null, 38, null,
  31, 31, 43, 31, 38, 43, 31, null,
  27, 27, 39, 27, 34, 39, 27, null,
  24, 24, 36, 24, 31, 36, 24, null,
  26, 26, 38, 26, 33, 38, 26, null,
];

const BOSS_STRONG_ARPEGGIO = [
  55, 58, 62, 67, 70, 67, 62, 58,
  51, 55, 58, 63, 67, 63, 58, 55,
  48, 52, 55, 60, 64, 60, 55, 52,
  50, 54, 57, 62, 66, 62, 57, 54,
  67, 70, 74, 79, 82, 79, 74, 70,
  63, 67, 70, 75, 79, 75, 70, 67,
  60, 64, 67, 72, 76, 72, 67, 64,
  62, 66, 69, 74, 78, 74, 69, 66,
];

// 捕獲BGMはカノン進行（I-V-vi-iii-IV-I-IV-V）を1周32ステップで回します。
const CAPTURE_SECTIONS: BgmSection[] = [
  {
    repeats: 1,
    melody: [
      72, null, 76, null,
      71, null, 74, null,
      69, null, 72, null,
      67, null, 71, null,
      65, null, 69, null,
      64, null, 67, null,
      65, null, 69, null,
      67, null, 71, null,
    ],
    bass: CANON_BASS_LINE,
    support: CANON_ARPEGGIO,
  },
  {
    repeats: 2,
    melody: [
      76, 79, 76, 72,
      74, 79, 74, 71,
      72, 76, 72, 69,
      71, 76, 71, 67,
      69, 72, 69, 65,
      67, 72, 67, 64,
      69, 72, 74, 72,
      71, 74, 76, null,
    ],
    bass: CANON_BASS_LINE,
    support: CANON_ARPEGGIO,
  },
  {
    repeats: 2,
    melody: [
      79, 76, 72, 76,
      79, 74, 71, 74,
      76, 72, 69, 72,
      76, 71, 67, 71,
      72, 69, 65, 69,
      72, 67, 64, 67,
      74, 72, 69, 65,
      74, 71, 67, null,
    ],
    bass: CANON_BASS_LINE,
    support: CANON_ARPEGGIO,
  },
  {
    repeats: 2,
    melody: [
      84, null, 83, 79,
      81, null, 79, 74,
      81, null, 79, 76,
      79, null, 76, 71,
      77, null, 76, 72,
      76, null, 72, 67,
      77, 76, 74, 72,
      76, 74, 71, null,
    ],
    bass: CANON_BASS_LINE,
    support: CANON_ARPEGGIO,
  },
  {
    repeats: 1,
    melody: [
      72, null, null, 79,
      71, null, null, 79,
      69, null, null, 76,
      67, null, null, 76,
      65, null, null, 72,
      64, null, null, 72,
      65, null, 69, null,
      67, null, 71, null,
    ],
    bass: CANON_BASS_LINE,
    support: [
      60, null, 67, null,
      59, null, 67, null,
      57, null, 64, null,
      55, null, 64, null,
      53, null, 60, null,
      52, null, 60, null,
      53, null, 60, null,
      55, null, 62, null,
    ],
  },
  {
    repeats: 2,
    melody: [
      79, 81, 84, null,
      83, 81, 79, null,
      81, 79, 76, null,
      79, 76, 74, null,
      76, 74, 72, null,
      76, 72, 67, null,
      74, 76, 79, 76,
      74, 71, 67, null,
    ],
    bass: CANON_BASS_LINE,
    support: CANON_ARPEGGIO,
  },
];

const BASE_TRACKS: Record<BaseBgmTrack, BgmPattern> = {
  title: {
    bpm: 112,
    wave: 'triangle',
    volume: 0.05,
    melody: TITLE_MELODY,
    bass: TITLE_BASS_LINE,
    support: {
      wave: 'sine',
      volume: 0.16,
      gate: 0.82,
      notes: TITLE_ARPEGGIO,
    },
  },
  home: {
    bpm: 94,
    wave: 'triangle',
    volume: 0.052,
    melody: HOME_MELODY,
    bass: HOME_BASS_LINE,
    support: {
      wave: 'sine',
      volume: 0.16,
      gate: 0.92,
      notes: HOME_ARPEGGIO,
    },
  },
  capture: {
    bpm: 116,
    wave: 'triangle',
    volume: 0.048,
    melody: expandSections(CAPTURE_SECTIONS, 'melody'),
    bass: expandSections(CAPTURE_SECTIONS, 'bass'),
    support: {
      wave: 'sine',
      volume: 0.2,
      gate: 0.72,
      notes: expandSections(CAPTURE_SECTIONS, 'support'),
    },
  },
  battle: {
    bpm: 136,
    wave: 'sawtooth',
    volume: 0.042,
    melody: expandSections(BATTLE_SECTIONS, 'melody'),
    bass: expandSections(BATTLE_SECTIONS, 'bass'),
    support: {
      wave: 'square',
      volume: 0.18,
      gate: 0.55,
      notes: expandSections(BATTLE_SECTIONS, 'support'),
    },
  },
  boss: {
    bpm: 138,
    wave: 'sawtooth',
    volume: 0.044,
    melody: BOSS_MELODY,
    bass: BOSS_BASS_LINE,
    loopStart: BOSS_LOOP_START,
    support: {
      wave: 'square',
      volume: 0.17,
      gate: 0.58,
      notes: BOSS_ARPEGGIO,
    },
  },
  bossStrong: {
    bpm: 150,
    wave: 'sawtooth',
    volume: 0.046,
    melody: BOSS_STRONG_MELODY,
    bass: BOSS_STRONG_BASS_LINE,
    support: {
      wave: 'square',
      volume: 0.19,
      gate: 0.48,
      notes: BOSS_STRONG_ARPEGGIO,
    },
  },
  dex: {
    bpm: 84,
    wave: 'sine',
    volume: 0.05,
    melody: [67, null, 72, null, 74, null, 76, null, 74, null, 72, null, 69, null, 67, null],
    bass: [48, null, null, null, 52, null, null, null, 55, null, null, null, 52, null, null, null],
    support: {
      wave: 'sine',
      volume: 0.14,
      gate: 1.3,
      notes: [36, null, null, null, 40, null, null, null, 43, null, null, null, 40, null, null, null],
    },
  },
  shop: {
    bpm: 104,
    wave: 'triangle',
    volume: 0.052,
    melody: [72, null, 74, 76, null, 79, null, 76, 74, null, 72, null, 71, 72, null, null],
    bass: [48, null, 55, null, 57, null, 55, null, 52, null, 59, null, 55, null, 60, null],
    support: {
      wave: 'triangle',
      volume: 0.2,
      gate: 0.75,
      notes: [36, null, 43, null, 45, 43, null, 43, 40, null, 47, null, 43, 47, null, 48],
    },
  },
};

const STAGE_CAPTURE_VARIANTS: Record<string, {
  bpm: number;
  transpose: number;
  supportTranspose: number;
  wave: OscillatorType;
  supportWave: OscillatorType;
  volume: number;
}> = {
  'g1-tashizan-hazimarinosougen': { bpm: 116, transpose: 0, supportTranspose: 0, wave: 'triangle', supportWave: 'sine', volume: 0.048 },
  'g1-tashizan-koorinodoukutsu': { bpm: 104, transpose: -2, supportTranspose: -2, wave: 'sine', supportWave: 'sine', volume: 0.046 },
  'g1-tashizan-honoonoyama': { bpm: 128, transpose: 3, supportTranspose: 3, wave: 'sawtooth', supportWave: 'sawtooth', volume: 0.04 },
  'g1-tashizan-junotomodachi': { bpm: 118, transpose: 2, supportTranspose: 2, wave: 'triangle', supportWave: 'triangle', volume: 0.047 },
  'g1-tashizan-jutojuichinowakaremichi': { bpm: 120, transpose: 4, supportTranspose: 4, wave: 'triangle', supportWave: 'sine', volume: 0.046 },
  'g1-tashizan-kaminarinotakadai': { bpm: 136, transpose: 7, supportTranspose: 7, wave: 'square', supportWave: 'square', volume: 0.04 },
  'g1-tashizan-mizubenoniwa': { bpm: 108, transpose: -5, supportTranspose: -5, wave: 'sine', supportWave: 'triangle', volume: 0.047 },
  'g1-tashizan-yorunoiseki': { bpm: 92, transpose: -7, supportTranspose: -7, wave: 'sine', supportWave: 'sine', volume: 0.044 },
  'g1-junoyama-tenberunotou': { bpm: 122, transpose: 0, supportTranspose: 0, wave: 'triangle', supportWave: 'triangle', volume: 0.047 },
  'g1-junoyama-shikakunoitadaki': { bpm: 110, transpose: 5, supportTranspose: 5, wave: 'sine', supportWave: 'triangle', volume: 0.046 },
  'g1-hikizan-hikuichinokomichi': { bpm: 108, transpose: -1, supportTranspose: -1, wave: 'triangle', supportWave: 'sine', volume: 0.046 },
  'g1-hikizan-hikuninokomichi': { bpm: 110, transpose: -2, supportTranspose: -2, wave: 'triangle', supportWave: 'triangle', volume: 0.046 },
  'g1-hikizan-nokorinokomichi': { bpm: 106, transpose: -3, supportTranspose: -3, wave: 'triangle', supportWave: 'triangle', volume: 0.046 },
  'g1-hikizan-tennoichiba': { bpm: 112, transpose: -5, supportTranspose: -5, wave: 'sine', supportWave: 'triangle', volume: 0.046 },
  'g1-hikizan-nijubashi': { bpm: 114, transpose: -4, supportTranspose: -4, wave: 'sine', supportWave: 'triangle', volume: 0.046 },
  'g1-hikizan-juikutsunohashi': { bpm: 116, transpose: -2, supportTranspose: -2, wave: 'triangle', supportWave: 'sine', volume: 0.046 },
  'g2-hikizan-kurainohikimichi': { bpm: 118, transpose: 1, supportTranspose: 1, wave: 'triangle', supportWave: 'triangle', volume: 0.045 },
  'g2-hikizan-nokoriishinotani': { bpm: 100, transpose: -4, supportTranspose: -4, wave: 'triangle', supportWave: 'sine', volume: 0.045 },
  'g2-hikizan-ochibanogake': { bpm: 112, transpose: 3, supportTranspose: 3, wave: 'sawtooth', supportWave: 'triangle', volume: 0.043 },
  'g2-hikizan-kurisagarinosenaka': { bpm: 116, transpose: 5, supportTranspose: 5, wave: 'sawtooth', supportWave: 'sine', volume: 0.043 },
  'g2-kakezan-ichinodan': { bpm: 118, transpose: 0, supportTranspose: 0, wave: 'triangle', supportWave: 'square', volume: 0.046 },
  'g2-kakezan-ninodan': { bpm: 124, transpose: 2, supportTranspose: 2, wave: 'square', supportWave: 'square', volume: 0.043 },
  'g2-kakezan-sannodan': { bpm: 126, transpose: 3, supportTranspose: 3, wave: 'square', supportWave: 'triangle', volume: 0.043 },
  'g2-kakezan-yonnodan': { bpm: 128, transpose: 4, supportTranspose: 4, wave: 'triangle', supportWave: 'square', volume: 0.043 },
  'g2-kakezan-gonodan': { bpm: 130, transpose: 5, supportTranspose: 5, wave: 'square', supportWave: 'square', volume: 0.042 },
  'g2-kakezan-rokunodan': { bpm: 132, transpose: 6, supportTranspose: 6, wave: 'triangle', supportWave: 'square', volume: 0.042 },
  'g2-kakezan-nananodan': { bpm: 134, transpose: 7, supportTranspose: 7, wave: 'square', supportWave: 'triangle', volume: 0.042 },
  'g2-kakezan-hachinodan': { bpm: 136, transpose: 8, supportTranspose: 8, wave: 'square', supportWave: 'square', volume: 0.041 },
  'g2-kakezan-kyunodan': { bpm: 138, transpose: 9, supportTranspose: 9, wave: 'sawtooth', supportWave: 'square', volume: 0.04 },
};

const BGM_VOLUME_BOOST = 1.16;
const BGM_VOLUME_STORAGE_KEY = 'one-digit-capture-game-bgm-volume-v1';
const DEFAULT_BGM_VOLUME = 1;

let audioContext: AudioContext | null = null;
let activeTrack: BgmTrack | null = null;
let activePattern: BgmPattern | null = null;
let requestedTrack: BgmTrack | null = null;
let masterGain: GainNode | null = null;
let schedulerId: number | null = null;
let nextStepTime = 0;
let stepIndex = 0;
let unlockListenerAttached = false;
let visibilityListenerAttached = false;
let wasPlayingBeforeHidden = false;
let bgmVolume = loadStoredBgmVolume();
const stageCapturePatternByTrack = new Map<`capture:${StageId}`, BgmPattern>();

/** Clamps the BGM volume setting into the supported range. */
function normalizeBgmVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_BGM_VOLUME;
  }

  return Math.min(1, Math.max(0, value));
}

/** Loads the saved BGM volume setting. */
function loadStoredBgmVolume(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_BGM_VOLUME;
  }

  try {
    const storedValue = window.localStorage.getItem(BGM_VOLUME_STORAGE_KEY);
    return storedValue === null ? DEFAULT_BGM_VOLUME : normalizeBgmVolume(Number(storedValue));
  } catch {
    return DEFAULT_BGM_VOLUME;
  }
}

/** Saves the BGM volume setting. */
function saveStoredBgmVolume(value: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(BGM_VOLUME_STORAGE_KEY, String(value));
  } catch {
    // Keep the new value for this page when localStorage is blocked.
  }
}

/** Returns the current BGM volume setting. */
export function getBgmVolume(): number {
  return bgmVolume;
}

/** Changes the BGM volume and applies it to the active track. */
export function setBgmVolume(value: number): number {
  bgmVolume = normalizeBgmVolume(value);
  saveStoredBgmVolume(bgmVolume);
  updateActiveBgmVolume();
  return bgmVolume;
}

/** Converts the track pattern volume into the master gain value. */
function getTargetBgmGain(pattern: BgmPattern): number {
  return pattern.volume * BGM_VOLUME_BOOST * bgmVolume;
}

/** Moves the active BGM gain to the current volume setting. */
function updateActiveBgmVolume(): void {
  if (!audioContext || !masterGain || !activePattern) {
    return;
  }

  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
  masterGain.gain.linearRampToValueAtTime(getTargetBgmGain(activePattern), audioContext.currentTime + 0.12);
}

/** BGMと効果音で共有するAudioContextを、使える環境なら作成して返します。 */
export function getSharedAudioContext(): AudioContext | null {
  const audioWindow = window as AudioWindow;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  audioContext ??= new AudioContextClass();
  return audioContext;
}

/** MIDIノート番号を、Oscillatorで鳴らす周波数へ変換します。 */
function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** 繰り返し指定つきのBGMセクションを、1ステップずつの音符配列へ展開します。 */
function expandSections(
  sections: BgmSection[],
  lane: 'melody' | 'bass' | 'support',
): Array<number | null> {
  const notes: Array<number | null> = [];
  sections.forEach((section) => {
    for (let count = 0; count < section.repeats; count += 1) {
      notes.push(...section[lane]);
    }
  });

  return notes;
}

/** 音符配列を指定半音数だけ移調し、休符はそのまま残します。 */
function transposeNotes(notes: Array<number | null>, amount: number): Array<number | null> {
  return notes.map((note) => (note === null ? null : note + amount));
}

/** トラック名がステージ別の捕獲BGMかどうかを判定します。 */
function isStageCaptureTrack(track: BgmTrack): track is `capture:${StageId}` {
  return track.startsWith('capture:');
}

/** トラック名からBGMパターンを取得し、ステージ別捕獲BGMは移調して作ります。 */
function getBgmPattern(track: BgmTrack): BgmPattern {
  if (!isStageCaptureTrack(track)) {
    return BASE_TRACKS[track];
  }

  const cachedPattern = stageCapturePatternByTrack.get(track);
  if (cachedPattern) {
    return cachedPattern;
  }

  const stageId = normalizeStageId(track.slice('capture:'.length)) as StageId;
  const variant = STAGE_CAPTURE_VARIANTS[stageId] ?? STAGE_CAPTURE_VARIANTS['g1-tashizan-hazimarinosougen'];
  const base = BASE_TRACKS.capture;
  const pattern = {
    bpm: variant.bpm,
    wave: variant.wave,
    volume: variant.volume,
    melody: transposeNotes(base.melody, variant.transpose),
    bass: transposeNotes(base.bass, variant.transpose),
    support: {
      ...base.support,
      wave: variant.supportWave,
      notes: transposeNotes(base.support.notes, variant.supportTranspose),
    },
  };
  stageCapturePatternByTrack.set(track, pattern);

  return pattern;
}

/** ブラウザの自動再生制限が解ける操作を待ち、BGM再開を試みます。 */
function attachUnlockListener(): void {
  if (unlockListenerAttached) {
    return;
  }

  unlockListenerAttached = true;
  const unlock = (): void => {
    const context = getSharedAudioContext();
    if (!context) {
      return;
    }

    void context.resume().then(() => {
      if (requestedTrack) {
        startBgm(requestedTrack);
      }
    }).catch(() => {
      // ブラウザが音を許可するまで、次の操作で再挑戦します。
    });
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

/** タブが非表示の間はBGMを止め、戻ったら必要に応じて再開します。 */
function attachVisibilityListener(): void {
  if (visibilityListenerAttached) {
    return;
  }

  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wasPlayingBeforeHidden = schedulerId !== null;
      stopActiveBgm();
      void audioContext?.suspend().catch(() => undefined);
      return;
    }

    if (!wasPlayingBeforeHidden || !requestedTrack) {
      wasPlayingBeforeHidden = false;
      return;
    }

    wasPlayingBeforeHidden = false;
    const trackToResume = requestedTrack;
    const context = getSharedAudioContext();
    if (!context) {
      return;
    }

    void context.resume()
      .then(() => startBgm(trackToResume))
      .catch(() => undefined);
  });
}

/** シーンごとのBGMを切り替えます。ブラウザ制限中は、最初のタップ後に鳴り始めます。 */
export function startBgm(track: BgmTrack): void {
  requestedTrack = track;
  const context = getSharedAudioContext();
  if (!context) {
    return;
  }

  attachUnlockListener();
  attachVisibilityListener();
  if (context.state === 'suspended') {
    void context.resume().catch(() => {
      // ユーザー操作前の自動再生ブロックは自然なので、操作後に再試行します。
    });
    return;
  }

  if (activeTrack === track && schedulerId !== null) {
    return;
  }

  stopActiveBgm();
  const pattern = getBgmPattern(track);
  activeTrack = track;
  activePattern = pattern;
  masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.001, context.currentTime);
  masterGain.gain.linearRampToValueAtTime(getTargetBgmGain(pattern), context.currentTime + 0.4);
  masterGain.connect(context.destination);
  nextStepTime = context.currentTime + 0.05;
  stepIndex = 0;
  schedulerId = window.setInterval(scheduleBgmSteps, 90);
  scheduleBgmSteps();
}

/** ステージの雰囲気に合わせた捕獲BGMへ切り替えます。 */
export function startStageBgm(stageId: StageId): void {
  startBgm(`capture:${normalizeStageId(stageId)}`);
}

/** 今流れているBGMだけを止め、再開待ちの曲IDはそのまま残します。 */
function stopActiveBgm(): void {
  if (schedulerId !== null) {
    window.clearInterval(schedulerId);
    schedulerId = null;
  }

  const fadingGain = masterGain;
  if (fadingGain && audioContext) {
    const fadeEnd = audioContext.currentTime + 0.16;
    fadingGain.gain.cancelScheduledValues(audioContext.currentTime);
    fadingGain.gain.setValueAtTime(fadingGain.gain.value, audioContext.currentTime);
    fadingGain.gain.linearRampToValueAtTime(0.001, fadeEnd);
    window.setTimeout(() => fadingGain.disconnect(), 220);
  }

  masterGain = null;
  activeTrack = null;
  activePattern = null;
}

/** 試聴や設定画面で使うため、再開待ちも含めてBGMを完全に止めます。 */
export function stopBgm(): void {
  requestedTrack = null;
  stopActiveBgm();
}

/** 少し先のBGMステップをまとめて予約し、音切れを防ぎます。 */
function scheduleBgmSteps(): void {
  const context = audioContext;
  const gain = masterGain;
  const pattern = activePattern;
  if (!context || !gain || !pattern) {
    return;
  }

  const stepDuration = 60 / pattern.bpm / 2;
  while (nextStepTime < context.currentTime + 0.7) {
    scheduleStep(context, gain, pattern, stepIndex, nextStepTime, stepDuration);
    const nextStepIndex = stepIndex + 1;
    stepIndex = nextStepIndex >= pattern.melody.length ? (pattern.loopStart ?? 0) : nextStepIndex;
    nextStepTime += stepDuration;
  }
}

/** 1ステップぶんの低音・支え音・メロディを必要に応じて予約します。 */
function scheduleStep(
  context: AudioContext,
  destination: AudioNode,
  pattern: BgmPattern,
  index: number,
  startTime: number,
  duration: number,
): void {
  const melodyNote = pattern.melody[index];
  const bassNote = pattern.bass[index];
  const supportNote = pattern.support.notes[index % pattern.support.notes.length];

  if (bassNote !== null) {
    scheduleNote(context, destination, midiToFrequency(bassNote), startTime, duration * 0.82, 'triangle', 0.34);
  }

  if (supportNote !== null) {
    scheduleNote(
      context,
      destination,
      midiToFrequency(supportNote),
      startTime,
      duration * pattern.support.gate,
      pattern.support.wave,
      pattern.support.volume,
    );
  }

  if (melodyNote !== null) {
    scheduleNote(context, destination, midiToFrequency(melodyNote), startTime, duration * 0.74, pattern.wave, 0.62);
  }

  const accentStart = pattern.loopStart ?? 0;
  if (index >= accentStart && (index - accentStart) % 4 === 0) {
    scheduleNote(context, destination, 880, startTime, 0.035, 'sine', 0.14);
  }
}

/** OscillatorとGainを作り、指定時刻に単音を鳴らして自然に減衰させます。 */
function scheduleNote(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  startTime: number,
  duration: number,
  wave: OscillatorType,
  volume: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}
