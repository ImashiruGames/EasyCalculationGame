import * as Phaser from 'phaser';
import { getUnlockedAchievementCount } from '../../../data/achievements';
import { getAchievementRankForSave } from '../../../data/achievementRanks';
import type { AchievementMedalKind } from '../../../data/achievementRanks';
import { acknowledgeAchievementRankIndex } from '../../../state/save';
import { playRankUpFanfare } from '../../audio';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { getRankMedalKey } from '../../assets/medalAssets';
import type { AppSaveState } from '../../types';
import { createButton } from '../common/button';

interface RankUpOverlayOptions {
  depth?: number;
  onClose?: () => void;
}

/** トロフィーでランクが上がっていたら、現在の画面の上に一度だけランクアップ演出を出します。 */
export function showRankUpOverlayIfNeeded(
  scene: Phaser.Scene,
  saveState: AppSaveState,
  options: RankUpOverlayOptions = {},
): boolean {
  const rank = getAchievementRankForSave(saveState);
  if (rank.index <= saveState.acknowledgedAchievementRankIndex) {
    return false;
  }

  const overlay = scene.add.container(0, 0).setDepth(options.depth ?? 90);
  const dim = scene.add
    .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Phaser.Display.Color.HexStringToColor('#fff7cf').color, 0.96)
    .setOrigin(0);
  const inputBlocker = scene.add
    .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
    .setOrigin(0.5)
    .setInteractive();
  const panel = scene.add.graphics();
  panel.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.98);
  panel.lineStyle(5, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
  panel.fillRoundedRect(34, 120, 322, 554, 28);
  panel.strokeRoundedRect(34, 120, 322, 554, 28);

  const rays = scene.add.graphics();
  rays.fillStyle(Phaser.Display.Color.HexStringToColor('#ffe58a').color, 0.42);
  for (let index = 0; index < 20; index += 1) {
    const angle = (Math.PI * 2 * index) / 20;
    const inner = 80;
    const outer = index % 2 === 0 ? 154 : 114;
    rays.fillTriangle(
      GAME_WIDTH / 2 + Math.cos(angle - 0.05) * inner,
      254 + Math.sin(angle - 0.05) * inner,
      GAME_WIDTH / 2 + Math.cos(angle) * outer,
      254 + Math.sin(angle) * outer,
      GAME_WIDTH / 2 + Math.cos(angle + 0.05) * inner,
      254 + Math.sin(angle + 0.05) * inner,
    );
  }

  const medalObjects = createMedalObjects(scene, rank.medal);
  const title = scene.add
    .text(GAME_WIDTH / 2, 426, `おめでとう！\n${rank.name}ランクに\nあがったよ！`, {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 292, useAdvancedWrap: true },
    })
    .setOrigin(0.5);
  const countText = scene.add
    .text(GAME_WIDTH / 2, 538, `トロフィー ${getUnlockedAchievementCount(saveState)}こ`, {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      fontStyle: '900',
      color: COLORS.muted,
      align: 'center',
    })
    .setOrigin(0.5);
  const closeButton = createButton(scene, {
    x: GAME_WIDTH / 2,
    y: 612,
    width: 190,
    height: 58,
    label: 'もどる',
    fillColor: COLORS.yellow,
    fontSize: 24,
    onClick: () => {
      acknowledgeAchievementRankIndex(rank.index);
      overlay.destroy(true);
      options.onClose?.();
    },
  });

  overlay.add([dim, inputBlocker, panel, rays, ...medalObjects, title, countText, closeButton]);
  overlay.setAlpha(0);
  overlay.setScale(0.96);
  scene.tweens.add({ targets: overlay, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: medalObjects,
    scale: 1.06,
    yoyo: true,
    repeat: 3,
    duration: 220,
    ease: 'Sine.easeInOut',
  });
  playRankUpFanfare();

  return true;
}

/** メダル画像があれば使い、なければ図形で代替メダルを作ります。 */
function createMedalObjects(scene: Phaser.Scene, medalKind: AchievementMedalKind): Phaser.GameObjects.GameObject[] {
  const medalKey = getRankMedalKey(medalKind);
  if (scene.textures.exists(medalKey)) {
    const medal = scene.add.image(GAME_WIDTH / 2, 264, medalKey).setDisplaySize(122, 136);
    return [medal];
  }

  const fallback = scene.add.graphics();
  fallback.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
  fallback.lineStyle(5, Phaser.Display.Color.HexStringToColor('#c47a00').color, 1);
  fallback.fillCircle(GAME_WIDTH / 2, 254, 56);
  fallback.strokeCircle(GAME_WIDTH / 2, 254, 56);
  fallback.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.red).color, 1);
  fallback.fillTriangle(162, 306, 184, 306, 156, 374);
  fallback.fillTriangle(206, 306, 228, 306, 234, 374);
  return [fallback];
}
