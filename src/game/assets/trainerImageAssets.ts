import * as Phaser from 'phaser';

export interface TrainerImageAsset {
  trainerId: string;
  key: string;
  path: string;
}

export const TRAINER_IMAGE_ASSETS: TrainerImageAsset[] = [
  {
    trainerId: 'trainer-haru',
    key: 'trainer-art-haru',
    path: 'assets/trainers/green-boy.webp',
  },
  {
    trainerId: 'trainer-noko',
    key: 'trainer-art-noko',
    path: 'assets/trainers/green-girl.webp',
  },
  {
    trainerId: 'trainer-rin',
    key: 'trainer-art-rin',
    path: 'assets/trainers/icy-girl.webp',
  },
  {
    trainerId: 'trainer-minato',
    key: 'trainer-art-minato',
    path: 'assets/trainers/icy-boy.webp',
  },
  {
    trainerId: 'trainer-akari',
    key: 'trainer-art-akari',
    path: 'assets/trainers/red-girl.webp',
  },
  {
    trainerId: 'trainer-sabi',
    key: 'trainer-art-sabi',
    path: 'assets/trainers/red-boy.webp',
  },
  {
    trainerId: 'trainer-raito',
    key: 'trainer-art-raito',
    path: 'assets/trainers/yellow-boy.webp',
  },
  {
    trainerId: 'trainer-towa',
    key: 'trainer-art-towa',
    path: 'assets/trainers/yellow-girl.webp',
  },
  {
    trainerId: 'trainer-tsukino',
    key: 'trainer-art-tsukino',
    path: 'assets/trainers/dark-girl.webp',
  },
  {
    trainerId: 'trainer-kageto',
    key: 'trainer-art-kageto',
    path: 'assets/trainers/dark-boy.webp',
  },
  {
    trainerId: 'trainer-imashiru',
    key: 'trainer-art-imashiru',
    path: 'assets/trainers/imashiru.webp'
  }
];

const trainerImageAssetById = new Map(
  TRAINER_IMAGE_ASSETS.map((asset) => [asset.trainerId, asset]),
);

/** トレーナー画像がある相手だけ、生成アイコンではなく画像アセットを使えるようにします。 */
export function getTrainerImageAsset(trainerId: string): TrainerImageAsset | null {
  return trainerImageAssetById.get(trainerId) ?? null;
}

/** 指定トレーナーID群から、読み込み対象の画像アセットだけを重複なしで集めます。 */
export function getTrainerImageAssetsByIds(
  trainerIds: Iterable<string | null | undefined>,
): TrainerImageAsset[] {
  const assets: TrainerImageAsset[] = [];
  new Set(trainerIds).forEach((trainerId) => {
    if (!trainerId) {
      return;
    }

    const asset = getTrainerImageAsset(trainerId);
    if (asset) {
      assets.push(asset);
    }
  });

  return assets;
}

/** 指定トレーナーの画像が未読み込みなら、Phaserの読み込みキューに追加します。 */
export function preloadTrainerImageAsset(scene: Phaser.Scene, trainerId: string | null | undefined): void {
  if (!trainerId) {
    return;
  }

  const asset = getTrainerImageAsset(trainerId);
  if (asset && !scene.textures.exists(asset.key)) {
    scene.load.image(asset.key, asset.path);
  }
}

/** 複数トレーナーの画像を、IDの重複を除いて読み込みキューに追加します。 */
export function preloadTrainerImageAssetsByIds(
  scene: Phaser.Scene,
  trainerIds: Iterable<string | null | undefined>,
): void {
  new Set(trainerIds).forEach((trainerId) => preloadTrainerImageAsset(scene, trainerId));
}

/** MainMenuのpreloadで一度だけ読み込み、対戦シーンで同じテクスチャを共有します。 */
export function preloadTrainerImageAssets(scene: Phaser.Scene): void {
  preloadTrainerImageAssetsByIds(scene, TRAINER_IMAGE_ASSETS.map((asset) => asset.trainerId));
}
