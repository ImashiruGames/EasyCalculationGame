import * as Phaser from 'phaser';
import { getStageMonsterIds, monsters } from '../../../data/monsters';
import { stages } from '../../../data/stages';
import { storyCreatorMonsterIds, storyCreatorTrainerIds } from '../../../data/storyCreatorActors';
import { debugTalkStoryScript } from '../../../data/storyScripts';
import { getTitleBackgroundTextureKey, titleBackgrounds } from '../../../data/titleBackgrounds';
import { getTrainerPartnerMonsterIds, trainers } from '../../../data/trainers';
import {
  getMonsterCaptureCount,
  getMonsterFragmentCount,
  getTitleMonsterIds,
  loadSaveState,
} from '../../../state/save';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { preloadRankMedalAssets } from '../../assets/medalAssets';
import {
  preloadMonsterEvolutionLineImageAssetsByIds,
  preloadMonsterImageAssets,
  preloadMonsterImageAssetsByIds,
} from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import {
  DEFAULT_LOADING_MINIMUM_MS,
  FeatureLoadKey,
  LoadingSceneData,
} from '../../sceneNavigation';
import { preloadStageBackgroundAssets } from '../../assets/stageBackgroundAssets';
import { preloadTrainerImageAssets, preloadTrainerImageAssetsByIds } from '../../assets/trainerImageAssets';

const LOAD_MESSAGES: Record<FeatureLoadKey, { title: string; detail: string }> = {
  mainMenu: {
    title: 'メニューをよみこみ中',
    detail: 'ページをよみこみ中',
  },
  loginBonus: {
    title: 'プレゼントをよみこみ中',
    detail: '今日のごほうびをよみこみ中',
  },
  dailyMissions: {
    title: 'ミッションをよみこみ中',
    detail: '今日することをよみこみ中',
  },
  titleEdit: {
    title: 'タイトルかざりをよみこみ中',
    detail: 'モンスターをよみこみ中',
  },
  story: {
    title: 'ストーリーをよみこみ中',
    detail: '先生とお話をよみこみ中',
  },
  storyCreator: {
    title: 'お話つくるをよみこみ中',
    detail: 'キャラをよみこみ中',
  },
  stageSelect: {
    title: 'ステージをよみこみ中',
    detail: 'モンスターをよみこみ中',
  },
  battleSelect: {
    title: 'たいせんをよみこみ中',
    detail: 'トレーナーをよみこみ中',
  },
  achievements: {
    title: 'トロフィーをよみこみ中',
    detail: 'メダルをよみこみ中',
  },
  dexPreview: {
    title: 'ずかんをよみこみ中',
    detail: '絵をよみこみ中',
  },
  shopPreview: {
    title: 'ショップをよみこみ中',
    detail: '絵をよみこみ中',
  },
};

export class LoadingScene extends Phaser.Scene {
  private targetScene: LoadingSceneData['targetScene'] = SceneKeys.MainMenu;
  private targetData: object | undefined;
  private loadKey: FeatureLoadKey = 'mainMenu';
  private minimumDisplayMs = DEFAULT_LOADING_MINIMUM_MS;
  private loadingStartedAt = 0;

  /** Phaserに読み込み画面のSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.Loading);
  }

  /** 読み込み後に開く画面と、先読みする素材の種類を受け取ります。 */
  init(data?: LoadingSceneData): void {
    this.targetScene = data?.targetScene ?? SceneKeys.MainMenu;
    this.targetData = data?.targetData;
    this.loadKey = data?.loadKey ?? 'mainMenu';
    const requestedMinimumDisplayMs = Math.max(0, data?.minimumDisplayMs ?? DEFAULT_LOADING_MINIMUM_MS);
    this.minimumDisplayMs = requestedMinimumDisplayMs;
    this.loadingStartedAt = 0;
  }

  /** 進み具合を見せる画面を描いてから、必要な素材を読み込みキューへ入れます。 */
  preload(): void {
    this.loadingStartedAt = this.time.now;
    this.drawLoadingScreen();
    this.queueAssets();
  }

  /** 読み込みが終わったら、目的の画面へそのまま進みます。 */
  create(): void {
    this.startTargetAfterMinimumDelay();
  }

