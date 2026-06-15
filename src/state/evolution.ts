import { MonsterDefinition } from '../game/types';

export interface EvolutionProgress {
  canEvolve: boolean;
  filledSlots: number;
  remainingFragments: number | null;
  requiredFragments: number | null;
}

/** かけら数から、次の進化までの進み具合を計算します。進化しない種は残数なしで返します。 */
export function getEvolutionProgress(
  monster: MonsterDefinition,
  fragmentCount: number,
): EvolutionProgress {
  const requiredFragments = monster.evolutionRequiredFragments;
  if (requiredFragments === null || !Number.isFinite(requiredFragments) || requiredFragments <= 0) {
    return {
      canEvolve: false,
      filledSlots: 0,
      remainingFragments: null,
      requiredFragments: null,
    };
  }

  const normalizedRequiredFragments = Math.floor(requiredFragments);
  const normalizedFragmentCount = Number.isFinite(fragmentCount) && fragmentCount > 0 ? Math.floor(fragmentCount) : 0;
  const clampedCount = Math.min(normalizedFragmentCount, normalizedRequiredFragments);
  return {
    canEvolve: normalizedFragmentCount >= normalizedRequiredFragments,
    filledSlots: clampedCount,
    remainingFragments: Math.max(0, normalizedRequiredFragments - normalizedFragmentCount),
    requiredFragments: normalizedRequiredFragments,
  };
}
