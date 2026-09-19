import { getEmbeddedStoryDraftForMonsterDex } from '../../data/stories';
import { getTitleBackgroundById } from '../../data/titleBackgrounds';
import { TITLE_MONSTER_SLOT_COUNT } from '../../game/layoutConfig';
import { AppSaveState, MonsterDefinition, TitleMonsterPlacementState } from '../../game/types';
import {
  COINS_PER_CANDY,
  FRAGMENTS_PER_CANDY,
  getFragmentKey,
  getStoredPositiveCount,
  knownCandyAttributes,
  knownMonsterIds,
  knownShopItemIds,
  knownTitleBackgroundIds,
  monsterById,
  normalizePositiveInteger,
} from './constants';
import { EvolutionSaveResult } from './progressActions';
import { getFinalEvolutionMonsterId, getMonsterCaptureCount, isTitleBackgroundOwned } from './selectors';
import { loadSaveState, saveState } from './storage';
import { normalizeTitleBackgroundIds, normalizeTitleMonsterPlacements } from './title';

/** かけらを消費して進化先を図鑑登録します。進化では進化先のかけらは増やしません。 */
export function evolveMonster(
  sourceMonsterId: string,
  evolvedMonsterId: string,
  requiredFragments: number,
): EvolutionSaveResult | null {
  const sourceMonster = monsterById.get(sourceMonsterId);
  const evolvedMonster = monsterById.get(evolvedMonsterId);
  const requiredFragmentCount = normalizePositiveInteger(requiredFragments);
  if (!sourceMonster || !evolvedMonster || sourceMonster.nextEvolutionId !== evolvedMonsterId || requiredFragmentCount === null) {
    return null;
  }

  const current = loadSaveState();
  if ((current.captures[evolvedMonsterId] ?? 0) > 0) {
    return null;
  }

  const fragmentKey = getFragmentKey(sourceMonsterId);
  const currentFragments = current.fragments[fragmentKey] ?? 0;
  if (currentFragments < requiredFragmentCount) {
    return null;
  }

  const evolvedCaptureCount = (current.captures[evolvedMonsterId] ?? 0) + 1;
  const nextFragments = {
    ...current.fragments,
    [fragmentKey]: currentFragments - requiredFragmentCount,
  };
  if (nextFragments[fragmentKey] <= 0) {
    delete nextFragments[fragmentKey];
  }

  const next: AppSaveState = {
    ...current,
    fragments: nextFragments,
    captures: {
      ...current.captures,
      [evolvedMonsterId]: evolvedCaptureCount,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return {
    state: next,
    evolvedCaptureCount,
    wasNew: evolvedCaptureCount === 1,
  };
}

/** キャラクターのかけらを、その属性のアメへ交換するための保存処理です。 */
export function exchangeFragmentsForCandy(
  monsterId: string,
  attribute: string,
  fragmentCost = FRAGMENTS_PER_CANDY,
): AppSaveState | null {
  const current = loadSaveState();
  if (!canExchangeFragmentsForCandy(current, monsterId, attribute, fragmentCost)) {
    return null;
  }

  const normalizedFragmentCost = normalizePositiveInteger(fragmentCost);
  const fragmentKey = getFragmentKey(monsterId);
  const currentFragments = current.fragments[fragmentKey] ?? 0;

  const nextFragments = {
    ...current.fragments,
    [fragmentKey]: currentFragments - (normalizedFragmentCost ?? FRAGMENTS_PER_CANDY),
  };
  if (nextFragments[fragmentKey] <= 0) {
    delete nextFragments[fragmentKey];
  }

  const next: AppSaveState = {
    ...current,
    fragments: nextFragments,
    candies: {
      ...current.candies,
      [attribute]: (current.candies[attribute] ?? 0) + 1,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** かけらをアメに交換できるかを、進化完了と図鑑ストーリー解放状況まで含めて判定します。 */
export function canExchangeFragmentsForCandy(
  state: AppSaveState,
  monsterId: string,
  attribute: string,
  fragmentCost = FRAGMENTS_PER_CANDY,
): boolean {
  const monster = monsterById.get(monsterId);
  const normalizedFragmentCost = normalizePositiveInteger(fragmentCost);
  if (!monster
    || !knownCandyAttributes.has(attribute)
    || monster.attribute !== attribute
    || normalizedFragmentCost === null) {
    return false;
  }

  return getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)) >= normalizedFragmentCost
    && isEvolutionFamilyComplete(state, monster)
    && areRequiredDexStoriesUnlockedForCandy(state, monster);
}

/** その進化系の最終形を登録済みなら、進化が終わったものとして扱います。 */
function isEvolutionFamilyComplete(state: AppSaveState, monster: MonsterDefinition): boolean {
  return getStoredPositiveCount(state.captures, getFinalEvolutionMonsterId(monster.id)) > 0;
}

/** アメ交換前に優先したい図鑑ストーリーが、すべて解放済みか調べます。 */
function areRequiredDexStoriesUnlockedForCandy(state: AppSaveState, monster: MonsterDefinition): boolean {
  return getEvolutionFamily(monster).every((familyMonster) => {
    if (!familyMonster.dexStoryEnabled
      || normalizePositiveInteger(familyMonster.dexStoryRequiredFragments) === null
      || !getEmbeddedStoryDraftForMonsterDex(familyMonster.id)) {
      return true;
    }

    return isDexStoryUnlocked(state, familyMonster.id);
  });
}

/** 同じ進化系のモンスターを、進化順に並べて返します。 */
function getEvolutionFamily(monster: MonsterDefinition): MonsterDefinition[] {
  return Array.from(monsterById.values())
    .filter((candidate) => candidate.evolutionFamilyId === monster.evolutionFamilyId)
    .sort((left, right) => left.evolutionStage - right.evolutionStage);
}

/** 指定モンスターの図鑑ストーリーが解放済みかどうかを返します。 */
export function isDexStoryUnlocked(state: AppSaveState, monsterId: string): boolean {
  return knownMonsterIds.has(monsterId) && state.unlockedDexStoryMonsterIds.includes(monsterId);
}

/** 指定モンスターの図鑑ストーリーを、かけら消費で解放できる状態か調べます。 */
export function canUnlockDexStory(state: AppSaveState, monsterId: string): boolean {
  const monster = monsterById.get(monsterId);
  const requiredFragments = normalizePositiveInteger(monster?.dexStoryRequiredFragments);
  if (!monster || !monster.dexStoryEnabled || requiredFragments === null || isDexStoryUnlocked(state, monsterId)) {
    return false;
  }

  return getStoredPositiveCount(state.captures, monsterId) > 0
    && arePreviousDexStoriesUnlocked(state, monster)
    && getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)) >= requiredFragments;
}

/** 図鑑ストーリー解放時に、同じ属性のアメで足りないかけらを補えるか調べます。 */
export function canUnlockDexStoryWithCandy(state: AppSaveState, monsterId: string): boolean {
  const missingFragments = getDexStoryUnlockCandyShortfall(state, monsterId);
  if (missingFragments === null || missingFragments <= 0) {
    return false;
  }

  const monster = monsterById.get(monsterId);
  return Boolean(monster && getStoredPositiveCount(state.candies, monster.attribute) >= missingFragments);
}

/** 図鑑ストーリー解放でアメ補助が必要な時、不足しているかけら数を返します。 */
export function getDexStoryUnlockCandyShortfall(state: AppSaveState, monsterId: string): number | null {
  const monster = monsterById.get(monsterId);
  const requiredFragments = normalizePositiveInteger(monster?.dexStoryRequiredFragments);
  if (!monster || !monster.dexStoryEnabled || requiredFragments === null || isDexStoryUnlocked(state, monsterId)) {
    return null;
  }

  if (getStoredPositiveCount(state.captures, monsterId) <= 0 || !arePreviousDexStoriesUnlocked(state, monster)) {
    return null;
  }

  return Math.max(0, requiredFragments - getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)));
}

