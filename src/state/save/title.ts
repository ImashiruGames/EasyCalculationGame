import {
  DEFAULT_TITLE_BACKGROUND_ID,
  getTitleBackgroundById,
  isKnownTitleBackgroundId,
} from '../../data/titleBackgrounds';
import {
  TITLE_MONSTER_DEFAULT_SIZE,
  TITLE_MONSTER_MAX_SIZE,
  TITLE_MONSTER_MIN_SIZE,
  TITLE_MONSTER_PLACEMENT_BOUNDS,
  TITLE_MONSTER_SLOT_COUNT,
} from '../../game/layoutConfig';
import { TitleMonsterPlacementState } from '../../game/types';
import { knownTitleBackgroundIds, normalizeMonsterId } from './constants';

/** タイトルに置くモンスターID配列を、捕獲済みの既知IDか空欄だけに整えます。 */
export function normalizeTitleMonsterIds(value: unknown): Array<string | null> {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = Array.from<string | null>({ length: TITLE_MONSTER_SLOT_COUNT }).fill(null);
  value.slice(0, TITLE_MONSTER_SLOT_COUNT).forEach((monsterId, index) => {
    const currentMonsterId = typeof monsterId === 'string' ? normalizeMonsterId(monsterId) : null;
    if (currentMonsterId) {
      normalized[index] = currentMonsterId;
    }
  });

  return normalized.some((monsterId) => monsterId !== null) ? normalized : [];
}

/** タイトル編集の位置・大きさを、許可された範囲内へ丸めます。 */
function clampTitlePlacementValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** タイトル編集の角度を、0度以上360度未満へ正規化します。 */
function normalizeTitlePlacementAngle(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return ((Math.round(value) % 360) + 360) % 360;
}

/** 保存されたタイトル配置を、既知モンスターと安全な座標だけに整えます。 */
export function normalizeTitleMonsterPlacements(value: unknown): TitleMonsterPlacementState[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: TitleMonsterPlacementState[] = [];
  const usedMonsterIds = new Set<string>();
  for (const placement of value) {
    if (!placement || typeof placement !== 'object') {
      continue;
    }

    const monsterId = (placement as Partial<TitleMonsterPlacementState>).monsterId;
    const currentMonsterId = typeof monsterId === 'string' ? normalizeMonsterId(monsterId) : null;
    const x = (placement as Partial<TitleMonsterPlacementState>).x;
    const y = (placement as Partial<TitleMonsterPlacementState>).y;
    const size = (placement as Partial<TitleMonsterPlacementState>).size;
    const angle = (placement as Partial<TitleMonsterPlacementState>).angle;
    if (
      !currentMonsterId
      || usedMonsterIds.has(currentMonsterId)
      || typeof x !== 'number'
      || typeof y !== 'number'
      || typeof size !== 'number'
      || !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(size)
    ) {
      continue;
    }

    normalized.push({
      monsterId: currentMonsterId,
      x: clampTitlePlacementValue(x, TITLE_MONSTER_PLACEMENT_BOUNDS.minX, TITLE_MONSTER_PLACEMENT_BOUNDS.maxX),
      y: clampTitlePlacementValue(y, TITLE_MONSTER_PLACEMENT_BOUNDS.minY, TITLE_MONSTER_PLACEMENT_BOUNDS.maxY),
      size: clampTitlePlacementValue(size, TITLE_MONSTER_MIN_SIZE, TITLE_MONSTER_MAX_SIZE),
      angle: normalizeTitlePlacementAngle(angle),
    });
    usedMonsterIds.add(currentMonsterId);

    if (normalized.length >= TITLE_MONSTER_SLOT_COUNT) {
      break;
    }
  }

  return normalized;
}

/** 旧形式のタイトルモンスターID配列から、現在の配置形式へ変換します。 */
export function buildTitleMonsterPlacementsFromIds(
  titleMonsterIds: Array<string | null>,
  selectedTitleBackgroundId: string,
): TitleMonsterPlacementState[] {
  const background = getTitleBackgroundById(selectedTitleBackgroundId);
  const placements: TitleMonsterPlacementState[] = [];
  const usedMonsterIds = new Set<string>();
  titleMonsterIds.slice(0, TITLE_MONSTER_SLOT_COUNT).forEach((monsterId, index) => {
    const currentMonsterId = monsterId ? normalizeMonsterId(monsterId) : null;
    if (!currentMonsterId || usedMonsterIds.has(currentMonsterId)) {
      return;
    }

    const defaultPlacement = background.defaultMonsterPlacements[index] ?? {
      x: (TITLE_MONSTER_PLACEMENT_BOUNDS.minX + TITLE_MONSTER_PLACEMENT_BOUNDS.maxX) / 2,
      y: (TITLE_MONSTER_PLACEMENT_BOUNDS.minY + TITLE_MONSTER_PLACEMENT_BOUNDS.maxY) / 2,
      size: TITLE_MONSTER_DEFAULT_SIZE,
    };
    placements.push({
      monsterId: currentMonsterId,
      x: defaultPlacement.x,
      y: defaultPlacement.y,
      size: defaultPlacement.size,
      angle: 0,
    });
    usedMonsterIds.add(currentMonsterId);
  });

  return normalizeTitleMonsterPlacements(placements);
}

/** 所持しているタイトル背景IDを、既知IDだけの重複なしリストに整えます。 */
export function normalizeTitleBackgroundIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  value.forEach((backgroundId) => {
    if (
      typeof backgroundId === 'string'
      && backgroundId !== DEFAULT_TITLE_BACKGROUND_ID
      && knownTitleBackgroundIds.has(backgroundId)
      && !normalized.includes(backgroundId)
    ) {
      normalized.push(backgroundId);
    }
  });

  return normalized;
}

/** 選択中のタイトル背景IDを、所持済みで使える背景だけに正規化します。 */
export function normalizeSelectedTitleBackgroundId(value: unknown, ownedTitleBackgroundIds: string[]): string {
  if (
    typeof value === 'string'
    && (
      value === DEFAULT_TITLE_BACKGROUND_ID
      || ownedTitleBackgroundIds.includes(value)
    )
    && isKnownTitleBackgroundId(value)
  ) {
    return value;
  }

  return DEFAULT_TITLE_BACKGROUND_ID;
}
