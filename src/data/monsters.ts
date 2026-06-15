import { EncounterStreakState, MonsterDefinition, StageId, StageMonsterDefinition } from '../game/types';
import debugMonstersCsv from './csv/debug_monsters.csv?raw';
import monstersCsv from './csv/monsters.csv?raw';
import { appendDebugCsvRows } from './debugMode';
import { loadMonsterCsvData } from './monsterCsvLoader';
import { stages } from './stages';

export const monsters: MonsterDefinition[] = loadMonsterCsvData(appendDebugCsvRows(monstersCsv, debugMonstersCsv));

const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
const monsterDexIndexById = new Map(monsters.map((monster, index) => [monster.id, index]));
const primaryStageIdByMonsterId = new Map<string, StageId>();
const NORMAL_ENCOUNTER_WEIGHT = 12;
const RARE_ENCOUNTER_WEIGHT = 0.2;
const REPEAT_ENCOUNTER_WEIGHT_MULTIPLIER = 0.5;

/** モンスターIDから定義を取得し、データ不整合があれば早めに検知します。 */
export function getMonsterById(monsterId: string): MonsterDefinition {
  const monster = monsterById.get(monsterId);
  if (!monster) {
    throw new Error(`Unknown monster id: ${monsterId}`);
  }

  return monster;
}

/** 文字列IDと重みつき定義のどちらからでも、モンスターIDだけを取り出します。 */
export function getStageMonsterId(monsterEntry: StageMonsterDefinition): string {
  return typeof monsterEntry === 'string' ? monsterEntry : monsterEntry.monsterId;
}

stages.forEach((stage) => {
  stage.monsterIds.forEach((monsterEntry) => {
    const monsterId = getStageMonsterId(monsterEntry);
    if (!primaryStageIdByMonsterId.has(monsterId)) {
      primaryStageIdByMonsterId.set(monsterId, stage.id);
    }
  });
});

/** ステージ出現候補から、定義形式の違いを吸収してモンスターIDだけを取り出します。 */
export function getStageMonsterIds(monsterEntries: StageMonsterDefinition[]): string[] {
  return monsterEntries.map((monsterEntry) => getStageMonsterId(monsterEntry));
}

/** IDまたは重みつき出現候補の配列を、画面表示で使うモンスター定義へ変換します。 */
export function getMonstersByIds(monsterIds: StageMonsterDefinition[]): MonsterDefinition[] {
  return monsterIds.map((monsterId) => getMonsterById(getStageMonsterId(monsterId)));
}

/** 図鑑順に並べるため、モンスターIDから登録順の番号を返します。 */
export function getMonsterDexIndex(monsterId: string): number {
  return monsterDexIndexById.get(monsterId) ?? Number.MAX_SAFE_INTEGER;
}

/** モンスターIDから、stage_monsters.csvで最初に出てくるステージIDを返します。 */
export function getPrimaryStageIdForMonsterId(monsterId: string): StageId | null {
  return primaryStageIdByMonsterId.get(monsterId) ?? null;
}

/** レアかどうかに応じて、明示指定がないときの出現重みを決めます。 */
function getDefaultEncounterWeight(monster: MonsterDefinition): number {
  return monster.isRare ? RARE_ENCOUNTER_WEIGHT : NORMAL_ENCOUNTER_WEIGHT;
}

/** 出現候補ごとの重みを読み、未指定ならモンスター種別の既定値を使います。 */
export function getEncounterWeight(monsterEntry: StageMonsterDefinition): number {
  const monster = getMonsterById(getStageMonsterId(monsterEntry));
  if (typeof monsterEntry !== 'string') {
    return monsterEntry.weight;
  }

  return getDefaultEncounterWeight(monster);
}

/** 同じモンスターが続いたときだけ出現重みを下げ、連続出現を少し避けます。 */
export function getAdjustedEncounterWeight(
  monsterEntry: StageMonsterDefinition,
  encounterStreak?: EncounterStreakState | null,
): number {
  const monsterId = getStageMonsterId(monsterEntry);
  const baseWeight = Math.max(0, getEncounterWeight(monsterEntry));
  if (
    !encounterStreak
    || encounterStreak.monsterId !== monsterId
    || !Number.isFinite(encounterStreak.count)
    || encounterStreak.count <= 0
  ) {
    return baseWeight;
  }

  return baseWeight * Math.pow(REPEAT_ENCOUNTER_WEIGHT_MULTIPLIER, Math.floor(encounterStreak.count));
}

/** ステージ内の候補全体から見た、対象モンスターのおおよその出現率を返します。 */
export function getStageMonsterEncounterRate(
  monsterEntries: StageMonsterDefinition[],
  targetMonsterId: string,
): number {
  let totalWeight = 0;
  let targetWeight = 0;

  monsterEntries.forEach((monsterEntry) => {
    const monsterId = getStageMonsterId(monsterEntry);
    const weight = Math.max(0, getEncounterWeight(monsterEntry));
    totalWeight += weight;
    if (monsterId === targetMonsterId) {
      targetWeight += weight;
    }
  });

  if (totalWeight <= 0) {
    return 0;
  }

  return targetWeight / totalWeight;
}

/** レア種の出現率を抑えつつ、ステージ内の捕獲対象を1体選びます。 */
export function pickEncounterMonsterId(
  monsterIds: StageMonsterDefinition[],
  encounterStreak?: EncounterStreakState | null,
): string {
  let totalWeight = 0;
  const candidates = monsterIds.map((monsterEntry) => {
    const monsterId = getStageMonsterId(monsterEntry);
    const weight = getAdjustedEncounterWeight(monsterEntry, encounterStreak);
    totalWeight += weight;

    return { monsterId, weight };
  });

  if (totalWeight <= 0) {
    return getStageMonsterId(monsterIds[0]);
  }

  let roll = Math.random() * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll < 0) {
      return candidate.monsterId;
    }
  }

  return candidates[candidates.length - 1]?.monsterId ?? getStageMonsterId(monsterIds[0]);
}

/** 進化回数の違いを子どもにも読める短いラベルにします。 */
export function getEvolutionLabel(monster: MonsterDefinition): string {
  const remainingEvolutions = monster.maxEvolutionStage - monster.evolutionStage;
  if (remainingEvolutions === 3) {
    return 'あと3かいしんか';
  }

  if (remainingEvolutions === 2) {
    return 'あと2かいしんか';
  }

  if (remainingEvolutions === 1) {
    return 'あと1かいしんか';
  }

  return 'しんかなし';
}