/** 進化前に解放対象の図鑑ストーリーがあれば、すべて解放済みか調べます。 */
function arePreviousDexStoriesUnlocked(state: AppSaveState, monster: MonsterDefinition): boolean {
  let previousId = monster.previousEvolutionId;
  while (previousId) {
    const previousMonster = monsterById.get(previousId);
    if (!previousMonster) {
      return true;
    }

    if (previousMonster.dexStoryEnabled && !isDexStoryUnlocked(state, previousMonster.id)) {
      return false;
    }

    previousId = previousMonster.previousEvolutionId;
  }

  return true;
}

/** かけらを消費して、指定モンスターの図鑑ストーリーを解放します。 */
export function unlockDexStory(monsterId: string, useCandyForShortfall = false): AppSaveState | null {
  const monster = monsterById.get(monsterId);
  const requiredFragments = normalizePositiveInteger(monster?.dexStoryRequiredFragments);
  if (!monster || !monster.dexStoryEnabled || requiredFragments === null) {
    return null;
  }

  const current = loadSaveState();
  if (isDexStoryUnlocked(current, monsterId)) {
    return current;
  }

  if (!canUnlockDexStory(current, monsterId) && !(useCandyForShortfall && canUnlockDexStoryWithCandy(current, monsterId))) {
    return null;
  }

  const fragmentKey = getFragmentKey(monsterId);
  const currentFragments = getStoredPositiveCount(current.fragments, fragmentKey);
  const usedFragments = Math.min(currentFragments, requiredFragments);
  const missingFragments = requiredFragments - usedFragments;
  const currentCandies = getStoredPositiveCount(current.candies, monster.attribute);
  if (missingFragments > 0 && (!useCandyForShortfall || currentCandies < missingFragments)) {
    return null;
  }

  const nextFragments = {
    ...current.fragments,
    [fragmentKey]: currentFragments - usedFragments,
  };
  if (nextFragments[fragmentKey] <= 0) {
    delete nextFragments[fragmentKey];
  }
  const nextCandies = { ...current.candies };
  if (missingFragments > 0) {
    nextCandies[monster.attribute] = currentCandies - missingFragments;
    if (nextCandies[monster.attribute] <= 0) {
      delete nextCandies[monster.attribute];
    }
  }

  const next: AppSaveState = {
    ...current,
    fragments: nextFragments,
    candies: nextCandies,
    unlockedDexStoryMonsterIds: Array.from(new Set([...current.unlockedDexStoryMonsterIds, monsterId])),
  };

  return saveState(next) ? next : null;
}

