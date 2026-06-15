import * as Phaser from 'phaser';
import { getTrainerImageAsset } from '../../assets/trainerImageAssets';
import { TrainerDefinition } from '../../types';

/** トレーナー画像が読み込み済みか確認し、使えるテクスチャキーを返します。 */
function getLoadedTrainerAssetKey(scene: Phaser.Scene, trainer: TrainerDefinition): string {
  const imageAsset = getTrainerImageAsset(trainer.id);
  if (!imageAsset) {
    throw new Error(`Missing trainer image asset: ${trainer.id}`);
  }

  if (!scene.textures.exists(imageAsset.key)) {
    throw new Error(`Trainer image is not loaded: ${imageAsset.key}`);
  }

  return imageAsset.key;
}

/** 対戦画面用に、少し大きめのトレーナー画像を配置します。 */
export function createTrainerVisual(
  scene: Phaser.Scene,
  trainer: TrainerDefinition,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, getLoadedTrainerAssetKey(scene, trainer)).setDisplaySize(size + 18, size + 18);
}

/** トレーナー登場演出用に、指定サイズのトレーナー画像を配置します。 */
export function createTrainerIntroVisual(
  scene: Phaser.Scene,
  trainer: TrainerDefinition,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, getLoadedTrainerAssetKey(scene, trainer)).setDisplaySize(size, size);
}
