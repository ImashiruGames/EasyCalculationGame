const TARGET_CAPTURE_CORRECT_ANSWERS = 5;
const BASE_GOAL_GAUGE = 100;

/** 基準ゲージ量100ならだいたい5問正解で捕獲に届く、1問あたりの基本ゲージ量を返します。 */
function getBaseCaptureGaugeGain(): number {
  return BASE_GOAL_GAUGE / TARGET_CAPTURE_CORRECT_ANSWERS;
}

/** ステージ指定のゲージ増加量が使える値なら使い、未指定なら標準値に戻します。 */
function getSafeCaptureGaugeGain(stageGaugeGain: number | undefined): number {
  return stageGaugeGain !== undefined && Number.isFinite(stageGaugeGain) && stageGaugeGain > 0
    ? stageGaugeGain
    : getBaseCaptureGaugeGain();
}

/** 基本ゲージ量に、速度ボーナスやアイテム効果の倍率を掛けて実際の増加量を返します。 */
export function getCaptureGaugeGain(
  stageGaugeGain: number | undefined,
  speedMultiplier: number,
  itemMultiplier: number,
): number {
  const safeSpeedMultiplier = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
  const safeItemMultiplier = Number.isFinite(itemMultiplier) && itemMultiplier > 0 ? itemMultiplier : 1;

  return getSafeCaptureGaugeGain(stageGaugeGain) * safeSpeedMultiplier * safeItemMultiplier;
}