/** アメをコインへ交換する保存処理です。 */
export function exchangeCandyForCoins(
  attribute: string,
  candyCost = 1,
  coinsPerCandy = COINS_PER_CANDY,
): AppSaveState | null {
  const normalizedCandyCost = normalizePositiveInteger(candyCost);
  const normalizedCoinsPerCandy = normalizePositiveInteger(coinsPerCandy);
  const current = loadSaveState();
  const currentCandies = current.candies[attribute] ?? 0;
  if (!knownCandyAttributes.has(attribute)
    || normalizedCandyCost === null
    || normalizedCoinsPerCandy === null
    || currentCandies < normalizedCandyCost) {
    return null;
  }

  const nextCandies = {
    ...current.candies,
    [attribute]: currentCandies - normalizedCandyCost,
  };
  if (nextCandies[attribute] <= 0) {
    delete nextCandies[attribute];
  }

  const next: AppSaveState = {
    ...current,
    candies: nextCandies,
    coins: current.coins + normalizedCandyCost * normalizedCoinsPerCandy,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** ショップでコインを使ってアイテムを買います。 */
export function buyShopItem(itemId: string, price: number): AppSaveState | null {
  const normalizedPrice = normalizePositiveInteger(price);
  const current = loadSaveState();
  if (!knownShopItemIds.has(itemId) || normalizedPrice === null || current.coins < normalizedPrice) {
    return null;
  }

  const next: AppSaveState = {
    ...current,
    coins: current.coins - normalizedPrice,
    items: {
      ...current.items,
      [itemId]: (current.items[itemId] ?? 0) + 1,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** 次の捕獲や対戦で自動使用する消耗アイテムを1つ減らします。 */
export function consumeShopItem(itemId: string, count = 1): AppSaveState | null {
  const normalizedCount = normalizePositiveInteger(count);
  const current = loadSaveState();
  const currentCount = current.items[itemId] ?? 0;
  if (!knownShopItemIds.has(itemId) || normalizedCount === null || currentCount < normalizedCount) {
    return null;
  }

  const nextItems = {
    ...current.items,
    [itemId]: currentCount - normalizedCount,
  };
  if (nextItems[itemId] <= 0) {
    delete nextItems[itemId];
  }

  const next: AppSaveState = {
    ...current,
    items: nextItems,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** コインでタイトル背景を購入し、購入済みなら選択だけを行います。 */
export function buyTitleBackground(backgroundId: string): AppSaveState | null {
  if (!knownTitleBackgroundIds.has(backgroundId)) {
    return null;
  }

  const current = loadSaveState();
  const background = getTitleBackgroundById(backgroundId);
  if (isTitleBackgroundOwned(current, background.id)) {
    return selectTitleBackground(background.id);
  }

  if (background.price <= 0 || current.coins < background.price) {
    return null;
  }

  const nextOwnedTitleBackgroundIds = normalizeTitleBackgroundIds([
    ...current.ownedTitleBackgroundIds,
    background.id,
  ]);
  const next: AppSaveState = {
    ...current,
    coins: current.coins - background.price,
    ownedTitleBackgroundIds: nextOwnedTitleBackgroundIds,
    selectedTitleBackgroundId: background.id,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** 所持済みのタイトル背景を選択状態として保存します。 */
export function selectTitleBackground(backgroundId: string): AppSaveState | null {
  if (!knownTitleBackgroundIds.has(backgroundId)) {
    return null;
  }

  const current = loadSaveState();
  if (!isTitleBackgroundOwned(current, backgroundId)) {
    return null;
  }

  const next: AppSaveState = {
    ...current,
    selectedTitleBackgroundId: backgroundId,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** タイトル編集画面で調整したモンスター配置を保存します。 */
export function saveTitleMonsterPlacements(
  placements: TitleMonsterPlacementState[],
): AppSaveState | null {
  const current = loadSaveState();
  const capturedPlacements = normalizeTitleMonsterPlacements(placements)
    .filter((placement) => getMonsterCaptureCount(current, placement.monsterId) > 0);
  const placedMonsterIds: Array<string | null> = capturedPlacements.map((placement) => placement.monsterId);
  const titleMonsterIds = placedMonsterIds
    .concat(Array.from<string | null>({ length: TITLE_MONSTER_SLOT_COUNT }).fill(null))
    .slice(0, TITLE_MONSTER_SLOT_COUNT);

  const next: AppSaveState = {
    ...current,
    titleMonsterIds: titleMonsterIds.some((monsterId) => monsterId !== null) ? titleMonsterIds : [],
    titleMonsterPlacements: capturedPlacements,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}
