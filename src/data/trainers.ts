import { ProblemRuleDefinition, TrainerDefinition } from '../game/types';
import trainersCsv from './csv/trainers.csv?raw';
import {
  optionalCsvValue,
  parseCsv,
  parseCsvList,
  parseCsvNumber,
  parseOptionalCsvNumber,
  requireCsvValue,
} from './csv';

/** CSVの問題ルールを、JSON形式なら構造化し、通常文字列ならそのままルールIDにします。 */
function parseProblemRule(value: string): ProblemRuleDefinition {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as ProblemRuleDefinition;
  }

  return trimmed as ProblemRuleDefinition;
}

export const trainers: TrainerDefinition[] = parseCsv(trainersCsv).map((row, index) => {
  const rowNumber = index + 2;
  const partnerMonsterIds = parseCsvList(row.partnerMonsterIds);

  return {
    id: requireCsvValue(row, 'id', rowNumber),
    name: requireCsvValue(row, 'name', rowNumber),
    title: requireCsvValue(row, 'title', rowNumber),
    stageId: requireCsvValue(row, 'stageId', rowNumber),
    difficultyLevel: parseCsvNumber(row, 'difficultyLevel', rowNumber),
    hp: parseCsvNumber(row, 'hp', rowNumber),
    problemRule: parseProblemRule(requireCsvValue(row, 'problemRule', rowNumber)),
    partnerMonsterId: requireCsvValue(row, 'partnerMonsterId', rowNumber),
    partnerMonsterIds: partnerMonsterIds.length > 0 ? partnerMonsterIds : undefined,
    rewardCoins: parseCsvNumber(row, 'rewardCoins', rowNumber),
    rewardCandyAttribute: optionalCsvValue(row.rewardCandyAttribute),
    rewardCandyAmount: parseOptionalCsvNumber(row, 'rewardCandyAmount', rowNumber),
    accentColor: requireCsvValue(row, 'accentColor', rowNumber),
    palette: {
      cap: requireCsvValue(row, 'paletteCap', rowNumber),
      shirt: requireCsvValue(row, 'paletteShirt', rowNumber),
      shadow: requireCsvValue(row, 'paletteShadow', rowNumber),
      background: requireCsvValue(row, 'paletteBackground', rowNumber),
    },
  };
});

const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));
const trainersByDifficulty = [...trainers].sort((a, b) => a.difficultyLevel - b.difficultyLevel);

/** 連勝バトルで使いやすいよう、難しさ順に並べたトレーナーを返します。 */
export function getTrainersByDifficulty(): TrainerDefinition[] {
  return [...trainersByDifficulty];
}

/** トレーナーが使える相棒モンスターIDを、単体設定と複数設定の両方から返します。 */
export function getTrainerPartnerMonsterIds(trainer: TrainerDefinition): string[] {
  return trainer.partnerMonsterIds?.length ? trainer.partnerMonsterIds : [trainer.partnerMonsterId];
}

/** トレーナーIDから定義を取得し、見つからない場合はデータ不備として止めます。 */
export function getTrainerById(trainerId: string): TrainerDefinition {
  const trainer = trainerById.get(trainerId);
  if (!trainer) {
    throw new Error(`Unknown trainer id: ${trainerId}`);
  }

  return trainer;
}
