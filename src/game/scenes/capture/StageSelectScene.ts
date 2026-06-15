import * as Phaser from 'phaser';
import { BOSS_BATTLE_DISPLAY_NAME, getBossBattleForStagePage, getBossBattleMonsterIds, getBossBattleSaveId } from '../../../data/bossBattles';
import { DEBUG_STAGE_CATEGORY_ID, isDebugModeEnabled } from '../../../data/debugMode';
import { getMonsterById, getMonstersByIds } from '../../../data/monsters';
import {
  getStageById,
  getStageCategoryById,
  getVisibleStageCategories,
  getVisibleStagesByCategoryId,
  stages,
} from '../../../data/stages';
import { getPracticeLevelLabel, practiceLevels } from '../../../data/practiceLevels';
import { getStageAvailability, getStageUnlockDetails } from '../../../state/progression';
import {
  getMonsterCaptureCount,
  getBattleWinCount,
  getStagePlayLimitStatus,
  getStageSpeedStarTargetMs,
  getStageStarRank,
  loadSaveState,
  setPracticeLevelId,
} from '../../../state/save';
import { AppSaveState, BossBattleDefinition, PracticeLevelId, StageCategoryDefinition, StageDefinition, StageId } from '../../types';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { drawMathPatternBackdrop } from '../../ui/problem/mathPatternBackdrop';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { startBgm } from '../../bgm';
import { drawStagePlayLimitGauge, scheduleStagePlayLimitRefresh } from '../../ui/stage/stagePlayLimitGauge';
import { getMonsterImageAssetsByIds, preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';
import { getStageBackgroundAssetsByIds } from '../../assets/stageBackgroundAssets';

const STAGE_CATEGORIES_PER_PAGE = 4;
const STAGES_PER_PAGE = 3;

/** 描画中に追加された表示物を、あとでまとめて消せるレイヤーに入れます。 */
function captureDrawLayer(scene: Phaser.Scene, draw: () => void): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0);
  const existingChildren = new Set(scene.children.getChildren());
  draw();
  const addedChildren = scene.children
    .getChildren()
    .filter((child) => child !== layer && !existingChildren.has(child));
  addedChildren.forEach((child) => layer.add(child));
  return layer;
}

interface StageSelectSceneData {
  pageIndex?: number;
  categoryId?: string | null;
  stageId?: StageId;
  openCategoryList?: boolean;
}

export class StageSelectScene extends Phaser.Scene {
  private pageIndex = 0;
  private selectedCategoryId: string | null = null;
  private contentLayer?: Phaser.GameObjects.Container;
  private headerPointerFallback: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  /** Phaserにステージ選たく画面のSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.StageSelect);
  }

  /** 前の画面から受け取ったステージやページを、今の学年で見える範囲に丸めます。 */
  init(data?: StageSelectSceneData): void {
    const saveState = loadSaveState();
    const practiceLevelId = saveState.practiceLevelId;
    const shouldOpenCategoryList = data?.openCategoryList === true || data?.categoryId === null;
    const stageFromData = !shouldOpenCategoryList && data?.stageId
      ? stages.find((stage) => stage.id === data.stageId) ?? null
      : null;
    const requestedCategoryId = shouldOpenCategoryList ? null : stageFromData?.stageCategoryId ?? data?.categoryId ?? null;
    const canOpenDebugCategory = requestedCategoryId === DEBUG_STAGE_CATEGORY_ID && isDebugModeEnabled();
    this.selectedCategoryId = requestedCategoryId
      && (
        canOpenDebugCategory
        || this.getVisibleCategoriesForLevel(practiceLevelId).some((category) => category.id === requestedCategoryId)
      )
        ? requestedCategoryId
        : null;

    const pageFromStage = stageFromData
      ? Math.floor(
        this.getVisibleStagesForLevel(stageFromData.stageCategoryId, practiceLevelId)
          .findIndex((stage) => stage.id === stageFromData.id) / STAGES_PER_PAGE,
      )
      : 0;
    const requestedPage = shouldOpenCategoryList ? data?.pageIndex ?? 0 : data?.pageIndex ?? pageFromStage;
    const maxPageIndex = this.selectedCategoryId
      ? this.getMaxStagePageIndex(this.selectedCategoryId)
      : this.getMaxCategoryPageIndex();
    this.pageIndex = Phaser.Math.Clamp(requestedPage, 0, maxPageIndex);
  }

  /** 選たく中のジャンルがあるときだけ、そのステージで使うモンスター画像を先読みします。 */
  preload(): void {
    if (!this.selectedCategoryId) {
      return;
    }

    preloadMonsterImageAssetsByIds(
      this,
      this.getStageListPreloadMonsterIds(this.selectedCategoryId),
    );
  }

