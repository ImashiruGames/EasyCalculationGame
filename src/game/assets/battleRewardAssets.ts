import * as Phaser from 'phaser';

type RewardBoxAssetId = 'closed' | 'closedWhite' | 'open' | 'openWhite';

interface RewardBoxAsset {
  key: string;
  path: string;
}

const rewardBoxAssets: Record<RewardBoxAssetId, RewardBoxAsset> = {
  closed: { key: 'reward-box-closed', path: 'assets/battle-reward/reward-box-closed.png' },
  closedWhite: { key: 'reward-box-closed-white', path: 'assets/battle-reward/reward-box-closed-white.png' },
  open: { key: 'reward-box-open', path: 'assets/battle-reward/reward-box-open.png' },
  openWhite: { key: 'reward-box-open-white', path: 'assets/battle-reward/reward-box-open-white.png' },
};

/** ボス勝利のごほうび箱演出で使う画像を、未読み込みなら読み込みキューへ追加します。 */
export function preloadBattleRewardAssets(scene: Phaser.Scene): void {
  Object.values(rewardBoxAssets).forEach((asset) => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.path);
    }
  });
}

/** ごほうび箱の状態から、Phaserで使うテクスチャキーを返します。 */
export function getRewardBoxTextureKey(assetId: RewardBoxAssetId): string {
  return rewardBoxAssets[assetId].key;
}
