import * as Phaser from 'phaser';
import { achievements, getUnlockedAchievementCount } from '../../../data/achievements';
import { getAchievementRank, getNextAchievementRank } from '../../../data/achievementRanks';
import { loadSaveState } from '../../../state/save';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { getRankMedalKey, preloadRankMedalAssets } from '../../assets/medalAssets';
import { SceneKeys } from '../../sceneKeys';
import type { AppSaveState } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { startBgm } from '../../bgm';

const ACHIEVEMENTS_PER_PAGE = 5;

interface AchievementsSceneData {
  pageIndex?: number;
}

export class AchievementsScene extends Phaser.Scene {
  private pageIndex = 0;

  constructor() {
    super(SceneKeys.Achievements);
  }

  init(data?: AchievementsSceneData): void {
    this.pageIndex = Phaser.Math.Clamp(data?.pageIndex ?? 0, 0, this.getMaxPageIndex());
  }

  preload(): void {
    preloadRankMedalAssets(this);
  }

  create(): void {
    startBgm('dex');
    const saveState = loadSaveState();

    this.cameras.main.setBackgroundColor('#fff9e8');
    this.drawBackground();
    this.drawHeader(saveState);
    this.getPageAchievements().forEach((achievement, index) => {
      this.drawAchievementCard(achievement, saveState, 252 + index * 88);
    });
    this.drawPageControls();
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff9e8').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff1a8').color, 1);
    graphics.fillCircle(68, 126, 96);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#e8f7ff').color, 1);
    graphics.fillCircle(334, 744, 132);
  }

  private drawHeader(saveState: AppSaveState): void {
    const unlockedCount = getUnlockedAchievementCount(saveState);
    const rank = getAchievementRank(unlockedCount);
    const nextRank = getNextAchievementRank(rank);
    const nextRankText = nextRank
      ? `つぎまで あと ${Math.max(0, nextRank.minUnlocked - unlockedCount)}こ`
      : 'ぜんぶ あつめた！';

    createSmallButton(this, 42, 52, '←', () => this.scene.start(SceneKeys.MainMenu));
    createSmallButton(this, 348, 52, '≡', () => showGameMenu(this));
    this.add
      .text(GAME_WIDTH / 2, 54, 'トロフィー', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const rankPanel = this.add.graphics();
    rankPanel.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.96);
    rankPanel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
    rankPanel.fillRoundedRect(32, 88, 326, 116, 20);
    rankPanel.strokeRoundedRect(32, 88, 326, 116, 20);

    this.add
      .image(86, 146, getRankMedalKey(rank.medal))
      .setDisplaySize(82, 92);

    this.add
      .text(138, 112, `${rank.name}のメダリスト`, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(138, 148, `${unlockedCount} / ${achievements.length} こ あつめた`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(138, 176, nextRankText, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.grassDark,
      })
      .setOrigin(0, 0.5);
  }

  private drawAchievementCard(
    achievement: (typeof achievements)[number],
    saveState: AppSaveState,
    y: number,
  ): void {
    const unlocked = achievement.isUnlocked(saveState);
    const progress = achievement.getProgress(saveState);
    const ratio = progress.target > 0 ? Phaser.Math.Clamp(progress.current / progress.target, 0, 1) : 0;
    const graphics = this.add.graphics();
    const fillColor = unlocked ? '#fffdf2' : COLORS.panel;
    const strokeColor = unlocked ? COLORS.yellow : COLORS.line;

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(fillColor).color, 0.98);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(strokeColor).color, 1);
    graphics.fillRoundedRect(26, y - 40, 338, 80, 14);
    graphics.strokeRoundedRect(26, y - 40, 338, 80, 14);

    this.add
      .text(64, y - 4, unlocked ? '🏆' : '☆', {
        fontFamily: FONT_FAMILY,
        fontSize: '26px',
        fontStyle: '900',
        color: unlocked ? '#c47a00' : COLORS.muted,
      })
      .setOrigin(0.5);
    this.add
      .text(98, y - 22, achievement.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(98, y + 2, achievement.description, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '800',
        color: COLORS.muted,
        wordWrap: { width: 238, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.add
      .rectangle(218, y + 28, 178, 8, Phaser.Display.Color.HexStringToColor('#eadfca').color, 1)
      .setOrigin(0.5);
    this.add
      .rectangle(129, y + 28, 178 * ratio, 8, Phaser.Display.Color.HexStringToColor(unlocked ? COLORS.yellow : COLORS.grass).color, 1)
      .setOrigin(0, 0.5);
    this.add
      .text(326, y + 28, `${progress.current}/${progress.target}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  private drawPageControls(): void {
    const maxPageIndex = this.getMaxPageIndex();
    this.add
      .text(GAME_WIDTH / 2, 704, `${this.pageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.pageIndex > 0) {
      createButton(this, {
        x: 92,
        y: 772,
        width: 118,
        height: 48,
        label: 'まえ',
        fillColor: COLORS.panel,
        fontSize: 18,
        onClick: () => this.scene.restart({ pageIndex: this.pageIndex - 1 }),
      });
    }

    if (this.pageIndex < maxPageIndex) {
      createButton(this, {
        x: 298,
        y: 772,
        width: 118,
        height: 48,
        label: 'つぎ',
        fillColor: COLORS.panel,
        fontSize: 18,
        onClick: () => this.scene.restart({ pageIndex: this.pageIndex + 1 }),
      });
    }
  }

  private getPageAchievements(): typeof achievements {
    const start = this.pageIndex * ACHIEVEMENTS_PER_PAGE;
    return achievements.slice(start, start + ACHIEVEMENTS_PER_PAGE);
  }

  private getMaxPageIndex(): number {
    return Math.max(0, Math.ceil(achievements.length / ACHIEVEMENTS_PER_PAGE) - 1);
  }
}
