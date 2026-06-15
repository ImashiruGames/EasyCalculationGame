import * as Phaser from 'phaser';
import { SceneKeys } from './sceneKeys';

type SceneKey = typeof SceneKeys[keyof typeof SceneKeys];
export const DEFAULT_LOADING_MINIMUM_MS = 0;

export type FeatureLoadKey =
  | 'mainMenu'
  | 'dailyMissions'
  | 'loginBonus'
  | 'titleEdit'
  | 'story'
  | 'storyCreator'
  | 'stageSelect'
  | 'battleSelect'
  | 'achievements'
  | 'dexPreview'
  | 'shopPreview';

export interface LoadingSceneData {
  targetScene: SceneKey;
  loadKey: FeatureLoadKey;
  targetData?: object;
  minimumDisplayMs?: number;
}

/** 重い画面へ移る前にLoadingSceneを挟み、必要な素材を先に読み込ませます。 */
export function startSceneWithLoading(
  scene: Phaser.Scene,
  targetScene: SceneKey,
  loadKey: FeatureLoadKey,
  targetData?: object,
  minimumDisplayMs = DEFAULT_LOADING_MINIMUM_MS,
): void {
  scene.scene.start(SceneKeys.Loading, {
    targetScene,
    loadKey,
    targetData,
    minimumDisplayMs,
  });
}
