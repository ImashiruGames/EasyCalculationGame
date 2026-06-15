import { MonsterDefinition, TrainerDefinition } from '../types';

export interface BattleAffinity {
  multiplier: number;
  label: 'とくい' | 'にがて' | null;
}

interface BattleDamageResult {
  amount: number;
  affinity: BattleAffinity;
}

const STRONG_AGAINST: Record<string, string[]> = {
  'くさ': ['みず', 'いし'],
  'こおり': ['くさ', 'もり'],
  'ほのお': ['くさ', 'こおり', 'もり'],
  'かみなり': ['みず'],
  'みず': ['ほのお', 'いし'],
  'よる': ['10'],
  '10': ['よる'],
  'もり': ['みず', 'いし'],
  'いし': ['ほのお', 'かみなり'],
  'ひき算': ['10', 'いし'],
};

/** 速度や基礎倍率が不正な値でも、ダメージ計算を等倍に戻して壊れないようにします。 */
function normalizeDamageMultiplier(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** トレーナーの相棒は、相手ごとの難しさも少し反映したHPにします。 */
export function getOpponentMaxHp(trainer: TrainerDefinition, monster: MonsterDefinition): number {
  return Math.max(monster.hp, trainer.hp);
}

/** 属性の相性を、子ども向けに「とくい」「にがて」だけの軽い差へまとめます。 */
function getBattleAffinity(attacker: MonsterDefinition, defender: MonsterDefinition): BattleAffinity {
  if (STRONG_AGAINST[attacker.attribute]?.includes(defender.attribute)) {
    return {
      multiplier: 1.25,
      label: 'とくい',
    };
  }

  if (STRONG_AGAINST[defender.attribute]?.includes(attacker.attribute)) {
    return {
      multiplier: 0.8,
      label: 'にがて',
    };
  }

  return {
    multiplier: 1,
    label: null,
  };
}

/** 攻撃力、解答スピード、属性相性から、今回のわざの強さを決めます。 */
export function calculateBattleDamage(
  attacker: MonsterDefinition,
  defender: MonsterDefinition,
  speedMultiplier = 1,
  baseScale = 1,
): BattleDamageResult {
  const affinity = getBattleAffinity(attacker, defender);
  const speedScale = normalizeDamageMultiplier(speedMultiplier);
  const baseDamageScale = normalizeDamageMultiplier(baseScale);
  const amount = Math.max(1, Math.round(attacker.attack * speedScale * baseDamageScale * affinity.multiplier));

  return {
    amount,
    affinity,
  };
}
