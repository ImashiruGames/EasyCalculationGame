interface AnswerSpeedBonus {
  multiplier: number;
  label: string | null;
}

const SPEED_BONUS_TIERS = [
  { thresholdMs: 1000, multiplier: 2, label: '2ばい' },
  { thresholdMs: 3000, multiplier: 1.5, label: '1.5ばい' },
];

/** 問題を解くまでの時間から、ゲージやわざの強さへかけるスピード倍率を返します。 */
export function getAnswerSpeedBonus(elapsedMs: number): AnswerSpeedBonus {
  const safeElapsedMs = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : Number.POSITIVE_INFINITY;
  const tier = SPEED_BONUS_TIERS.find((candidate) => safeElapsedMs < candidate.thresholdMs);
  if (!tier) {
    return {
      multiplier: 1,
      label: null,
    };
  }

  return {
    multiplier: tier.multiplier,
    label: tier.label,
  };
}
