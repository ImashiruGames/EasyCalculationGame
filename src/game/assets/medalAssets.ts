import * as Phaser from 'phaser';
import type { AchievementMedalKind } from '../../data/achievementRanks';

interface MedalAsset {
  key: string;
  path: string;
}

const rankMedalAssets: Record<AchievementMedalKind, MedalAsset> = {
  bronze: { key: 'rank-medal-bronze', path: 'assets/medals/bronze.webp' },
  silver: { key: 'rank-medal-silver', path: 'assets/medals/silver.webp' },
  gold: { key: 'rank-medal-gold', path: 'assets/medals/gold.webp' },
};

/** MainMenuのpreloadで一度だけ読み込み、トロフィー画面とランクアップ演出で共有します。 */
export function preloadRankMedalAssets(scene: Phaser.Scene): void {
  Object.values(rankMedalAssets).forEach((asset) => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.path);
    }
  });
}

/** ランク種別から、読み込み済みメダル画像のテクスチャキーを返します。 */
export function getRankMedalKey(kind: AchievementMedalKind): string {
  return rankMedalAssets[kind].key;
}