  /** ロード画面が短く出すぎないように、最低表示時間を満たしてから目的の画面へ進みます。 */
  private startTargetAfterMinimumDelay(): void {
    const elapsedMs = this.time.now - this.loadingStartedAt;
    const remainingMs = Math.max(0, this.minimumDisplayMs - elapsedMs);

    if (remainingMs <= 0) {
      this.startTargetScene();
      return;
    }

    this.time.delayedCall(remainingMs, () => {
      this.startTargetScene();
    });
  }

  /** ロード完了後に、目的の画面へ進みます。 */
  private startTargetScene(): void {
    this.scene.start(this.targetScene, this.targetData);
  }

  /** 読み込みメッセージと進み具合バーを表示し、ロードイベントに合わせて更新します。 */
  private drawLoadingScreen(): void {
    const message = LOAD_MESSAGES[this.loadKey];
    this.cameras.main.setBackgroundColor('#f7fbff');

    const background = this.add.graphics();
    background.fillStyle(Phaser.Display.Color.HexStringToColor('#f7fbff').color, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fillStyle(Phaser.Display.Color.HexStringToColor('#fff4bd').color, 1);
    background.fillCircle(314, 120, 78);
    background.fillStyle(Phaser.Display.Color.HexStringToColor('#dff9e8').color, 1);
    background.fillCircle(70, 690, 126);

    if (this.loadKey === 'shopPreview') {
      this.drawShopLoadingIllustration();
    }

    this.add
      .text(GAME_WIDTH / 2, 318, message.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 366, message.detail, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '800',
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 300, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const track = this.add.graphics();
    const bar = this.add.graphics();
    const percentText = this.add
      .text(GAME_WIDTH / 2, 456, '0%', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    track.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 1);
    track.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.8);
    track.fillRoundedRect(58, 410, 274, 28, 14);
    track.strokeRoundedRect(58, 410, 274, 28, 14);

    const updateProgress = (progress: number): void => {
      const safeProgress = Phaser.Math.Clamp(progress, 0, 1);
      bar.clear();
      bar.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
      bar.fillRoundedRect(65, 417, 260 * safeProgress, 14, 7);
      percentText.setText(`${Math.round(safeProgress * 100)}%`);
    };

    updateProgress(0);
    this.load.on('progress', updateProgress);
    this.load.once('complete', () => updateProgress(1));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.load.off('progress', updateProgress);
    });
  }

  /** ショップ読み込み時だけ、店の形をした小さなイラストを出します。 */
  private drawShopLoadingIllustration(): void {
    const container = this.add.container(GAME_WIDTH / 2, 218);
    const graphics = this.add.graphics();
    const lineColor = Phaser.Display.Color.HexStringToColor(COLORS.line).color;
    const yellow = Phaser.Display.Color.HexStringToColor(COLORS.yellow).color;
    const fire = Phaser.Display.Color.HexStringToColor(COLORS.fire).color;
    const grass = Phaser.Display.Color.HexStringToColor(COLORS.grass).color;
    const water = Phaser.Display.Color.HexStringToColor(COLORS.water).color;
    const panel = Phaser.Display.Color.HexStringToColor(COLORS.panel).color;
    const muted = Phaser.Display.Color.HexStringToColor(COLORS.muted).color;

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#dff9e8').color, 0.86);
    graphics.fillEllipse(0, 52, 246, 50);

    graphics.fillStyle(panel, 1);
    graphics.lineStyle(4, lineColor, 1);
    graphics.fillRoundedRect(-104, -42, 208, 104, 22);
    graphics.strokeRoundedRect(-104, -42, 208, 104, 22);

    graphics.fillStyle(yellow, 1);
    graphics.lineStyle(4, lineColor, 1);
    graphics.fillRoundedRect(-112, -70, 224, 38, 18);
    graphics.strokeRoundedRect(-112, -70, 224, 38, 18);
    graphics.fillStyle(fire, 1);
    for (let index = 0; index < 4; index += 1) {
      graphics.fillRoundedRect(-96 + index * 48, -70, 28, 38, 12);
    }

    graphics.lineStyle(3, muted, 0.32);
    graphics.lineBetween(-72, 4, 72, 4);

    graphics.fillStyle(grass, 1);
    graphics.lineStyle(3, lineColor, 1);
    graphics.fillCircle(-56, 16, 24);
    graphics.strokeCircle(-56, 16, 24);
    graphics.fillStyle(panel, 0.62);
    graphics.fillCircle(-64, 9, 8);

    graphics.fillStyle(water, 1);
    graphics.lineStyle(3, lineColor, 1);
    graphics.fillRoundedRect(-16, -2, 42, 46, 12);
    graphics.strokeRoundedRect(-16, -2, 42, 46, 12);
    graphics.fillStyle(panel, 0.7);
    graphics.fillRoundedRect(-8, 6, 26, 12, 6);

    graphics.fillStyle(yellow, 1);
    graphics.lineStyle(3, lineColor, 1);
    graphics.fillCircle(58, 19, 19);
    graphics.strokeCircle(58, 19, 19);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor('#d7a828').color, 0.9);
    graphics.lineBetween(58, 5, 58, 33);
    graphics.lineBetween(46, 19, 70, 19);

    container.add(graphics);

    const sparkle = this.add.graphics();
    sparkle.fillStyle(yellow, 0.95);
    sparkle.fillCircle(-94, -92, 5);
    sparkle.fillCircle(92, -88, 4);
    sparkle.fillStyle(panel, 0.92);
    sparkle.fillCircle(74, -106, 3);
    container.add(sparkle);

    this.tweens.add({
      targets: container,
      y: 212,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: sparkle,
      alpha: 0.34,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** 開こうとしている機能に合わせて、必要な画像やメダル素材を読み込みます。 */
  private queueAssets(): void {
    const saveState = loadSaveState();
    switch (this.loadKey) {
      case 'mainMenu':
        preloadRankMedalAssets(this);
        return;
      case 'loginBonus':
        preloadRankMedalAssets(this);
        preloadMonsterImageAssetsByIds(this, ['kirapon', 'tenpico', 'yukipon']);
        return;
      case 'dailyMissions':
        return;
      case 'titleEdit':
        preloadMonsterImageAssetsByIds(this, [
          ...getTitleMonsterIds(saveState),
          ...monsters
            .filter((monster) => getMonsterCaptureCount(saveState, monster.id) > 0)
            .map((monster) => monster.id),
        ]);
        return;
      case 'story':
        preloadTrainerImageAssetsByIds(this, [
          'trainer-haru',
          ...debugTalkStoryScript.actors.map((actor) => actor.trainerId),
        ]);
        debugTalkStoryScript.actors.forEach((actor) => {
          if (actor.portraitKey && actor.portraitPath && !this.textures.exists(actor.portraitKey)) {
            this.load.image(actor.portraitKey, actor.portraitPath);
          }
        });
        preloadMonsterImageAssetsByIds(this, ['picoleaf']);
        return;
      case 'storyCreator':
        preloadTrainerImageAssetsByIds(this, storyCreatorTrainerIds);
        preloadMonsterImageAssetsByIds(this, storyCreatorMonsterIds);
        return;
      case 'stageSelect':
        preloadStageBackgroundAssets(this);
        preloadMonsterEvolutionLineImageAssetsByIds(
          this,
          stages.flatMap((stage) => getStageMonsterIds(stage.monsterIds)),
        );
        return;
      case 'battleSelect':
        preloadRankMedalAssets(this);
        preloadTrainerImageAssets(this);
        preloadMonsterImageAssetsByIds(this, [
          ...trainers.flatMap((trainer) => getTrainerPartnerMonsterIds(trainer)),
          ...monsters
            .filter((monster) => getMonsterCaptureCount(saveState, monster.id) > 0)
            .map((monster) => monster.id),
        ]);
        return;
      case 'achievements':
        preloadRankMedalAssets(this);
        return;
      case 'dexPreview':
        preloadMonsterImageAssets(this);
        return;
      case 'shopPreview':
        preloadMonsterImageAssetsByIds(
          this,
          monsters
            .filter((monster) => (
              getMonsterCaptureCount(saveState, monster.id) > 0
              && getMonsterFragmentCount(saveState, monster.id) > 0
            ))
            .map((monster) => monster.id),
        );
        titleBackgrounds.forEach((background) => {
          if (background.imagePath && !this.textures.exists(getTitleBackgroundTextureKey(background))) {
            this.load.image(getTitleBackgroundTextureKey(background), background.imagePath);
          }
        });
        return;
      default:
        return;
    }
  }
}
