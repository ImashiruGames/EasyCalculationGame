import * as Phaser from 'phaser';
import { stages } from '../../data/stages';
import { COLORS } from '../constants';
import { StageDefinition, StageId } from '../types';

export interface StageBackgroundAsset {
  stageId: StageId;
  key: string;
  path: string;
}

/** ステージIDから、背景画像用の安定したテクスチャキーを作ります。 */
function getBackgroundKey(stageId: StageId): string {
  return `stage-background-${stageId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

const fallbackBackgroundPathByAccentColor = new Map<string, string>([
  [COLORS.grass, 'assets/backgrounds/grasslands.webp'],
  [COLORS.ice, 'assets/backgrounds/iceCave.webp'],
  [COLORS.fire, 'assets/backgrounds/fireMountain.webp'],
  [COLORS.thunder, 'assets/backgrounds/thunderHighland.webp'],
  [COLORS.water, 'assets/backgrounds/waterGarden.webp'],
  [COLORS.moon, 'assets/backgrounds/moonRuins.webp'],
  [COLORS.yellow, 'assets/backgrounds/tenTower.webp'],
]);

/** ステージ個別の背景パスか、色に応じた代替背景パスを返します。 */
function getStageBackgroundPath(stage: StageDefinition): string | null {
  return stage.backgroundPath ?? fallbackBackgroundPathByAccentColor.get(stage.accentColor) ?? null;
}

export const STAGE_BACKGROUND_ASSETS: StageBackgroundAsset[] = stages
  .map((stage) => {
    const backgroundPath = getStageBackgroundPath(stage);
    if (!backgroundPath) {
      return null;
    }

    return {
      stageId: stage.id,
      key: getBackgroundKey(stage.id),
      path: backgroundPath,
    };
  })
  .filter((asset): asset is StageBackgroundAsset => asset !== null);

const stageBackgroundAssetById = new Map(
  STAGE_BACKGROUND_ASSETS.map((asset) => [asset.stageId, asset]),
);

/** ステージ背景画像が用意されている場合に、その読み込み定義を返します。 */
export function getStageBackgroundAsset(stageId: StageId): StageBackgroundAsset | null {
  return stageBackgroundAssetById.get(stageId) ?? null;
}

/** 指定されたステージID群から、読み込み対象の背景アセットだけを集めます。 */
export function getStageBackgroundAssetsByIds(
  stageIds: Iterable<StageId | null | undefined>,
): StageBackgroundAsset[] {
  const assets: StageBackgroundAsset[] = [];
  new Set(stageIds).forEach((stageId) => {
    if (!stageId) {
      return;
    }

    const asset = getStageBackgroundAsset(stageId);
    if (asset) {
      assets.push(asset);
    }
  });

  return assets;
}

/** 指定ステージの背景画像が未読み込みなら、Phaserの読み込みキューに追加します。 */
export function preloadStageBackgroundAsset(scene: Phaser.Scene, stageId: StageId | null | undefined): void {
  if (!stageId) {
    return;
  }

  const asset = getStageBackgroundAsset(stageId);
  if (asset && !scene.textures.exists(asset.key)) {
    scene.load.image(asset.key, asset.path);
  }
}

/** 最初のシーンで背景画像を読み込み、捕獲画面などで共有できるようにします。 */
export function preloadStageBackgroundAssets(scene: Phaser.Scene): void {
  STAGE_BACKGROUND_ASSETS.forEach((asset) => preloadStageBackgroundAsset(scene, asset.stageId));
}