  /** ジャンル一覧かステージ一覧かを決めて、画面を描き始めます。 */
  create(): void {
    startBgm('home');
    this.cameras.main.setBackgroundColor('#f7fbff');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clearHeaderPointerFallback());
    this.redrawStageSelectView();
  }

  /** ステージ選択の見えている部分だけを、Sceneを再起動せず描き直します。 */
  private redrawStageSelectView(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const saveState = loadSaveState();

      if (this.selectedCategoryId) {
        this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxStagePageIndex(this.selectedCategoryId));
        this.drawStageList(saveState, this.selectedCategoryId);
        this.warmNearbyStageAssets();
        return;
      }

      this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxCategoryPageIndex());
      this.drawCategoryList(saveState);
      this.warmNearbyStageAssets();
    });
  }

  /** 学年に合わせて表示できるジャンルカードを並べます。 */
  private drawCategoryList(saveState: AppSaveState): void {
    this.drawHeader('ジャンルをえらぼう', () => this.scene.start(SceneKeys.MainMenu));
    this.drawPracticeLevelButton(saveState);
    this.drawPageIndicator(this.getMaxCategoryPageIndex(), 132);

    const visibleCategories = this.getVisibleCategories(saveState.practiceLevelId);
    if (visibleCategories.length === 0) {
      this.add
        .text(GAME_WIDTH / 2, 330, 'まだないよ', {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5);
    }

    visibleCategories.forEach((category, index) => {
      this.createCategoryCard(category, saveState, 190 + index * 150);
    });
    this.drawPageControls(this.getMaxCategoryPageIndex(), (pageIndex) => {
      this.changeStageSelectPage(pageIndex);
    });
  }

  /** 現在の学年を表示し、学年を変えるパネルを開くボタンを置きます。 */
  private drawPracticeLevelButton(saveState: AppSaveState): void {
    const label = `学年: ${getPracticeLevelLabel(saveState.practiceLevelId)}`;
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 104,
      width: 146,
      height: 38,
      label,
      fontSize: 16,
      fillColor: COLORS.water,
      onClick: () => this.showPracticeLevelPanel(saveState.practiceLevelId),
    });
  }

  /** 学年の候補をモーダルで出し、選ばれた学年を保存して一覧を作り直します。 */
  private showPracticeLevelPanel(currentLevelId: PracticeLevelId): void {
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
    panel.fillRoundedRect(32, 146, 326, 488, 18);
    panel.strokeRoundedRect(32, 146, 326, 488, 18);
    overlay.add([shade, panel]);

    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 194, '学年をえらぶ', {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5),
    );

    const levelButtonColumns = 2;
    const levelButtonFirstY = 244;
    const levelButtonRowGap = 54;

    practiceLevels.forEach((level, index) => {
      const col = index % levelButtonColumns;
      const row = Math.floor(index / levelButtonColumns);
      const button = createButton(this, {
        x: col === 0 ? 118 : 272,
        y: levelButtonFirstY + row * levelButtonRowGap,
        width: 124,
        height: 44,
        label: level.label,
        fontSize: 17,
        fillColor: level.id === currentLevelId ? COLORS.yellow : COLORS.panel,
        textColor: COLORS.ink,
        onClick: () => {
          if (level.id === currentLevelId) {
            overlay.destroy(true);
            return;
          }

          setPracticeLevelId(level.id);
          overlay.destroy(true);
          this.selectedCategoryId = null;
          this.pageIndex = 0;
          this.redrawStageSelectView();
        },
      });
      overlay.add(button);
    });

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 584,
      width: 124,
      height: 44,
      label: 'もどる',
      fontSize: 18,
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      onClick: () => overlay.destroy(true),
    });
    overlay.add(closeButton);
    shade.on('pointerdown', () => overlay.destroy(true));
  }

  /** 選ばれたジャンル内のステージカードをページ単位で並べます。 */
  private drawStageList(saveState: AppSaveState, categoryId: string): void {
    const category = getStageCategoryById(categoryId);
    const visibleStages = this.getVisibleStages(categoryId, saveState.practiceLevelId);
    const bossBattle = getBossBattleForStagePage(categoryId, this.pageIndex);
    drawMathPatternBackdrop(this, category.id, category.accentColor);
    this.drawHeader(category.name, () => this.queueShowCategoryList());
    this.add
      .text(GAME_WIDTH / 2, 92, category.subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '800',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);
    this.drawPageIndicator(this.getMaxStagePageIndex(categoryId), 116);
    createSmallButton(this, 348, 116, '★', () => this.showStageStarInfoPanel());

    if (visibleStages.length === 0) {
      this.add
        .text(GAME_WIDTH / 2, 330, 'まだないよ', {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5);
    }

    visibleStages.forEach((stage, index) => {
      this.createStageCard(stage, saveState, 210 + index * 190);
    });
    if (bossBattle && visibleStages.length > 0) {
      this.drawCategoryBossButton(bossBattle, visibleStages, saveState);
    }
    this.drawPageControls(this.getMaxStagePageIndex(categoryId), (pageIndex) => {
      this.changeStageSelectPage(pageIndex);
    });
  }

  /** ジャンル一覧へ戻し、同じScene内で描き直します。 */
  private showCategoryList(): void {
    this.selectedCategoryId = null;
    this.pageIndex = 0;
    this.redrawStageSelectView();
  }

  /** 戻るボタンの同じ入力でホームまで進まないよう、ジャンル一覧への復帰を次フレームへ送ります。 */
  private queueShowCategoryList(): void {
    this.time.delayedCall(0, () => this.showCategoryList());
  }

  /** ステージ選択内のページ番号を変え、同じScene内で描き直します。 */
  private changeStageSelectPage(pageIndex: number): void {
    const maxPageIndex = this.selectedCategoryId
      ? this.getMaxStagePageIndex(this.selectedCategoryId)
      : this.getMaxCategoryPageIndex();
    this.pageIndex = Phaser.Math.Clamp(pageIndex, 0, maxPageIndex);
    this.redrawStageSelectView();
  }

  /** 画面上部のタイトル、戻るボタン、メニューボタンをまとめて描きます。 */
  private drawHeader(title: string, onBack: () => void): void {
    const backAction = this.createOnceAction(onBack);
    const menuAction = () => showGameMenu(this);

    this.add
      .text(GAME_WIDTH / 2, 54, title, {
        fontFamily: FONT_FAMILY,
        fontSize: '27px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    createSmallButton(this, 42, 52, '←', backAction);
    createSmallButton(this, 348, 52, '≡', menuAction);
    this.bindHeaderPointerFallback(backAction, menuAction);
  }

  /** 連打や重なった入力でも、画面遷移が一度だけ走るようにします。 */
  private createOnceAction(action: () => void): () => void {
    let hasRun = false;
    return () => {
      if (hasRun) {
        return;
      }

      hasRun = true;
      action();
    };
  }

  /** ヘッダーボタンの当たり判定が取りにくい端末向けに、座標でも戻る操作を拾います。 */
  private bindHeaderPointerFallback(onBack: () => void, onMenu: () => void): void {
    this.clearHeaderPointerFallback();
    const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.x >= 10 && pointer.x <= 76 && pointer.y >= 24 && pointer.y <= 82) {
        onBack();
        return;
      }

      if (pointer.x >= 314 && pointer.x <= 380 && pointer.y >= 24 && pointer.y <= 82) {
        onMenu();
      }
    };

    this.headerPointerFallback = handlePointerDown;
    this.input.on('pointerdown', handlePointerDown);
  }

  /** 登録済みのヘッダー座標フォールバック入力を外します。 */
  private clearHeaderPointerFallback(): void {
    if (!this.headerPointerFallback) {
      return;
    }

    this.input.off('pointerdown', this.headerPointerFallback);
    this.headerPointerFallback = null;
  }

  /** 複数ページあるときだけ、今のページ番号を表示します。 */
  private drawPageIndicator(maxPageIndex: number, y = 92): void {
    if (maxPageIndex <= 0) {
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, y, `${this.pageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  /** 前後のページへ移動できるときだけ、ページ送りボタンを置きます。 */
  private drawPageControls(maxPageIndex: number, restartWithPage: (pageIndex: number) => void): void {
    if (maxPageIndex <= 0) {
      return;
    }

    if (this.pageIndex > 0) {
      this.drawPageButton(52, '◁', () => restartWithPage(this.pageIndex - 1));
    }

    if (this.pageIndex < maxPageIndex) {
      this.drawPageButton(338, '▷', () => restartWithPage(this.pageIndex + 1));
    }
  }

  /** Builds page arrows that wait for pointerup before redrawing the same Scene. */
  private drawPageButton(x: number, label: string, onClick: () => void): void {
    const button = createButton(this, {
      x,
      y: 784,
      width: 52,
      height: 44,
      label,
      onClick,
      fillColor: COLORS.panel,
      fontSize: 24,
      hitPadding: 12,
    });
    button.setDepth(50);
  }

  /** 今のページに表示するジャンルだけを切り出します。 */
  private getVisibleCategories(levelId = loadSaveState().practiceLevelId): StageCategoryDefinition[] {
    const start = this.pageIndex * STAGE_CATEGORIES_PER_PAGE;
    return this.getVisibleCategoriesForLevel(levelId).slice(start, start + STAGE_CATEGORIES_PER_PAGE);
  }

  /** 今のページに表示するステージだけを切り出します。 */
  private getVisibleStages(categoryId: string, levelId = loadSaveState().practiceLevelId): StageDefinition[] {
    const start = this.pageIndex * STAGES_PER_PAGE;
    return this.getVisibleStagesForLevel(categoryId, levelId).slice(start, start + STAGES_PER_PAGE);
  }

  /** 指定ページのステージ一覧を取得し、先読みなどの裏処理にも使います。 */
  private getStagePage(categoryId: string, pageIndex: number, levelId = loadSaveState().practiceLevelId): StageDefinition[] {
    const start = pageIndex * STAGES_PER_PAGE;
    return this.getVisibleStagesForLevel(categoryId, levelId).slice(start, start + STAGES_PER_PAGE);
  }

  /** 指定した学年で見せてよいジャンル一覧を取得します。 */
  private getVisibleCategoriesForLevel(levelId: PracticeLevelId): StageCategoryDefinition[] {
    return getVisibleStageCategories(levelId);
  }

  /** 指定した学年で見せてよいステージ一覧を取得します。 */
  private getVisibleStagesForLevel(categoryId: string, levelId: PracticeLevelId): StageDefinition[] {
    return getVisibleStagesByCategoryId(categoryId, levelId);
  }

  /** ステージ一覧で表示するステージモンスターとボスモンスターを、先読み用IDにまとめます。 */
  private getStageListPreloadMonsterIds(categoryId: string): string[] {
    const monsterIds = new Set<string>();
    this.getVisibleStages(categoryId).forEach((stage) => {
      getMonstersByIds(stage.monsterIds).forEach((monster) => monsterIds.add(monster.id));
    });

    const bossBattle = getBossBattleForStagePage(categoryId, this.pageIndex);
    if (bossBattle) {
      getBossBattleMonsterIds(bossBattle).forEach((monsterId) => monsterIds.add(monsterId));
    }

    return [...monsterIds];
  }

  /** 次に見そうなステージ背景やモンスター画像を、少し遅らせて先読みします。 */
  private warmNearbyStageAssets(): void {
    const levelId = loadSaveState().practiceLevelId;
    const stagesToWarm = this.selectedCategoryId
      ? [
          ...this.getVisibleStages(this.selectedCategoryId, levelId),
          ...this.getStagePage(this.selectedCategoryId, this.pageIndex + 1, levelId),
        ]
      : this.getVisibleCategoriesForLevel(levelId).flatMap((category) => this.getStagePage(category.id, 0, levelId));

    scheduleImageAssetWarmup(this, [
      ...getStageBackgroundAssetsByIds(stagesToWarm.map((stage) => stage.id)),
      ...getMonsterImageAssetsByIds(
        stagesToWarm.flatMap((stage) => getMonstersByIds(stage.monsterIds).map((monster) => monster.id)),
      ),
    ], {
      startDelayMs: 750,
      gapMs: 550,
      maxAssets: this.selectedCategoryId ? 26 : 34,
    });
  }

  /** ジャンル一覧の最後のページ番号を返します。 */
  private getMaxCategoryPageIndex(): number {
    return Math.max(0, Math.ceil(this.getVisibleCategoriesForLevel(loadSaveState().practiceLevelId).length / STAGE_CATEGORIES_PER_PAGE) - 1);
  }

  /** ステージ一覧の最後のページ番号を返します。 */
  private getMaxStagePageIndex(categoryId: string): number {
    return Math.max(0, Math.ceil(this.getVisibleStagesForLevel(categoryId, loadSaveState().practiceLevelId).length / STAGES_PER_PAGE) - 1);
  }

  /** ジャンル内の複数ステージ形式から出題するボスしょうぶ入口を描きます。 */
  private drawCategoryBossButton(bossBattle: BossBattleDefinition, visibleStages: StageDefinition[], saveState: AppSaveState): void {
    const sourceStageIds = this.getBossSourceStageIds(bossBattle, visibleStages);
    const bossSaveId = getBossBattleSaveId(bossBattle, this.pageIndex);
    const bossWinCount = getBattleWinCount(saveState, bossSaveId);
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(bossBattle.palette.background).color, 0.96);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(bossBattle.accentColor).color, 1);
    graphics.fillRoundedRect(28, 684, 334, 58, 16);
    graphics.strokeRoundedRect(28, 684, 334, 58, 16);

    this.drawBossPreviewMonsters(bossBattle, 76, 713, bossWinCount > 0);
    this.add
      .text(116, 704, BOSS_BATTLE_DISPLAY_NAME, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(116, 726, `${sourceStageIds.length}しゅるい / しょうり ${bossWinCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 306,
      y: 713,
      width: 88,
      height: 40,
      label: 'たたかう',
      fontSize: 16,
      fillColor: bossBattle.accentColor,
      onClick: () => this.scene.start(SceneKeys.BattleSelect, {
        battleMode: 'boss',
        bossId: bossBattle.id,
        bossPageIndex: this.pageIndex,
        bossSourceStageIds: sourceStageIds,
        returnStageCategoryId: bossBattle.categoryId,
        returnStagePageIndex: this.pageIndex,
      }),
    });
  }

  /** ボス入口に出す相手候補を、勝つまでは黒いシルエットで並べます。 */
  private drawBossPreviewMonsters(bossBattle: BossBattleDefinition, centerX: number, y: number, isRevealed: boolean): void {
    const bossMonsters = getBossBattleMonsterIds(bossBattle).slice(0, 3).map((monsterId) => getMonsterById(monsterId));
    const gap = 28;
    const startX = centerX - ((bossMonsters.length - 1) * gap) / 2;
    bossMonsters.forEach((monster, index) => {
      createMonsterVisual(this, monster, startX + index * gap, y, index === 0 ? 34 : 28, !isRevealed);
    });
  }

  /** ボスCSVで出題元ステージが決まっている場合はそれを優先し、未指定なら表示中ステージを使います。 */
  private getBossSourceStageIds(bossBattle: BossBattleDefinition, visibleStages: StageDefinition[]): StageId[] {
    return bossBattle.sourceStageIds.length > 0
      ? bossBattle.sourceStageIds
      : visibleStages.map((stage) => stage.id);
  }

  /** ジャンルの進み具合とボタンをまとめたカードを作ります。 */
  private createCategoryCard(category: StageCategoryDefinition, saveState: AppSaveState, y: number): void {
    const categoryStages = this.getVisibleStagesForLevel(category.id, saveState.practiceLevelId);
    let availableCount = 0;
    let clearedCount = 0;
    categoryStages.forEach((stage) => {
      if (getStageAvailability(stage, saveState) === 'available') {
        availableCount += 1;
      }

      if ((saveState.stageCaptures[stage.id] ?? 0) > 0) {
        clearedCount += 1;
      }
    });
    const graphics = this.add.graphics();

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(category.accentColor).color, 1);
    graphics.fillRoundedRect(28, y - 58, 334, 116, 18);
    graphics.strokeRoundedRect(28, y - 58, 334, 116, 18);

    this.add
      .text(50, y - 34, category.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '25px',
        fontStyle: '900',
        color: COLORS.ink,
      });

    this.add
      .text(52, y, category.subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: COLORS.muted,
      });

    this.add
      .text(52, y + 28, `ステージ ${categoryStages.length} / いける ${availableCount} / クリア ${clearedCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '800',
        color: COLORS.ink,
      });

    createButton(this, {
      x: 314,
      y: y + 4,
      width: 78,
      height: 46,
      label: 'みる',
      fontSize: 19,
      fillColor: category.accentColor,
      onClick: () => this.selectCategory(category.id),
    });
  }

  /** 選んだジャンルのステージ一覧へ、同じScene内で移ります。 */
  private selectCategory(categoryId: string): void {
    this.selectedCategoryId = categoryId;
    this.pageIndex = 0;
    this.redrawStageSelectView();
  }

  /** ステージのロック状態、モンスター、星ランク、入場ボタンを一枚のカードにまとめます。 */
  private createStageCard(stage: StageDefinition, saveState: AppSaveState, y: number): void {
    const availability = getStageAvailability(stage, saveState);
    const isAvailable = availability === 'available';
    const playLimitStatus = getStagePlayLimitStatus(saveState, stage.id);
    const canEnter = isAvailable && !playLimitStatus.isLimited;
    const stageStarRank = getStageStarRank(saveState, stage);
    const graphics = this.add.graphics();
    const alpha = isAvailable ? 1 : 0.62;

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, alpha);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(stage.accentColor).color, alpha);
    graphics.fillRoundedRect(28, y - 72, 334, 146, 18);
    graphics.strokeRoundedRect(28, y - 72, 334, 146, 18);
    if (isAvailable && stageStarRank >= 5) {
      this.drawCompleteStageCardSparkle(GAME_WIDTH / 2, y, 334, 146, canEnter ? 1 : 0.72);
    }

    this.add
      .text(48, y - 48, stage.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '23px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setAlpha(alpha);

    this.add
      .text(50, y - 16, stage.subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: COLORS.muted,
      })
      .setAlpha(alpha);

    const monsters = getMonstersByIds(stage.monsterIds).slice(0, 5);
    monsters.forEach((monster, index) => {
      const iconX = 62 + index * 43;
      const captured = getMonsterCaptureCount(saveState, monster.id) > 0;
      const visual = createMonsterVisual(this, monster, iconX, y + 36, 34, !captured);
      visual.setAlpha(alpha);
      if (captured && this.isEvolutionLineComplete(monster, saveState)) {
        this.drawCompleteEvolutionStar(iconX + 13, y + 22, alpha);
      }
    });

    if (isAvailable) {
      this.drawStageStarRank(310, y + 10, stageStarRank, alpha);
    }

    if (isAvailable) {
      if (!stage.playLimitDisabled) {
        drawStagePlayLimitGauge(this, 268, y + 54, () => getStagePlayLimitStatus(loadSaveState(), stage.id), {
          fillColor: stage.accentColor,
          squareSize: 7,
          gap: 2,
          fontSize: 11,
          xOffset: -24,
        });
        if (playLimitStatus.isLimited) {
          scheduleStagePlayLimitRefresh(this, () => getStagePlayLimitStatus(loadSaveState(), stage.id), () => {
            if (this.selectedCategoryId === stage.stageCategoryId) {
              this.redrawStageSelectView();
            }
          });
        }
      }

      createButton(this, {
        x: 318,
        y: y - 34,
        width: 76,
        height: 42,
        label: 'はいる',
        fontSize: 18,
        fillColor: stage.accentColor,
        disabled: !canEnter,
        onClick: () => this.scene.start(SceneKeys.StageIntro, { stageId: stage.id }),
      });
      return;
    }

    if (availability === 'comingSoon') {
      this.add
        .text(306, y + 48, 'Coming Soon', {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          fontStyle: '800',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    createButton(this, {
      x: 318,
      y: y + 48,
      width: 76,
      height: 38,
      label: 'やること',
      fontSize: 15,
      fillColor: COLORS.panel,
      onClick: () => this.showUnlockConditionPanel(stage, loadSaveState()),
    });
  }

  /** ロック中ステージについて、必要な条件と達成状況をパネルで見せます。 */
  private showUnlockConditionPanel(stage: StageDefinition, saveState: AppSaveState): void {
    const details = getStageUnlockDetails(stage, saveState);
    const overlay = this.add.container(0, 0).setDepth(120);
    const shade = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        Phaser.Display.Color.HexStringToColor(COLORS.line).color,
        0.48,
      )
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(stage.accentColor).color, 1);
    panel.fillRoundedRect(20, 120, 350, 610, 18);
    panel.strokeRoundedRect(20, 120, 350, 610, 18);
    overlay.add([shade, panel]);

    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 164, `${stage.name}\nあそぶために やること`, {
          fontFamily: FONT_FAMILY,
          fontSize: '23px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: 300, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );

    if (details.length === 0) {
      overlay.add(
        this.add
          .text(GAME_WIDTH / 2, 410, 'いつでも はいれるよ', {
            fontFamily: FONT_FAMILY,
            fontSize: '22px',
            fontStyle: '900',
            color: COLORS.ink,
            align: 'center',
          })
          .setOrigin(0.5),
      );
    }

    const rowGap = details.length >= 5 ? 80 : details.some((detail) => detail.helperLabel) ? 104 : 88;
    details.forEach((detail, index) => {
      const rowY = 228 + index * rowGap;
      const statusColor = detail.isMet ? COLORS.grassDark : COLORS.muted;
      overlay.add(
        this.add
          .text(50, rowY + 12, detail.isMet ? '✓' : '…', {
            fontFamily: FONT_FAMILY,
            fontSize: '22px',
            fontStyle: '900',
            color: statusColor,
          })
          .setOrigin(0.5),
      );
      overlay.add(
        this.add
          .text(72, rowY, detail.label, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            fontStyle: '900',
            color: COLORS.ink,
            wordWrap: { width: 260, useAdvancedWrap: true },
          })
          .setOrigin(0, 0),
      );
      overlay.add(
        this.add
          .text(72, rowY + 32, detail.statusLabel, {
            fontFamily: FONT_FAMILY,
            fontSize: '15px',
            fontStyle: '800',
            color: statusColor,
            wordWrap: { width: 260, useAdvancedWrap: true },
          })
          .setOrigin(0, 0),
      );
      if (detail.helperLabel) {
        this.drawUnlockHelper(overlay, detail, saveState, rowY);
      }
    });

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 692,
      width: 132,
      height: 48,
      label: 'とじる',
      fontSize: 20,
      fillColor: stage.accentColor,
      onClick: () => overlay.destroy(true),
    });
    overlay.add(closeButton);
  }

  /** ステージカードの星が増える条件を、説明パネルで見せます。 */
  private showStageStarInfoPanel(): void {
    const overlay = this.add.container(0, 0).setDepth(120);
    const shade = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        Phaser.Display.Color.HexStringToColor(COLORS.line).color,
        0.48,
      )
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
    panel.fillRoundedRect(20, 126, 350, 594, 18);
    panel.strokeRoundedRect(20, 126, 350, 594, 18);
    overlay.add([shade, panel]);

    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 164, '星のいみ', {
          fontFamily: FONT_FAMILY,
          fontSize: '26px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5),
    );

    const targetStage = stages[0] ?? getStageById('g1-tashizan-hazimarinosougen');
    const speedTargetSeconds = Math.ceil(getStageSpeedStarTargetMs(targetStage) / 1000);
    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 212, '星は これが できると\nひとつずつ ふえるよ', {
          fontFamily: FONT_FAMILY,
          fontSize: '17px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: 308, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );

    const rows = [
      '1回 クリア',
      '10回 クリア',
      'でる キャラを ぜんぶ 見つける',
      'しんかを さいごまで そろえる',
      `1もん ${speedTargetSeconds}びょうより はやく とく`,
    ];

    rows.forEach((label, index) => {
      const rowY = 292 + index * 54;
      overlay.add(
        this.add
          .text(58, rowY, '・', {
            fontFamily: FONT_FAMILY,
            fontSize: '22px',
            fontStyle: '900',
            color: COLORS.yellow,
            stroke: COLORS.ink,
            strokeThickness: 2,
          })
          .setOrigin(0, 0.5),
      );
      overlay.add(
        this.add
          .text(84, rowY, label, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            fontStyle: '900',
            color: COLORS.ink,
            wordWrap: { width: 262, useAdvancedWrap: true },
          })
          .setOrigin(0, 0.5),
      );
    });

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 672,
      width: 132,
      height: 48,
      label: 'とじる',
      fontSize: 20,
      fillColor: COLORS.yellow,
      textColor: COLORS.ink,
      onClick: () => overlay.destroy(true),
    });
    overlay.add(closeButton);
    shade.on('pointerdown', () => overlay.destroy(true));
  }

  /** 条件に関係するステージへ移動できる場合は、補助文とジャンプボタンを出します。 */
  private drawUnlockHelper(
    overlay: Phaser.GameObjects.Container,
    detail: ReturnType<typeof getStageUnlockDetails>[number],
    saveState: AppSaveState,
    rowY: number,
  ): void {
    const targetStage = detail.targetStageId ? getStageById(detail.targetStageId) : null;
    const availability = targetStage ? getStageAvailability(targetStage, saveState) : 'locked';
    const playLimitStatus = targetStage ? getStagePlayLimitStatus(saveState, targetStage.id) : null;
    const helperLabel = detail.helperLabel ?? '';
    const canJump = Boolean(targetStage
      && availability === 'available'
      && !detail.isMet
      && !playLimitStatus?.isLimited);
    const helperText = availability === 'available'
      ? playLimitStatus?.isLimited
        ? `${helperLabel}\nいまは 休けいちゅうだよ`
        : helperLabel
      : `${helperLabel}\nまだ あそべないよ！`;

    overlay.add(
      this.add
        .text(72, rowY + 56, helperText, {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          fontStyle: '800',
          color: availability === 'available' ? COLORS.muted : COLORS.red,
          lineSpacing: 1,
          wordWrap: { width: canJump ? 200 : 260, useAdvancedWrap: true },
        })
        .setOrigin(0, 0),
    );

    if (!canJump || !targetStage) {
      return;
    }

    const jumpButton = createButton(this, {
      x: 318,
      y: rowY + 64,
      width: 54,
      height: 30,
      label: 'いく',
      fontSize: 14,
      fillColor: targetStage.accentColor,
      onClick: () => this.scene.start(SceneKeys.StageIntro, { stageId: targetStage.id }),
    });
    overlay.add(jumpButton);
  }

  /** 進化先の最後まで捕獲済みかを調べ、コンプリート表示に使います。 */
  private isEvolutionLineComplete(monster: ReturnType<typeof getMonstersByIds>[number], saveState: AppSaveState): boolean {
    let finalMonster = monster;
    while (finalMonster.nextEvolutionId) {
      finalMonster = getMonsterById(finalMonster.nextEvolutionId);
    }

    return getMonsterCaptureCount(saveState, finalMonster.id) > 0;
  }

  /** 星5つのステージカードに、達成感が出る光ときらめきを重ねます。 */
  private drawCompleteStageCardSparkle(x: number, y: number, width: number, height: number, alpha = 1): void {
    const glowColor = Phaser.Display.Color.HexStringToColor(COLORS.yellow).color;
    const lineColor = Phaser.Display.Color.HexStringToColor(COLORS.panel).color;
    const glow = this.add.graphics();
    glow.fillStyle(glowColor, 0.08 * alpha);
    glow.fillRoundedRect(x - width / 2 - 4, y - height / 2 - 4, width + 8, height + 8, 22);
    glow.lineStyle(8, glowColor, 0.28 * alpha);
    glow.strokeRoundedRect(x - width / 2 - 10, y - height / 2 - 10, width + 20, height + 20, 25);
    glow.lineStyle(5, glowColor, 0.66 * alpha);
    glow.strokeRoundedRect(x - width / 2 - 5, y - height / 2 - 5, width + 10, height + 10, 22);
    glow.lineStyle(2, lineColor, 0.82 * alpha);
    glow.strokeRoundedRect(x - width / 2 + 5, y - height / 2 + 5, width - 10, height - 10, 16);
    const glowTween = this.tweens.add({
      targets: glow,
      alpha: { from: 0.46 * alpha, to: alpha },
      duration: 1120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    glow.once('destroy', () => glowTween.remove());

    [
      { startX: x - width / 2 + 30, endX: x + width / 2 - 30, lineY: y - height / 2 - 6, delay: 0 },
      { startX: x + width / 2 - 38, endX: x - width / 2 + 38, lineY: y + height / 2 + 6, delay: 420 },
    ].forEach((shimmerLine) => {
      const shimmer = this.add
        .rectangle(shimmerLine.startX, shimmerLine.lineY, 58, 4, glowColor, 0.62 * alpha)
        .setOrigin(0.5);
      const shimmerTween = this.tweens.add({
        targets: shimmer,
        x: shimmerLine.endX,
        alpha: { from: 0.14 * alpha, to: 0.82 * alpha },
        duration: 1800,
        yoyo: true,
        repeat: -1,
        delay: shimmerLine.delay,
        ease: 'Sine.easeInOut',
      });
      shimmer.once('destroy', () => shimmerTween.remove());
    });

    [
      { dx: -154, dy: -62, size: 15, delay: 0, glyph: '✦' },
      { dx: -94, dy: -78, size: 10, delay: 120, glyph: '✧' },
      { dx: -18, dy: -78, size: 12, delay: 260, glyph: '✦' },
      { dx: 68, dy: -76, size: 10, delay: 330, glyph: '✧' },
      { dx: 154, dy: -54, size: 16, delay: 410, glyph: '✦' },
      { dx: -164, dy: -2, size: 9, delay: 500, glyph: '✧' },
      { dx: 164, dy: 0, size: 9, delay: 610, glyph: '✧' },
      { dx: -160, dy: 48, size: 12, delay: 700, glyph: '✦' },
      { dx: -50, dy: 74, size: 14, delay: 820, glyph: '✧' },
      { dx: 54, dy: 74, size: 11, delay: 940, glyph: '✧' },
      { dx: 162, dy: 36, size: 13, delay: 1060, glyph: '✦' },
    ].forEach((sparkle) => {
      const star = this.add
        .text(x + sparkle.dx, y + sparkle.dy, sparkle.glyph, {
          fontFamily: FONT_FAMILY,
          fontSize: `${sparkle.size}px`,
          fontStyle: '900',
          color: COLORS.yellow,
        })
        .setOrigin(0.5)
        .setAlpha(0.78 * alpha);
      const starTween = this.tweens.add({
        targets: star,
        scale: { from: 0.72, to: 1.22 },
        alpha: { from: 0.42 * alpha, to: alpha },
        angle: { from: -8, to: 10 },
        duration: 820,
        yoyo: true,
        repeat: -1,
        delay: sparkle.delay,
        ease: 'Sine.easeInOut',
      });
      star.once('destroy', () => starTween.remove());
    });

    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const dust = this.add
        .circle(
          x + Math.cos(angle) * (width / 2 - 22),
          y + Math.sin(angle) * (height / 2 - 16),
          index % 3 === 0 ? 2.4 : 1.8,
          glowColor,
          0.28 * alpha,
        );
      const dustTween = this.tweens.add({
        targets: dust,
        x: dust.x + Math.cos(angle) * 8,
        y: dust.y + Math.sin(angle) * 8,
        scale: { from: 0.8, to: 1.6 },
        alpha: { from: 0.12 * alpha, to: 0.52 * alpha },
        duration: 1350 + index * 45,
        yoyo: true,
        repeat: -1,
        delay: index * 95,
        ease: 'Sine.easeInOut',
      });
      dust.once('destroy', () => dustTween.remove());
    }
  }

  /** 進化ラインを最後まで集めたモンスターに付ける小さな星バッジを描きます。 */
  private drawCompleteEvolutionStar(x: number, y: number, alpha = 1): void {
    const badge = this.add
      .circle(x, y, 8, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1)
      .setAlpha(alpha);
    const star = this.add
      .text(x, y + 1, '★', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);
    badge.setDepth(4);
    star.setDepth(5);
  }

  /** ステージの星ランクを5つの星で描きます。 */
  private drawStageStarRank(x: number, y: number, rank: number, alpha = 1): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.92 * alpha);
    graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0.82 * alpha);
    graphics.fillRoundedRect(x - 50, y - 14, 100, 28, 12);
    graphics.strokeRoundedRect(x - 50, y - 14, 100, 28, 12);

    for (let index = 0; index < 5; index += 1) {
      const isFilled = index < rank;
      this.add
        .text(x - 36 + index * 18, y + 1, isFilled ? '★' : '☆', {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          fontStyle: '900',
          color: isFilled ? COLORS.yellow : COLORS.muted,
          stroke: isFilled ? COLORS.ink : COLORS.panel,
          strokeThickness: isFilled ? 2 : 1,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
    }
  }
}
