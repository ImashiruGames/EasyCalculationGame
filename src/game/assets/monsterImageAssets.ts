import * as Phaser from 'phaser';
import { getMonsterById, monsters } from '../../data/monsters';
import type { MonsterDefinition } from '../types';

export interface MonsterImageAsset {
  monsterId: string;
  key: string;
  path: string;
}

const PLACEHOLDER_MONSTER_ID = '__monster-placeholder';
const PLACEHOLDER_IMAGE_FILE_NAME = 'placeholder-question.svg';
const PLACEHOLDER_IMAGE_ASSET: MonsterImageAsset = {
  monsterId: PLACEHOLDER_MONSTER_ID,
  key: 'monster-art-placeholder-question',
  path: `assets/monsters/${PLACEHOLDER_IMAGE_FILE_NAME}`,
};

/** 画像ファイル名から、Phaserのテクスチャキーで安全に使える文字列を作ります。 */
function getImageKeySuffix(imageFileName: string): string {
  return imageFileName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';
}

/** CSVの画像欄から、読み込み用の画像アセット定義を作ります。 */
function createMonsterImageAsset(monster: MonsterDefinition): MonsterImageAsset {
  const imageFileName = monster.imageFileName ?? PLACEHOLDER_IMAGE_FILE_NAME;
  return {
    monsterId: monster.id,
    key: imageFileName === PLACEHOLDER_IMAGE_FILE_NAME
      ? PLACEHOLDER_IMAGE_ASSET.key
      : `monster-art-${monster.id}-${getImageKeySuffix(imageFileName)}`,
    path: `assets/monsters/${imageFileName}`,
  };
}

export const MONSTER_IMAGE_ASSETS: MonsterImageAsset[] = monsters.map(createMonsterImageAsset);

const monsterImageAssetById = new Map(
  MONSTER_IMAGE_ASSETS.map((asset) => [asset.monsterId, asset]),
);

/** CSVに基づくモンスター画像アセットを返し、画像欄が空なら仮画像を返します。 */
export function getMonsterImageAsset(monsterId: string): MonsterImageAsset | null {
  return monsterImageAssetById.get(monsterId) ?? null;
}

/** 画像が未指定または読み込み失敗のときに使う仮画像アセットを返します。 */
export function getMonsterPlaceholderImageAsset(): MonsterImageAsset {
  return PLACEHOLDER_IMAGE_ASSET;
}

/** 画像アセット配列を、同じテクスチャキーが1回だけ出るように整えます。 */
function uniqueImageAssets(assets: MonsterImageAsset[]): MonsterImageAsset[] {
  return [...new Map(assets.map((asset) => [asset.key, asset])).values()];
}

/** 指定モンスターID群から、読み込み対象の画像アセットだけを重複なしで集めます。 */
export function getMonsterImageAssetsByIds(
  monsterIds: Iterable<string | null | undefined>,
): MonsterImageAsset[] {
  const assets: MonsterImageAsset[] = [PLACEHOLDER_IMAGE_ASSET];
  new Set(monsterIds).forEach((monsterId) => {
    if (!monsterId) {
      return;
    }

    const asset = getMonsterImageAsset(monsterId);
    if (asset) {
      assets.push(asset);
    }
  });

  return uniqueImageAssets(assets);
}

/** 指定モンスターの進化系を、最初の姿から最後の姿までID配列で返します。 */
function getEvolutionLineMonsterIds(monsterId: string): string[] {
  const monsterIds: string[] = [];
  let firstMonster = getMonsterById(monsterId);
  while (firstMonster.previousEvolutionId) {
    firstMonster = getMonsterById(firstMonster.previousEvolutionId);
  }

  let currentMonster = firstMonster;
  while (true) {
    monsterIds.push(currentMonster.id);
    if (!currentMonster.nextEvolutionId) {
      break;
    }

    currentMonster = getMonsterById(currentMonster.nextEvolutionId);
  }

  return monsterIds;
}

/** 指定モンスターと同じ進化系にある画像アセットをまとめて取得します。 */
export function getMonsterEvolutionLineImageAssetsByIds(
  monsterIds: Iterable<string | null | undefined>,
): MonsterImageAsset[] {
  const evolutionLineMonsterIds = new Set<string>();
  new Set(monsterIds).forEach((monsterId) => {
    if (!monsterId) {
      return;
    }

    getEvolutionLineMonsterIds(monsterId).forEach((lineMonsterId) => evolutionLineMonsterIds.add(lineMonsterId));
  });

  return getMonsterImageAssetsByIds(evolutionLineMonsterIds);
}

/** 画像アセットが未読み込みなら、Phaserの読み込みキューに追加します。 */
function preloadMonsterImageAssetEntry(scene: Phaser.Scene, asset: MonsterImageAsset): void {
  if (!scene.textures.exists(asset.key)) {
    scene.load.image(asset.key, asset.path);
  }
}

/** 複数モンスターの画像を、IDの重複を除いて読み込みキューに追加します。 */
export function preloadMonsterImageAssetsByIds(
  scene: Phaser.Scene,
  monsterIds: Iterable<string | null | undefined>,
): void {
  getMonsterImageAssetsByIds(monsterIds).forEach((asset) => preloadMonsterImageAssetEntry(scene, asset));
}

/** 指定モンスターの進化系画像をまとめて読み込みキューに追加します。 */
export function preloadMonsterEvolutionLineImageAssetsByIds(
  scene: Phaser.Scene,
  monsterIds: Iterable<string | null | undefined>,
): void {
  getMonsterEvolutionLineImageAssetsByIds(monsterIds)
    .forEach((asset) => preloadMonsterImageAssetEntry(scene, asset));
}

/** MainMenuのpreloadで一度だけ読み込み、以降の全シーンで同じテクスチャを共有します。 */
export function preloadMonsterImageAssets(scene: Phaser.Scene): void {
  uniqueImageAssets([PLACEHOLDER_IMAGE_ASSET, ...MONSTER_IMAGE_ASSETS])
    .forEach((asset) => preloadMonsterImageAssetEntry(scene, asset));
}
