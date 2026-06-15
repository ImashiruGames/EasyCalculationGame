import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import { getMonstersByIds } from '../../../data/monsters';
import { stages } from '../../../data/stages';
import { getTitleBackgroundTextureKey } from '../../../data/titleBackgrounds';
import {
  getDailyLoginBonusStatus,
  getSelectedTitleBackground,
  getTitleMonsterIds,
  getTitleMonsterPlacements,
  loadSaveState,
} from '../../../state/save';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';
import { COLORS, FONT_FAMILY } from '../../constants';
import {
  DEBUG_ALWAYS_SHOW_LOGIN_BONUS_SCREEN,
  SHOW_LOGIN_BONUS_SCREEN,
  SHOW_TITLE_SCREEN,
} from '../../flowConfig';
import { APP_LAYOUT } from '../../layoutConfig';
import { getMonsterImageAssetsByIds, preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import { startSceneWithLoading } from '../../sceneNavigation';
import { getStageBackgroundAssetsByIds } from '../../assets/stageBackgroundAssets';
import { playButtonTapSound } from '../../audio';
import { startBgm } from '../../bgm';
import { TitleBackgroundDefinition } from '../../../data/titleBackgrounds';
import { drawTitleBackgroundArt } from '../../ui/title/titleBackground';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';

export class TitleScene extends Phaser.Scene {
  private isProceeding = false;

  constructor() {
    super(SceneKeys.Title);
  }

  preload(): void {
    if (!SHOW_TITLE_SCREEN) {
      return;
    }

    this.drawLoadingScreen();
    const saveState = loadSaveState();
    const titleBackground = getSelectedTitleBackground(saveState);
    if (titleBackground.imagePath && !this.textures.exists(getTitleBackgroundTextureKey(titleBackground))) {
      this.load.image(getTitleBackgroundTextureKey(titleBackground), titleBackground.imagePath);
    }
    preloadMonsterImageAssetsByIds(this, getTitleMonsterIds(saveState));
  }

  create(): void {
    this.isProceeding = false;
    this.children.removeAll(true);
    if (!SHOW_TITLE_SCREEN) {
      this.proceed();
      return;
    }

    this.cameras.main.setBackgroundColor('#dff6ff');
    startBgm('title');
    const saveState = loadSaveState();
    const titleBackground = getSelectedTitleBackground(saveState);
    this.cameras.main.setBackgroundColor(titleBackground.skyColor);
    drawTitleBackgroundArt(this, titleBackground);
    this.drawTitle(titleBackground);
    this.drawCharacters(saveState);
    this.drawTouchPrompt(titleBackground);
    this.warmLikelyNextAssets();

    this.input.once('pointerdown', () => this.proceed());
    this.input.keyboard?.once('keydown-ENTER', () => this.proceed());
    this.input.keyboard?.once('keydown-SPACE', () => this.proceed());
  }

  private drawLoadingScreen(): void {
    this.cameras.main.setBackgroundColor('#fffaf0');
    const progressBackground = this.add.graphics();
    const progressBar = this.add.graphics();
    const barFrame = APP_LAYOUT.title.loadingBarFrame;
    const barFill = APP_LAYOUT.title.loadingBarFill;
    progressBackground.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 1);
    progressBackground.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.8);
    progressBackground.fillRoundedRect(barFrame.x, barFrame.y, barFrame.width, barFrame.height, barFrame.radius);
    progressBackground.strokeRoundedRect(barFrame.x, barFrame.y, barFrame.width, barFrame.height, barFrame.radius);

    this.add
      .text(APP_LAYOUT.title.loadingText.x, APP_LAYOUT.title.loadingText.y, 'よみこみ中...', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const updateProgress = (value: number): void => {
      progressBar.clear();
      progressBar.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
      progressBar.fillRoundedRect(
        barFill.x,
        barFill.y,
        barFill.width * Phaser.Math.Clamp(value, 0, 1),
        barFill.height,
        barFill.radius,
      );
    };
    this.load.on('progress', updateProgress);
    this.load.once('complete', () => {
      this.load.off('progress', updateProgress);
    });
  }

  private drawTitle(titleBackground: TitleBackgroundDefinition): void {
    this.add
      .text(APP_LAYOUT.title.titleText.x, APP_LAYOUT.title.titleText.y, 'けいさん\nモンスター', {
        fontFamily: FONT_FAMILY,
        fontSize: '52px',
        fontStyle: '900',
        color: titleBackground.titleColor,
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5)
      .setStroke(titleBackground.titleStrokeColor, 8)
      .setDepth(20);

    this.add
      .text(APP_LAYOUT.title.subtitleText.x, APP_LAYOUT.title.subtitleText.y, '1けた計算で なかまをふやそう', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: titleBackground.subtitleColor,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  private drawCharacters(saveState: ReturnType<typeof loadSaveState>): void {
    getTitleMonsterPlacements(saveState).forEach((placement) => {
      if (!placement.monsterId) {
        return;
      }

      createMonsterVisual(this, getMonsterById(placement.monsterId), placement.x, placement.y, placement.size)
        .setAngle(placement.angle)
        .setDepth(10 + placement.y);
    });
  }

  private drawTouchPrompt(titleBackground: TitleBackgroundDefinition): void {
    const prompt = this.add
      .text(APP_LAYOUT.title.touchPrompt.x, APP_LAYOUT.title.touchPrompt.y, 'どこでもタッチ', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: titleBackground.promptColor,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: prompt,
      alpha: 0.38,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private warmLikelyNextAssets(): void {
    const earlyStages = stages.slice(0, 3);
    scheduleImageAssetWarmup(this, [
      ...getMonsterImageAssetsByIds(['kirapon', 'tenpico', 'yukipon']),
      ...getStageBackgroundAssetsByIds(earlyStages.map((stage) => stage.id)),
      ...getMonsterImageAssetsByIds(
        earlyStages.flatMap((stage) => getMonstersByIds(stage.monsterIds).map((monster) => monster.id)),
      ),
    ], {
      startDelayMs: 1300,
      gapMs: 700,
      maxAssets: 22,
    });
  }

  private proceed(): void {
    if (this.isProceeding) {
      return;
    }

    this.isProceeding = true;
    if (SHOW_TITLE_SCREEN) {
      playButtonTapSound();
    }
    const saveState = loadSaveState();
    const loginStatus = getDailyLoginBonusStatus(saveState);
    const shouldShowLoginBonus =
      SHOW_LOGIN_BONUS_SCREEN && (DEBUG_ALWAYS_SHOW_LOGIN_BONUS_SCREEN || loginStatus.canClaim);
    startSceneWithLoading(
      this,
      shouldShowLoginBonus ? SceneKeys.LoginBonus : SceneKeys.MainMenu,
      shouldShowLoginBonus ? 'loginBonus' : 'mainMenu',
    );
  }
}
