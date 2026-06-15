import * as Phaser from 'phaser';
import { achievements, getUnlockedAchievementCount } from '../../../data/achievements';
import { DEBUG_STAGE_CATEGORY_ID, isDebugModeEnabled } from '../../../data/debugMode';
import { getMonstersByIds } from '../../../data/monsters';
import { stages } from '../../../data/stages';
import { getTrainerPartnerMonsterIds, trainers } from '../../../data/trainers';
import {
  DailyMissionStatus,
  debugSetCoinsToLargeAmount,
  debugUnlockAllMonsters,
  debugUnlockAllStages,
  getDailyMissionBoardStatus,
  getSuggestedDailyMissionStatus,
  loadSaveState,
  getTotalCaptureCount,
  getUniqueCaptureCount,
} from '../../../state/save';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { getMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import { startSceneWithLoading } from '../../sceneNavigation';
import { getStageBackgroundAssetsByIds } from '../../assets/stageBackgroundAssets';
import { getTrainerImageAssetsByIds } from '../../assets/trainerImageAssets';
import { createButton } from '../../ui/common/button';
import { showRankUpOverlayIfNeeded } from '../../ui/achievements/rankUpOverlay';
import { startBgm } from '../../bgm';
import { preloadRankMedalAssets } from '../../assets/medalAssets';

export class MainMenuScene extends Phaser.Scene {
  /** Phaserにホーム画面のSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.MainMenu);
  }

  /** ランクアップ演出で使うメダル画像を先に読み込みます。 */
  preload(): void {
    preloadRankMedalAssets(this);
  }

  /** ホームの各ボタン、今日のおすすめ、捕獲数の表示を作ります。 */
  create(): void {
    startBgm('home');
    this.cameras.main.setBackgroundColor('#f6fbff');
    this.drawBackground();

    const saveState = loadSaveState();
    this.add
      .text(GAME_WIDTH / 2, 78, 'ホーム', {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 144, 'きょうは なにをしようかな', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 326,
      y: 86,
      width: 92,
      height: 48,
      label: 'ミッション',
      fillColor: '#ffd65a',
      strokeColor: '#b52a24',
      fontSize: 17,
      onClick: () => startSceneWithLoading(this, SceneKeys.DailyMissions, 'dailyMissions'),
    });

    createButton(this, {
      x: 64,
      y: 86,
      width: 92,
      height: 48,
      label: 'ひきつぎ',
      fillColor: '#9bdcf8',
      strokeColor: '#276b9e',
      fontSize: 17,
      onClick: () => this.scene.start(SceneKeys.Transfer),
    });

    if (isDebugModeEnabled()) {
      createButton(this, {
        x: 326,
        y: 144,
        width: 92,
        height: 38,
        label: 'デバッグ',
        fillColor: '#d7f0ff',
        strokeColor: '#276b9e',
        fontSize: 15,
        onClick: () => this.showDebugMenu(),
      });
    }

    const hasDailyMissionPick = this.drawDailyMissionPick(saveState);
    const primaryActionY = hasDailyMissionPick ? 330 : 286;
    const battleActionY = primaryActionY + 120;
    const trophyY = primaryActionY + 240;
    const storyY = trophyY + 88;
    const secondaryActionY = storyY + 102;
    const footerY = secondaryActionY + 62;

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: primaryActionY,
      width: 300,
      height: 96,
      label: 'モンスターを\nつかまえる',
      fillColor: '#ffc33f',
      strokeColor: '#b52a24',
      fontSize: 26,
      onClick: () => startSceneWithLoading(this, SceneKeys.StageSelect, 'stageSelect', { openCategoryList: true }),
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: battleActionY,
      width: 300,
      height: 96,
      label: 'モンスターで\nしょうぶする',
      fillColor: '#ff8b55',
      strokeColor: '#b52a24',
      fontSize: 25,
      onClick: () => startSceneWithLoading(this, SceneKeys.BattleSelect, 'battleSelect', { openTrainerList: true }),
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: trophyY,
      width: 300,
      height: 76,
      label: `トロフィー ${getUnlockedAchievementCount(saveState)}/${achievements.length}`,
      fillColor: '#ffe05c',
      strokeColor: '#b52a24',
      fontSize: 23,
      onClick: () => startSceneWithLoading(this, SceneKeys.Achievements, 'achievements'),
    });

    if (isDebugModeEnabled()) {
      createButton(this, {
        x: GAME_WIDTH / 2,
        y: storyY,
        width: 300,
        height: 64,
        label: 'お話つくる',
        fillColor: '#c8f0da',
        strokeColor: '#2f9f61',
        fontSize: 24,
        onClick: () => startSceneWithLoading(this, SceneKeys.StoryList, 'storyCreator'),
      });
    }

    createButton(this, {
      x: 118,
      y: secondaryActionY,
      width: 150,
      height: 78,
      label: 'ずかん',
      fillColor: '#7ed7ff',
      strokeColor: '#276b9e',
      fontSize: 24,
      onClick: () => startSceneWithLoading(this, SceneKeys.DexPreview, 'dexPreview'),
    });

    createButton(this, {
      x: 272,
      y: secondaryActionY,
      width: 150,
      height: 78,
      label: 'ショップ',
      fillColor: '#ff9bc3',
      strokeColor: '#b52a64',
      fontSize: 24,
      onClick: () => startSceneWithLoading(this, SceneKeys.ShopPreview, 'shopPreview'),
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        footerY,
        `つかまえたかず ${getTotalCaptureCount(saveState)} / しゅるい ${getUniqueCaptureCount(saveState)}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          color: COLORS.ink,
          align: 'center',
        },
      )
      .setOrigin(0.5);

    showRankUpOverlayIfNeeded(this, saveState);
    this.warmLikelyNextAssets();
  }

  /** ホーム画面の淡い背景とラインを描きます。 */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#f6fbff').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, Phaser.Display.Color.HexStringToColor('#cfeafa').color, 0.58);
    for (let y = 28; y < GAME_HEIGHT; y += 28) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#e0f8e9').color, 1);
    graphics.fillRoundedRect(-42, 174, 236, 66, 26);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff0a8').color, 1);
    graphics.fillRoundedRect(232, 214, 214, 58, 24);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffddec').color, 1);
    graphics.fillRoundedRect(220, 650, 218, 70, 28);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#d7f0ff').color, 1);
    graphics.fillRoundedRect(-34, 666, 170, 54, 22);
  }

  /** 今日のミッションから、すぐ動けるおすすめカードを一つだけ表示します。 */
  private drawDailyMissionPick(saveState: ReturnType<typeof loadSaveState>): boolean {
    const boardStatus = getDailyMissionBoardStatus(saveState);
    const missionStatus = getSuggestedDailyMissionStatus(saveState);
    const canClaimAllClear = !missionStatus && boardStatus.allClearComplete && !boardStatus.allClearClaimed;
    if (!missionStatus && !canClaimAllClear) {
      return false;
    }

    const graphics = this.add.graphics();
    const panelX = 44;
    const panelY = 170;
    const panelWidth = 302;
    const panelHeight = 72;
    const accentColor = missionStatus?.mission.accentColor ?? COLORS.yellow;
    const progressText = missionStatus ? `${missionStatus.current}/${missionStatus.target}` : `${boardStatus.completedCount}/3`;
    const isRewardReady = canClaimAllClear || missionStatus?.isComplete === true;

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.97);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(accentColor).color, 1);
    graphics.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    graphics.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(accentColor).color, 0.28);
    graphics.fillCircle(panelX + 34, panelY + panelHeight / 2, 24);

    this.add
      .text(panelX + 34, panelY + panelHeight / 2 + 1, isRewardReady ? '★' : '!', {
        fontFamily: FONT_FAMILY,
        fontSize: '23px',
        fontStyle: '900',
        color: isRewardReady ? '#b52a24' : COLORS.muted,
      })
      .setOrigin(0.5);

    this.add
      .text(panelX + 72, panelY + 18, '今日のおすすめ', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.grassDark,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(panelX + 72, panelY + 42, missionStatus?.mission.title ?? 'ぜんぶクリア', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
        wordWrap: { width: 144, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.add
      .text(panelX + 220, panelY + 20, progressText, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: panelX + 248,
      y: panelY + 45,
      width: 70,
      height: 34,
      label: isRewardReady ? 'もらう' : 'いく',
      fillColor: accentColor,
      fontSize: 14,
      onClick: () => {
        if (canClaimAllClear || missionStatus?.isComplete) {
          startSceneWithLoading(this, SceneKeys.DailyMissions, 'dailyMissions');
          return;
        }

        if (!missionStatus) {
          return;
        }

        this.goToDailyMission(missionStatus);
      },
    });
    return true;
  }

  /** ミッション内容に合わせて、対戦か捕獲の画面へ送ります。 */
  private goToDailyMission(missionStatus: DailyMissionStatus): void {
    if (missionStatus.mission.progressKey === 'battleWins') {
      startSceneWithLoading(this, SceneKeys.BattleSelect, 'battleSelect', { openTrainerList: true });
      return;
    }

    startSceneWithLoading(this, SceneKeys.StageSelect, 'stageSelect', { openCategoryList: true });
  }

  /** デバッグ中だけ使う、ステージ確認や保存データ操作のメニューを開きます。 */
  private showDebugMenu(): void {
    const overlay = this.add.container(0, 0).setDepth(120);
    const shade = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        Phaser.Display.Color.HexStringToColor(COLORS.line).color,
        0.46,
      )
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.water).color, 1);
    panel.fillRoundedRect(34, 158, 322, 438, 18);
    panel.strokeRoundedRect(34, 158, 322, 438, 18);
    overlay.add([shade, panel]);

    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 204, 'デバッグ', {
          fontFamily: FONT_FAMILY,
          fontSize: '26px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5),
    );

    const debugStageButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 270,
      width: 240,
      height: 46,
      label: 'ステージ',
      fillColor: '#d7f0ff',
      strokeColor: '#276b9e',
      fontSize: 19,
      onClick: () => startSceneWithLoading(this, SceneKeys.StageSelect, 'stageSelect', {
        categoryId: DEBUG_STAGE_CATEGORY_ID,
      }),
    });
    overlay.add(debugStageButton);

    const unlockStagesButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 328,
      width: 240,
      height: 46,
      label: 'ステージぜんぶ',
      fillColor: '#fff0a8',
      strokeColor: '#b58b24',
      fontSize: 18,
      onClick: () => this.runDebugSaveAction(overlay, debugUnlockAllStages),
    });
    overlay.add(unlockStagesButton);

    const unlockMonstersButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 386,
      width: 240,
      height: 46,
      label: 'モンスターぜんぶ',
      fillColor: '#e0f8e9',
      strokeColor: '#2f9f61',
      fontSize: 18,
      onClick: () => this.runDebugSaveAction(overlay, debugUnlockAllMonsters),
    });
    overlay.add(unlockMonstersButton);

    const coinButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 444,
      width: 240,
      height: 46,
      label: 'コイン999999',
      fillColor: '#ffe05c',
      strokeColor: '#b52a24',
      fontSize: 18,
      onClick: () => this.runDebugSaveAction(overlay, debugSetCoinsToLargeAmount),
    });
    overlay.add(coinButton);

    const bgmButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 502,
      width: 240,
      height: 46,
      label: 'BGMきく',
      fillColor: '#d7f0ff',
      strokeColor: '#276b9e',
      fontSize: 18,
      onClick: () => this.scene.start(SceneKeys.DebugBgm),
    });
    overlay.add(bgmButton);

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 564,
      width: 124,
      height: 44,
      label: 'とじる',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 18,
      onClick: () => overlay.destroy(true),
    });
    overlay.add(closeButton);
    shade.on('pointerdown', () => overlay.destroy(true));
  }

  /** デバッグ用の保存処理を実行し、成功したらホーム画面の数字を描き直します。 */
  private runDebugSaveAction(overlay: Phaser.GameObjects.Container, action: () => unknown): void {
    const result = action();
    if (!result) {
      return;
    }

    overlay.destroy(true);
    this.scene.restart();
  }

  /** ホームから次に開かれやすい背景やモンスター画像を遅延して先読みします。 */
  private warmLikelyNextAssets(): void {
    const likelyStages = stages.slice(0, 6);
    const likelyTrainers = trainers.slice(0, 3);
    scheduleImageAssetWarmup(this, [
      ...getStageBackgroundAssetsByIds(likelyStages.map((stage) => stage.id)),
      ...getMonsterImageAssetsByIds(
        likelyStages.flatMap((stage) => getMonstersByIds(stage.monsterIds).map((monster) => monster.id)),
      ),
      ...getTrainerImageAssetsByIds(likelyTrainers.map((trainer) => trainer.id)),
      ...getMonsterImageAssetsByIds(likelyTrainers.flatMap((trainer) => getTrainerPartnerMonsterIds(trainer))),
    ], {
      startDelayMs: 1200,
      gapMs: 650,
      maxAssets: 36,
    });
  }

}
