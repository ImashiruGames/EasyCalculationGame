import * as Phaser from 'phaser';
import { BOSS_BATTLE_DISPLAY_NAME, bossBattles, getBossBattleAsTrainer, getBossBattleById, getBossBattleForStagePage, getBossBattleMonsterIds, getBossBattleSaveId } from '../../../data/bossBattles';
import { getMonsterById, getMonsterDexIndex, monsters } from '../../../data/monsters';
import { getTrainerById, getTrainerPartnerMonsterIds, getTrainersByDifficulty, trainers } from '../../../data/trainers';
import { getBattleWinCount, getMonsterCaptureCount, loadSaveState } from '../../../state/save';
import { getOpponentMaxHp } from '../../battle/battleRules';
import { startBgm, type BgmTrack } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import { SceneKeys } from '../../sceneKeys';
import { BattleMode, BattlePartySort, BattleSelectSceneData, AppSaveState, BossBattleDefinition, MonsterDefinition, StageId, TrainerDefinition } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { createTrainerVisual } from '../../ui/creatures/trainerVisual';
import { getMonsterImageAssetsByIds, preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { getTrainerImageAssetsByIds, preloadTrainerImageAssetsByIds } from '../../assets/trainerImageAssets';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';

const MAX_BATTLE_PARTY_SIZE = 3;
const BATTLE_TRAINERS_PER_PAGE = 3;
const BATTLE_BOSSES_PER_PAGE = 3;
const BATTLE_PARTY_PER_PAGE = 9;
const BATTLE_SELECT_LAYOUT = APP_LAYOUT.battleSelect;

const PARTY_SORT_LABELS: Record<BattlePartySort, string> = {
  attack: 'こうげき',
  hp: 'げんき',
  dex: 'ずかん',
};

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

export class BattleSelectScene extends Phaser.Scene {
  private selectedTrainerId: string | null = null;
  private selectedBossId: string | null = null;
  private bossPageIndex: number | undefined;
  private bossSourceStageIds: StageId[] = [];
  private returnStageCategoryId: string | null = null;
  private returnStagePageIndex = 0;
  private selectedPartyIds: string[] = [];
  private pageIndex = 0;
  private partyPageIndex = 0;
  private partySort: BattlePartySort = 'attack';
  private battleMode: BattleMode = 'single';
  private contentLayer?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.BattleSelect);
  }

  /** 前のボス選択状態を使わず、通常トレーナー一覧から開く指定かどうかを返します。 */
  private shouldOpenTrainerList(data?: BattleSelectSceneData): boolean {
    return data?.openTrainerList === true;
  }

  init(data?: BattleSelectSceneData): void {
    const shouldOpenTrainerList = this.shouldOpenTrainerList(data);
    this.battleMode = shouldOpenTrainerList
      ? 'single'
      : data?.battleMode === 'streak'
      ? 'streak'
      : data?.battleMode === 'boss'
        ? 'boss'
        : 'single';
    this.selectedTrainerId = !shouldOpenTrainerList && this.battleMode === 'single' ? data?.trainerId ?? null : null;
    this.selectedBossId = !shouldOpenTrainerList && this.battleMode === 'boss' ? data?.bossId ?? null : null;
    this.bossPageIndex = !shouldOpenTrainerList && this.battleMode === 'boss' ? data?.bossPageIndex : undefined;
    this.bossSourceStageIds = !shouldOpenTrainerList && this.battleMode === 'boss' ? data?.bossSourceStageIds ?? [] : [];
    this.returnStageCategoryId = shouldOpenTrainerList ? null : data?.returnStageCategoryId ?? null;
    this.returnStagePageIndex = shouldOpenTrainerList ? 0 : Math.max(0, data?.returnStagePageIndex ?? this.bossPageIndex ?? 0);
    const availableMonsterIds = new Set(monsters.map((monster) => monster.id));
    this.selectedPartyIds = shouldOpenTrainerList
      ? []
      : (data?.partyMonsterIds ?? []).filter((monsterId) => availableMonsterIds.has(monsterId));
    this.pageIndex = Phaser.Math.Clamp(shouldOpenTrainerList ? 0 : data?.pageIndex ?? 0, 0, this.getMaxPageIndex());
    this.partyPageIndex = shouldOpenTrainerList ? 0 : Math.max(0, data?.partyPageIndex ?? 0);
    this.partySort = shouldOpenTrainerList ? 'attack' : data?.partySort ?? 'attack';
  }

  preload(): void {
    const saveState = loadSaveState();
    preloadTrainerImageAssetsByIds(this, this.getPreloadTrainerIds());
    preloadMonsterImageAssetsByIds(this, this.getPreloadMonsterIds(saveState));
  }

  create(): void {
    startBgm(this.getBattleSelectBgmTrack());
    this.cameras.main.setBackgroundColor('#fff4e8');
    this.drawBackground();
    this.redrawBattleSelectView();
  }

  /** 対戦選択の中身だけを、Sceneを再起動せず描き直します。 */
  private redrawBattleSelectView(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const saveState = loadSaveState();
      this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxPageIndex());

      this.drawHeader();

      if (this.battleMode === 'boss') {
        if (this.selectedBossId) {
          this.drawBossPartySelect(getBossBattleById(this.selectedBossId), saveState);
          this.warmNearbyBattleAssets(saveState);
          return;
        }

        this.drawBossList(saveState);
        this.drawPageControls();
        this.warmNearbyBattleAssets(saveState);
        return;
      }

      if (this.battleMode === 'streak' && !this.selectedTrainerId) {
        this.drawStreakPartySelect(saveState);
        this.warmNearbyBattleAssets(saveState);
        return;
      }

      if (this.selectedTrainerId) {
        this.drawPartySelect(getTrainerById(this.selectedTrainerId), saveState);
        this.warmNearbyBattleAssets(saveState);
        return;
      }

      this.drawTrainerList(saveState);
      this.drawPageControls();
      this.warmNearbyBattleAssets(saveState);
    });
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff4e8').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffe2c4').color, 1);
    graphics.fillCircle(56, 126, 98);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff8d6').color, 1);
    graphics.fillCircle(336, 724, 136);
  }

  private drawHeader(): void {
    createSmallButton(this, 42, 52, '←', () => this.returnFromCurrentView());
    createSmallButton(this, 348, 52, '≡', () => showGameMenu(this));
    const title = this.selectedTrainerId || this.selectedBossId || this.battleMode === 'streak'
      ? 'てもちをえらぶ'
      : this.battleMode === 'boss'
        ? 'ボスをえらぶ'
        : 'あいてをえらぶ';
    this.add
      .text(GAME_WIDTH / 2, 54, title, {
        fontFamily: FONT_FAMILY,
        fontSize: '27px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  /** 今いる対戦選択内の階層から、Sceneを再起動せず一つ前へ戻します。 */
  private returnFromCurrentView(): void {
    if (this.selectedBossId) {
      if (this.returnStageCategoryId) {
        this.scene.start(SceneKeys.StageSelect, { categoryId: this.returnStageCategoryId, pageIndex: this.returnStagePageIndex });
        return;
      }

      this.selectedBossId = null;
      this.selectedPartyIds = [];
      this.partyPageIndex = 0;
      this.redrawBattleSelectView();
      return;
    }

    if (this.battleMode === 'boss') {
      if (this.returnStageCategoryId) {
        this.scene.start(SceneKeys.StageSelect, { categoryId: this.returnStageCategoryId, pageIndex: this.returnStagePageIndex });
        return;
      }

      this.battleMode = 'single';
      this.selectedBossId = null;
      this.bossPageIndex = undefined;
      this.bossSourceStageIds = [];
      this.returnStageCategoryId = null;
      this.redrawBattleSelectView();
      return;
    }

    if (this.selectedTrainerId || this.battleMode === 'streak') {
      this.battleMode = 'single';
      this.selectedTrainerId = null;
      this.selectedPartyIds = [];
      this.partyPageIndex = 0;
      this.redrawBattleSelectView();
      return;
    }

    this.scene.start(SceneKeys.MainMenu);
  }

  /** 選択中の画面に合わせて、先読みするトレーナー画像IDを返します。 */
  private getPreloadTrainerIds(): string[] {
    if (this.battleMode === 'boss') {
      return [];
    }

    if (this.selectedTrainerId) {
      return [this.selectedTrainerId];
    }

    if (this.battleMode === 'streak') {
      return [this.getStreakTrainers()[0]?.id].filter((trainerId): trainerId is string => Boolean(trainerId));
    }

    return this.getPageTrainers().map((trainer) => trainer.id);
  }

  private getPreloadMonsterIds(saveState: AppSaveState): string[] {
    const monsterIds = new Set<string>();
    const addTrainerPartners = (trainer: TrainerDefinition): void => {
      getTrainerPartnerMonsterIds(trainer).forEach((monsterId) => monsterIds.add(monsterId));
    };
    /** ボス定義から、先読みする相手モンスターIDを集めます。 */
    const addBossMonsters = (bossBattle: BossBattleDefinition): void => {
      getBossBattleMonsterIds(bossBattle).forEach((monsterId) => monsterIds.add(monsterId));
    };

    if (this.battleMode === 'boss') {
      if (this.selectedBossId) {
        addBossMonsters(getBossBattleById(this.selectedBossId));
        this.getPreloadPartyMonsterIds(saveState).forEach((monsterId) => monsterIds.add(monsterId));
        return [...monsterIds];
      }

      this.getPageBosses().forEach(addBossMonsters);
      return [...monsterIds];
    }

    if (this.selectedTrainerId) {
      addTrainerPartners(getTrainerById(this.selectedTrainerId));
      this.getPreloadPartyMonsterIds(saveState).forEach((monsterId) => monsterIds.add(monsterId));
      return [...monsterIds];
    }

    if (this.battleMode === 'streak') {
      const firstTrainer = this.getStreakTrainers()[0];
      if (firstTrainer) {
        addTrainerPartners(firstTrainer);
      }
      this.getPreloadPartyMonsterIds(saveState).forEach((monsterId) => monsterIds.add(monsterId));
      return [...monsterIds];
    }

    this.getPageTrainers().forEach(addTrainerPartners);
    return [...monsterIds];
  }

  private getPreloadPartyMonsterIds(saveState: AppSaveState): string[] {
    const capturedMonsters = this.getSortedCapturedMonsters(saveState);
    this.partyPageIndex = Phaser.Math.Clamp(this.partyPageIndex, 0, this.getMaxPartyPageIndex(capturedMonsters.length));
    return this.getPartyPageMonsters(capturedMonsters).map((monster) => monster.id);
  }

  private warmNearbyBattleAssets(saveState: AppSaveState): void {
    const trainerIds = new Set<string>();
    const monsterIds = new Set<string>();
    const addTrainer = (trainer: TrainerDefinition): void => {
      trainerIds.add(trainer.id);
      getTrainerPartnerMonsterIds(trainer).forEach((monsterId) => monsterIds.add(monsterId));
    };
    /** ボス戦で見える相手モンスターを先読み候補へ足します。 */
    const addBoss = (bossBattle: BossBattleDefinition): void => {
      getBossBattleMonsterIds(bossBattle).forEach((monsterId) => monsterIds.add(monsterId));
    };

    if (this.battleMode === 'boss') {
      if (this.selectedBossId) {
        addBoss(getBossBattleById(this.selectedBossId));
      } else {
        bossBattles
          .slice((this.pageIndex + 1) * BATTLE_BOSSES_PER_PAGE, (this.pageIndex + 2) * BATTLE_BOSSES_PER_PAGE)
          .forEach(addBoss);
      }
    } else if (this.selectedTrainerId) {
      addTrainer(getTrainerById(this.selectedTrainerId));
    } else if (this.battleMode === 'streak') {
      this.getStreakTrainers().slice(0, 2).forEach(addTrainer);
    } else {
      trainers
        .slice((this.pageIndex + 1) * BATTLE_TRAINERS_PER_PAGE, (this.pageIndex + 2) * BATTLE_TRAINERS_PER_PAGE)
        .forEach(addTrainer);
    }

    const capturedMonsters = this.getSortedCapturedMonsters(saveState);
    const nextPartyStart = (this.partyPageIndex + 1) * BATTLE_PARTY_PER_PAGE;
    this.getPartyPageMonsters(capturedMonsters).forEach((monster) => monsterIds.add(monster.id));
    capturedMonsters
      .slice(nextPartyStart, nextPartyStart + BATTLE_PARTY_PER_PAGE)
      .forEach((monster) => monsterIds.add(monster.id));

    scheduleImageAssetWarmup(this, [
      ...getTrainerImageAssetsByIds(trainerIds),
      ...getMonsterImageAssetsByIds(monsterIds),
    ], {
      startDelayMs: 850,
      gapMs: 600,
      maxAssets: 30,
    });
  }

  private drawTrainerList(saveState: AppSaveState): void {
    const pageTrainers = this.getPageTrainers();

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 112,
      width: 260,
      height: 48,
      label: 'れんぞく\nたいせん',
      fillColor: COLORS.yellow,
      fontSize: 16,
      onClick: () => this.selectStreakBattle(),
    });

    pageTrainers.forEach((trainer, index) => {
      this.drawTrainerCard(trainer, 210 + index * 154);
    });

    this.add
      .text(GAME_WIDTH / 2, 702, `しょうりすると ごほうび`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 728, `このページのしょうり ${pageTrainers.reduce((total, trainer) => total + getBattleWinCount(saveState, trainer.id), 0)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  /** ボスしょうぶで挑戦できるボスを、CSVの並び順でカード表示します。 */
  private drawBossList(saveState: AppSaveState): void {
    const pageBosses = this.getPageBosses();

    pageBosses.forEach((bossBattle, index) => {
      this.drawBossCard(bossBattle, 210 + index * 154, saveState);
    });

    this.add
      .text(GAME_WIDTH / 2, 702, 'いろんなもんだいで しょうぶ', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 728, `このページのしょうり ${pageBosses.reduce((total, bossBattle) => total + getBattleWinCount(saveState, getBossBattleSaveId(bossBattle, this.bossPageIndex)), 0)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  /** ボス1体ぶんの選択カードを描き、手持ち選択へ進むボタンを置きます。 */
  private drawBossCard(bossBattle: BossBattleDefinition, y: number, saveState: AppSaveState): void {
    const bossTrainer = getBossBattleAsTrainer(bossBattle.id, this.bossPageIndex);
    const partners = getBossBattleMonsterIds(bossBattle).map((monsterId) => getMonsterById(monsterId));
    const problemKindCount = this.getBossProblemKindCount(bossBattle);
    const isRevealed = this.isBossBattleRevealed(bossBattle, saveState);
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(bossBattle.palette.background).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(bossBattle.accentColor).color, 1);
    graphics.fillRoundedRect(28, y - 62, 334, 124, 18);
    graphics.strokeRoundedRect(28, y - 62, 334, 124, 18);

    this.drawBossMonsterGroup(partners, 72, y - 4, 54, 34, !isRevealed);
    this.add
      .text(158, y - 34, 'ボスと\nたたかう！', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
        lineSpacing: -5,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(158, y + 8, `${bossBattle.title} / ${problemKindCount}しゅるい`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(158, y + 28, this.getRewardLabel(bossTrainer), {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(158, y + 48, `しょうり ${getBattleWinCount(saveState, getBossBattleSaveId(bossBattle, this.bossPageIndex))}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 304,
      y,
      width: 88,
      height: 48,
      label: 'えらぶ',
      fillColor: bossBattle.accentColor,
      fontSize: 18,
      onClick: () => this.selectBossBattle(bossBattle.id),
    });
  }

  /** 今のボスが出題に使う問題形式数を、ステージページ指定があればそこから数えます。 */
  private getBossProblemKindCount(bossBattle: BossBattleDefinition): number {
    return this.bossSourceStageIds.length > 0 ? this.bossSourceStageIds.length : bossBattle.problemCount;
  }

  /** ボスに勝って相手の姿を見せてよいかを返します。 */
  private isBossBattleRevealed(bossBattle: BossBattleDefinition, saveState: AppSaveState): boolean {
    return getBattleWinCount(saveState, getBossBattleSaveId(bossBattle, this.bossPageIndex)) > 0;
  }

  /** ボス画面で相手モンスターを横並びに描き、未勝利ならシルエットにします。 */
  private drawBossMonsterGroup(
    partners: MonsterDefinition[],
    centerX: number,
    y: number,
    leadSize: number,
    sideSize: number,
    silhouette: boolean,
  ): void {
    const shownPartners = partners.slice(0, 3);
    const gap = 34;
    const startX = centerX - ((shownPartners.length - 1) * gap) / 2;
    shownPartners.forEach((partner, index) => {
      createMonsterVisual(this, partner, startX + index * gap, y, index === 0 ? leadSize : sideSize, silhouette);
    });
  }

  private drawTrainerCard(trainer: TrainerDefinition, y: number): void {
    const partners = getTrainerPartnerMonsterIds(trainer).map((monsterId) => getMonsterById(monsterId));
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(trainer.palette.background).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(trainer.accentColor).color, 1);
    graphics.fillRoundedRect(28, y - 62, 334, 124, 18);
    graphics.strokeRoundedRect(28, y - 62, 334, 124, 18);

    createTrainerVisual(this, trainer, BATTLE_SELECT_LAYOUT.trainerCard.trainer.x, y, BATTLE_SELECT_LAYOUT.trainerCard.trainer.size);
    partners.slice(0, 3).forEach((partner, index) => {
      createMonsterVisual(
        this,
        partner,
        BATTLE_SELECT_LAYOUT.trainerCard.partnerStartX + index * BATTLE_SELECT_LAYOUT.trainerCard.partnerGap,
        y,
        BATTLE_SELECT_LAYOUT.trainerCard.partnerSize,
      );
    });
    this.add
      .text(182, y - 28, trainer.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(182, y + 4, `レベル ${trainer.difficultyLevel}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(182, y + 32, this.getRewardLabel(trainer), {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 304,
      y,
      width: 88,
      height: 48,
      label: 'えらぶ',
      fillColor: trainer.accentColor,
      fontSize: 18,
      onClick: () => this.selectTrainerBattle(trainer.id),
    });
  }

  private drawPageControls(): void {
    const maxPageIndex = this.getMaxPageIndex();
    this.add
      .text(GAME_WIDTH / 2, 760, `${this.pageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.pageIndex > 0) {
      createButton(this, {
        x: 92,
        y: 798,
        width: 118,
        height: 48,
        label: 'まえ',
        fillColor: COLORS.panel,
        fontSize: 18,
        onClick: () => this.changeListPage(this.pageIndex - 1),
      });
    }

    if (this.pageIndex < maxPageIndex) {
      createButton(this, {
        x: 298,
        y: 798,
        width: 118,
        height: 48,
        label: 'つぎ',
        fillColor: COLORS.panel,
        fontSize: 18,
        onClick: () => this.changeListPage(this.pageIndex + 1),
      });
    }
  }

  private getBattleSelectBgmTrack(): BgmTrack {
    return 'battle';
  }

  /** 連続対戦の手持ち選択へ、同じScene内で移ります。 */
  private selectStreakBattle(): void {
    this.battleMode = 'streak';
    this.selectedTrainerId = null;
    this.selectedBossId = null;
    this.partyPageIndex = 0;
    this.redrawBattleSelectView();
  }

  /** ボスの手持ち選択へ、同じScene内で移ります。 */
  private selectBossBattle(bossId: string): void {
    this.battleMode = 'boss';
    this.selectedBossId = bossId;
    this.selectedTrainerId = null;
    this.selectedPartyIds = [];
    this.partyPageIndex = 0;
    this.redrawBattleSelectView();
  }

  /** トレーナーの手持ち選択へ、同じScene内で移ります。 */
  private selectTrainerBattle(trainerId: string): void {
    this.battleMode = 'single';
    this.selectedTrainerId = trainerId;
    this.selectedBossId = null;
    this.selectedPartyIds = [];
    this.partyPageIndex = 0;
    this.redrawBattleSelectView();
  }

  /** 一覧ページを切り替え、同じScene内で表示を更新します。 */
  private changeListPage(pageIndex: number): void {
    this.pageIndex = Phaser.Math.Clamp(pageIndex, 0, this.getMaxPageIndex());
    this.redrawBattleSelectView();
  }

  private drawPartySelect(trainer: TrainerDefinition, saveState: AppSaveState): void {
    this.drawSelectedTrainerSummary(trainer);

    this.drawPartyChoices(saveState, () => {
      this.scene.start(SceneKeys.BattleGame, {
        trainerId: trainer.id,
        partyMonsterIds: this.selectedPartyIds,
      });
    }, 'しょうぶスタート', trainer.accentColor);
  }

  /** ボスの概要を見せてから、通常バトルと同じ手持ち選択へ進めます。 */
  private drawBossPartySelect(bossBattle: BossBattleDefinition, saveState: AppSaveState): void {
    this.drawSelectedBossSummary(bossBattle, saveState);

    this.drawPartyChoices(saveState, () => {
      this.scene.start(SceneKeys.BattleGame, {
        bossId: bossBattle.id,
        bossPageIndex: this.bossPageIndex,
        bossSourceStageIds: this.bossSourceStageIds.length > 0 ? this.bossSourceStageIds : undefined,
        returnStageCategoryId: this.returnStageCategoryId ?? undefined,
        returnStagePageIndex: this.returnStagePageIndex,
        partyMonsterIds: this.selectedPartyIds,
        battleMode: 'boss',
      });
    }, BOSS_BATTLE_DISPLAY_NAME, bossBattle.accentColor);
  }

  private drawStreakPartySelect(saveState: AppSaveState): void {
    const streakTrainers = this.getStreakTrainers();
    const firstTrainer = streakTrainers[0];
    this.drawStreakSummary(firstTrainer, streakTrainers.length);

    this.drawPartyChoices(saveState, () => {
      this.scene.start(SceneKeys.BattleGame, {
        trainerId: firstTrainer.id,
        partyMonsterIds: this.selectedPartyIds,
        battleMode: 'streak',
        streakTrainerIds: streakTrainers.map((trainer) => trainer.id),
        streakIndex: 0,
      });
    }, 'れんぞくスタート', COLORS.yellow);
  }

  /** 手持ち選択のカード群と開始ボタンを、通常戦と連続対戦で共用します。 */
  private drawPartyChoices(saveState: AppSaveState, onStart: () => void, startLabel: string, startColor: string): void {
    this.add
      .text(GAME_WIDTH / 2, 218, `3びきまで つれていけるよ  ${this.selectedPartyIds.length}/3`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const capturedMonsters = this.getSortedCapturedMonsters(saveState);
    if (capturedMonsters.length === 0) {
      this.drawEmptyPartyMessage();
      return;
    }

    this.drawPartySortControls();
    this.partyPageIndex = Phaser.Math.Clamp(this.partyPageIndex, 0, this.getMaxPartyPageIndex(capturedMonsters.length));
    const pageMonsters = this.getPartyPageMonsters(capturedMonsters);

    pageMonsters.forEach((monster, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      this.drawMonsterChoice(monster, 74 + col * 121, 346 + row * 104);
    });

    this.drawPartyPageControls(capturedMonsters.length);

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 798,
      width: 260,
      height: 56,
      label: startLabel,
      fillColor: startColor,
      fontSize: 22,
      disabled: this.selectedPartyIds.length === 0,
      onClick: onStart,
    });
  }

  private drawSelectedTrainerSummary(trainer: TrainerDefinition): void {
    const partners = getTrainerPartnerMonsterIds(trainer).map((monsterId) => getMonsterById(monsterId));
    const leadPartner = partners[0];
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(trainer.palette.background).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(trainer.accentColor).color, 1);
    graphics.fillRoundedRect(34, 104, 322, 78, 18);
    graphics.strokeRoundedRect(34, 104, 322, 78, 18);
    createTrainerVisual(
      this,
      trainer,
      BATTLE_SELECT_LAYOUT.selectedTrainerSummary.trainer.x,
      BATTLE_SELECT_LAYOUT.selectedTrainerSummary.trainer.y,
      BATTLE_SELECT_LAYOUT.selectedTrainerSummary.trainer.size,
    );
    partners.slice(0, 3).forEach((partner, index) => {
      createMonsterVisual(
        this,
        partner,
        BATTLE_SELECT_LAYOUT.selectedTrainerSummary.partnerStartX
          + index * BATTLE_SELECT_LAYOUT.selectedTrainerSummary.partnerGap,
        BATTLE_SELECT_LAYOUT.selectedTrainerSummary.partnerY,
        BATTLE_SELECT_LAYOUT.selectedTrainerSummary.partnerSize,
      );
    });
    this.add
      .text(178, 130, trainer.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(178, 160, `${partners.length}びき / さいしょ ${leadPartner.name} / げんき ${getOpponentMaxHp(trainer, leadPartner)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(GAME_WIDTH / 2, 194, `レベル ${trainer.difficultyLevel}  ごほうび ${this.getRewardLabel(trainer)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  /** 手持ち選択の上部に、ボスモンスターと出題形式数を表示します。 */
  private drawSelectedBossSummary(bossBattle: BossBattleDefinition, saveState: AppSaveState): void {
    const bossTrainer = getBossBattleAsTrainer(bossBattle.id, this.bossPageIndex);
    const partners = getBossBattleMonsterIds(bossBattle).map((monsterId) => getMonsterById(monsterId));
    const leadPartner = partners[0];
    const problemKindCount = this.getBossProblemKindCount(bossBattle);
    const isRevealed = this.isBossBattleRevealed(bossBattle, saveState);
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(bossBattle.palette.background).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(bossBattle.accentColor).color, 1);
    graphics.fillRoundedRect(34, 104, 322, 78, 18);
    graphics.strokeRoundedRect(34, 104, 322, 78, 18);

    this.drawBossMonsterGroup(partners, 92, 143, 46, 32, !isRevealed);
    this.add
      .text(166, 128, BOSS_BATTLE_DISPLAY_NAME, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(166, 158, `${problemKindCount}しゅるい / げんき ${getOpponentMaxHp(bossTrainer, leadPartner)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(GAME_WIDTH / 2, 194, `レベル ${bossBattle.difficultyLevel}  ごほうび ${this.getRewardLabel(bossTrainer)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawStreakSummary(firstTrainer: TrainerDefinition, totalTrainers: number): void {
    const firstPartner = getMonsterById(getTrainerPartnerMonsterIds(firstTrainer)[0]);
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff8d6').color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1);
    graphics.fillRoundedRect(34, 104, 322, 78, 18);
    graphics.strokeRoundedRect(34, 104, 322, 78, 18);

    createTrainerVisual(
      this,
      firstTrainer,
      BATTLE_SELECT_LAYOUT.streakSummary.trainer.x,
      BATTLE_SELECT_LAYOUT.streakSummary.trainer.y,
      BATTLE_SELECT_LAYOUT.streakSummary.trainer.size,
    );
    createMonsterVisual(
      this,
      firstPartner,
      BATTLE_SELECT_LAYOUT.streakSummary.partner.x,
      BATTLE_SELECT_LAYOUT.streakSummary.partner.y,
      BATTLE_SELECT_LAYOUT.streakSummary.partner.size,
    );
    this.add
      .text(154, 128, 'れんぞくたいせん', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(154, 158, `レベル1から ${totalTrainers}にん`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(GAME_WIDTH / 2, 194, '3にんごとに たからばこ', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawEmptyPartyMessage(): void {
    this.add
      .text(GAME_WIDTH / 2, 390, 'まずはモンスターを\nつかまえてこよう', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);
  }

  private drawMonsterChoice(monster: MonsterDefinition, x: number, y: number): void {
    const selected = this.selectedPartyIds.includes(monster.id);
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(selected ? monster.palette.background : COLORS.panel).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(selected ? COLORS.yellow : COLORS.line).color, 1);
    graphics.fillRoundedRect(x - 46, y - 50, 92, 100, 14);
    graphics.strokeRoundedRect(x - 46, y - 50, 92, 100, 14);

    createMonsterVisual(
      this,
      monster,
      x,
      y + BATTLE_SELECT_LAYOUT.partyChoice.visualOffsetY,
      BATTLE_SELECT_LAYOUT.partyChoice.visualSize,
    );
    this.add
      .text(x, y + 28, monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: monster.name.length >= 5 ? '10px' : '11px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 42, `げんき${monster.hp} わざ${monster.attack}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        fontStyle: '800',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);
    if (selected) {
      this.add
        .text(x + 32, y - 34, '✓', {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          fontStyle: '900',
          color: COLORS.grassDark,
        })
        .setOrigin(0.5);
    }

    this.add
      .zone(x, y, 92, 92)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.toggleMonster(monster.id));
  }

  /** 手持ち候補の選択状態を変えて、同じScene内で表示を更新します。 */
  private toggleMonster(monsterId: string): void {
    const alreadySelected = this.selectedPartyIds.includes(monsterId);
    const nextPartyIds = alreadySelected
      ? this.selectedPartyIds.filter((selectedId) => selectedId !== monsterId)
      : this.selectedPartyIds.length < MAX_BATTLE_PARTY_SIZE
        ? [...this.selectedPartyIds, monsterId]
        : this.selectedPartyIds;

    if (nextPartyIds === this.selectedPartyIds) {
      return;
    }

    this.selectedPartyIds = nextPartyIds;
    this.redrawBattleSelectView();
  }

  /** 手持ち一覧を、子どもが選びやすい3つの基準で並び替えます。 */
  private getSortedCapturedMonsters(saveState: AppSaveState): MonsterDefinition[] {
    const capturedMonsters = monsters.filter((monster) => getMonsterCaptureCount(saveState, monster.id) > 0);
    const compareDexOrder = (a: MonsterDefinition, b: MonsterDefinition): number => getMonsterDexIndex(a.id) - getMonsterDexIndex(b.id);

    return [...capturedMonsters].sort((a, b) => {
      if (this.partySort === 'attack') {
        return b.attack - a.attack || b.hp - a.hp || compareDexOrder(a, b);
      }

      if (this.partySort === 'hp') {
        return b.hp - a.hp || b.attack - a.attack || compareDexOrder(a, b);
      }

      return compareDexOrder(a, b);
    });
  }

  private drawPartySortControls(): void {
    (['attack', 'hp', 'dex'] as BattlePartySort[]).forEach((sort, index) => {
      const selected = this.partySort === sort;
      createButton(this, {
        x: 72 + index * 123,
        y: 260,
        width: 104,
        height: 38,
        label: PARTY_SORT_LABELS[sort],
        fillColor: selected ? COLORS.yellow : COLORS.panel,
        fontSize: 15,
        onClick: () => this.changePartySort(sort),
      });
    });
  }

  /** 手持ち一覧の並び順を変えて、同じScene内で表示を更新します。 */
  private changePartySort(sort: BattlePartySort): void {
    if (this.partySort === sort) {
      return;
    }

    this.partySort = sort;
    this.partyPageIndex = 0;
    this.redrawBattleSelectView();
  }

  private drawPartyPageControls(totalMonsterCount: number): void {
    const maxPageIndex = this.getMaxPartyPageIndex(totalMonsterCount);
    this.add
      .text(GAME_WIDTH / 2, 672, `${this.partyPageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.partyPageIndex > 0) {
      createButton(this, {
        x: 92,
        y: 714,
        width: 108,
        height: 42,
        label: 'まえ',
        fillColor: COLORS.panel,
        fontSize: 17,
        onClick: () => this.changePartyPage(this.partyPageIndex - 1),
      });
    }

    if (this.partyPageIndex < maxPageIndex) {
      createButton(this, {
        x: 298,
        y: 714,
        width: 108,
        height: 42,
        label: 'つぎ',
        fillColor: COLORS.panel,
        fontSize: 17,
        onClick: () => this.changePartyPage(this.partyPageIndex + 1),
      });
    }
  }

  /** 手持ち一覧のページ番号を変えて、同じScene内で表示を更新します。 */
  private changePartyPage(nextPageIndex: number): void {
    const maxPageIndex = this.getMaxPartyPageIndex(this.getSortedCapturedMonsters(loadSaveState()).length);
    this.partyPageIndex = Phaser.Math.Clamp(nextPageIndex, 0, maxPageIndex);
    this.redrawBattleSelectView();
  }

  private getPartyPageMonsters(capturedMonsters: MonsterDefinition[]): MonsterDefinition[] {
    const start = this.partyPageIndex * BATTLE_PARTY_PER_PAGE;
    return capturedMonsters.slice(start, start + BATTLE_PARTY_PER_PAGE);
  }

  private getMaxPartyPageIndex(totalMonsterCount: number): number {
    return Math.max(0, Math.ceil(totalMonsterCount / BATTLE_PARTY_PER_PAGE) - 1);
  }

  private getRewardLabel(trainer: TrainerDefinition): string {
    const candyAmount = trainer.rewardCandyAmount ?? 0;
    const candyLabel = candyAmount > 0 && trainer.rewardCandyAttribute ? ` ${trainer.rewardCandyAttribute}アメ+${candyAmount}` : '';
    return `コイン+${trainer.rewardCoins}${candyLabel}`;
  }

  private getPageTrainers(): TrainerDefinition[] {
    const start = this.pageIndex * BATTLE_TRAINERS_PER_PAGE;
    return trainers.slice(start, start + BATTLE_TRAINERS_PER_PAGE);
  }

  /** 今のボス一覧ページに表示するボス定義だけを返します。 */
  private getPageBosses(): BossBattleDefinition[] {
    if (this.returnStageCategoryId && this.bossSourceStageIds.length > 0) {
      const bossBattle = getBossBattleForStagePage(this.returnStageCategoryId, this.bossPageIndex ?? this.returnStagePageIndex);
      return bossBattle ? [bossBattle] : [];
    }

    const start = this.pageIndex * BATTLE_BOSSES_PER_PAGE;
    return bossBattles.slice(start, start + BATTLE_BOSSES_PER_PAGE);
  }

  private getMaxPageIndex(): number {
    if (this.battleMode === 'boss') {
      if (this.returnStageCategoryId && this.bossSourceStageIds.length > 0) {
        return 0;
      }

      return Math.max(0, Math.ceil(bossBattles.length / BATTLE_BOSSES_PER_PAGE) - 1);
    }

    return Math.max(0, Math.ceil(trainers.length / BATTLE_TRAINERS_PER_PAGE) - 1);
  }

  private getStreakTrainers(): TrainerDefinition[] {
    return getTrainersByDifficulty();
  }
}
