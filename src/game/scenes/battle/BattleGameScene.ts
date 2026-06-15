import * as Phaser from 'phaser';
import { BOSS_BATTLE_DISPLAY_NAME, getBossBattleAsTrainer, getBossBattleById, getBossBattleProblemRules } from '../../../data/bossBattles';
import { getMonsterById } from '../../../data/monsters';
import { SHOP_ITEM_IDS } from '../../../data/shopItems';
import { getTrainerById, getTrainerPartnerMonsterIds, getTrainersByDifficulty } from '../../../data/trainers';
import {
  addBattleBonusReward,
  addBattleReward,
  consumeShopItem,
  getBattleWinCount,
  loadSaveState,
  recordBestStreakWins,
} from '../../../state/save';
import {
  playBattleAttackSound,
  playBattleHitSound,
  playBattleLoseJingle,
  playBattleWinFanfare,
  playCorrectSound,
  playWrongAnswerSound,
} from '../../audio';
import { calculateBattleDamage, getOpponentMaxHp } from '../../battle/battleRules';
import { startBgm, type BgmTrack } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import {
  createProblemAvoiding,
  createProblemFromRuleSetAvoiding,
  formatProblem,
  formatProblemAnswer,
  getProblemAnswerDecimalPlaces,
  getProblemAnswerPairJudgement,
  isClockTimeProblem,
  isDecimalProblem,
  isProblemAnswerCorrect,
  usesClockMinuteConversionPairAnswer,
  usesOptionalSquareRootCoefficientInput,
  usesQuotientRemainderAnswer,
  usesSquareRootDecimalValueAnswer,
  usesSquareRootExpressionAnswer,
  usesSquareRootFractionAnswer,
  usesSquareRootPairAnswer,
  usesSquareRootRationalizeAnswer,
  usesSquareRootSimplifyAnswer,
  usesTwoPartAnswer,
} from '../../problem/mathProblems';
import { SceneKeys } from '../../sceneKeys';
import { getAnswerSpeedBonus } from '../../problem/speedBonus';
import { BattleMode, BattlePartySnapshot, BattleSceneData, BattleSelectSceneData, MathProblem, MonsterDefinition, ProblemRuleDefinition, StageId, TrainerDefinition } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawNumberKeypad, NumberKeypadLabel, resolveNumberKeyInput } from '../../ui/problem/numberKeypad';
import { showRankUpOverlayIfNeeded } from '../../ui/achievements/rankUpOverlay';
import { createTrainerIntroVisual } from '../../ui/creatures/trainerVisual';
import { getRewardBoxTextureKey, preloadBattleRewardAssets } from '../../assets/battleRewardAssets';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { preloadRankMedalAssets } from '../../assets/medalAssets';
import { preloadTrainerImageAsset } from '../../assets/trainerImageAssets';

const GENKI_BREAD_HP_BONUS = 15;
const OPPONENT_SOLVE_BAR_WIDTH = 188;
const OPPONENT_SOLVE_BASE_MS = 6200;
const OPPONENT_SOLVE_MIN_MS = 3600;
const OPPONENT_ATTACK_SCALE = 0.52;
const STREAK_CHECKPOINT_INTERVAL = 3;
const STREAK_CHECKPOINT_RECOVERY = 20;
const BATTLE_GAME_LAYOUT = APP_LAYOUT.battleGame;

interface PartyBattleState {
  monster: MonsterDefinition;
  hp: number;
  maxHp: number;
}

interface BattleRewardSummary {
  coins: number;
  candyAttribute?: string;
  candyAmount: number;
  winCount: number;
  streakWins: number;
  checkpoint?: StreakCheckpointReward;
}

interface StreakCheckpointReward {
  coins: number;
  candyAttribute?: string;
  candyAmount: number;
  recovery: number;
}

export class BattleGameScene extends Phaser.Scene {
  private trainer!: TrainerDefinition;
  private opponentMonster!: MonsterDefinition;
  private opponentPartyStates: PartyBattleState[] = [];
  private partyStates: PartyBattleState[] = [];
  private activeOpponentIndex = 0;
  private activeMonsterIndex = 0;
  private opponentHp = 1;
  private opponentMaxHp = 1;
  private streakCount = 0;
  private problem!: MathProblem;
  private answerInput = '';
  private problemStartedAt = 0;
  private isBusy = false;
  private battleActive = false;
  private isSwitchingMonster = false;
  private isSwitchingOpponent = false;
  private opponentSolveTween?: Phaser.Tweens.Tween;
  private opponentHpFill!: Phaser.GameObjects.Rectangle;
  private opponentHpText!: Phaser.GameObjects.Text;
  private opponentSolveFill!: Phaser.GameObjects.Rectangle;
  private opponentVisual!: Phaser.GameObjects.Image;
  private opponentNameText!: Phaser.GameObjects.Text;
  private opponentFrames: Phaser.GameObjects.Rectangle[] = [];
  private opponentRestMarks: Phaser.GameObjects.Text[] = [];
  private activeMonsterVisual?: Phaser.GameObjects.Image;
  private activeMonsterName!: Phaser.GameObjects.Text;
  private activeHpFill!: Phaser.GameObjects.Rectangle;
  private activeHpText!: Phaser.GameObjects.Text;
  private partyFrames: Phaser.GameObjects.Rectangle[] = [];
  private partyHpTexts: Phaser.GameObjects.Text[] = [];
  private streakText!: Phaser.GameObjects.Text;
  private problemText!: Phaser.GameObjects.Text;
  private answerText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private genkiBreadUsed = false;
  private battleReward?: BattleRewardSummary;
  private battleMode: BattleMode = 'single';
  private streakTrainerIds: string[] = [];
  private streakIndex = 0;
  private bossBattleId: string | null = null;
  private bossPageIndex: number | undefined;
  private bossSourceStageIds: StageId[] = [];
  private bossProblemRules: ProblemRuleDefinition[] = [];
  private returnStageCategoryId: string | null = null;
  private returnStagePageIndex = 0;
  private secondAnswerInput = '';
  private activeAnswerPart: 'first' | 'second' = 'first';

  constructor() {
    super(SceneKeys.BattleGame);
  }

  init(data?: BattleSceneData): void {
    this.battleMode = data?.battleMode === 'streak'
      ? 'streak'
      : data?.battleMode === 'boss'
        ? 'boss'
        : 'single';
    this.bossBattleId = this.battleMode === 'boss' ? data?.bossId ?? 'boss-addition' : null;
    this.bossPageIndex = this.battleMode === 'boss' ? data?.bossPageIndex : undefined;
    this.bossSourceStageIds = this.battleMode === 'boss' ? data?.bossSourceStageIds ?? [] : [];
    this.returnStageCategoryId = data?.returnStageCategoryId ?? null;
    this.returnStagePageIndex = Math.max(0, data?.returnStagePageIndex ?? this.bossPageIndex ?? 0);
    this.streakTrainerIds = data?.streakTrainerIds?.length
      ? data.streakTrainerIds
      : getTrainersByDifficulty().map((trainer) => trainer.id);
    const requestedIndex = data?.trainerId ? this.streakTrainerIds.indexOf(data.trainerId) : -1;
    this.streakIndex = Phaser.Math.Clamp(
      data?.streakIndex ?? (requestedIndex >= 0 ? requestedIndex : 0),
      0,
      Math.max(0, this.streakTrainerIds.length - 1),
    );
    const trainerId = this.battleMode === 'streak'
      ? this.streakTrainerIds[this.streakIndex] ?? data?.trainerId ?? 'trainer-haru'
      : this.battleMode === 'boss'
        ? this.bossBattleId ?? 'boss-addition'
      : data?.trainerId ?? 'trainer-haru';
    const bossBattle = this.battleMode === 'boss' ? getBossBattleById(trainerId) : null;
    this.trainer = bossBattle
      ? getBossBattleAsTrainer(trainerId, this.bossPageIndex)
      : getTrainerById(trainerId);
    this.bossProblemRules = bossBattle ? getBossBattleProblemRules(bossBattle, this.bossSourceStageIds) : [];
    this.opponentPartyStates = getTrainerPartnerMonsterIds(this.trainer)
      .slice(0, 3)
      .map((monsterId) => {
        const monster = getMonsterById(monsterId);
        const maxHp = getOpponentMaxHp(this.trainer, monster);
        return {
          monster,
          hp: maxHp,
          maxHp,
        };
      });
    this.activeOpponentIndex = 0;
    this.opponentMonster = this.getActiveOpponentState().monster;
    const snapshotByMonsterId = new Map((data?.partySnapshot ?? []).map((snapshot) => [snapshot.monsterId, snapshot]));
    const partyIds = data?.partySnapshot?.length
      ? data.partySnapshot.map((snapshot) => snapshot.monsterId)
      : data?.partyMonsterIds ?? [];
    const partyMonsters = partyIds.slice(0, 3).map((monsterId) => getMonsterById(monsterId));
    this.genkiBreadUsed = !data?.partySnapshot?.length && partyMonsters.length > 0 && consumeShopItem(SHOP_ITEM_IDS.genkiBread) !== null;
    const hpBonus = this.genkiBreadUsed ? GENKI_BREAD_HP_BONUS : 0;
    this.partyStates = partyMonsters.map((monster) => {
      const snapshot = snapshotByMonsterId.get(monster.id);
      if (snapshot) {
        const maxHp = Math.max(1, snapshot.maxHp);
        return {
          monster,
          hp: Phaser.Math.Clamp(snapshot.hp, 0, maxHp),
          maxHp,
        };
      }

      return {
        monster,
        hp: monster.hp + hpBonus,
        maxHp: monster.hp + hpBonus,
      };
    });
    const firstStandingIndex = this.partyStates.findIndex((state) => state.hp > 0);
    this.activeMonsterIndex = Math.max(0, firstStandingIndex);
    this.opponentMaxHp = this.getActiveOpponentState().maxHp;
    this.opponentHp = this.getActiveOpponentState().hp;
    this.battleReward = undefined;
    this.streakCount = 0;
    this.answerInput = '';
    this.secondAnswerInput = '';
    this.activeAnswerPart = 'first';
    this.problemStartedAt = 0;
    this.isBusy = false;
    this.battleActive = false;
    this.isSwitchingMonster = false;
    this.isSwitchingOpponent = false;
    this.opponentSolveTween = undefined;
    this.opponentFrames = [];
    this.opponentRestMarks = [];
    this.partyFrames = [];
    this.partyHpTexts = [];
  }

  preload(): void {
    if (this.battleMode !== 'boss') {
      preloadTrainerImageAsset(this, this.trainer.id);
    }
    preloadMonsterImageAssetsByIds(this, [
      ...this.opponentPartyStates.map((state) => state.monster.id),
      ...this.partyStates.map((state) => state.monster.id),
    ]);
    preloadBattleRewardAssets(this);
    preloadRankMedalAssets(this);
  }

  create(): void {
    if (this.partyStates.length === 0) {
      this.scene.start(SceneKeys.BattleSelect, this.getBattleSelectReturnData());
      return;
    }

    startBgm(this.getBattleBgmTrack());
    this.cameras.main.setBackgroundColor('#fff4e8');
    this.drawBackground();
    this.drawHeader();
    this.drawOpponentPanel();
    this.drawPartyPanel();
    this.drawProblemArea();
    this.drawKeypad();
    this.showBattleIntro();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.endBattle());
  }

  private getBattleBgmTrack(): BgmTrack {
    if (this.battleMode !== 'boss') {
      return 'battle';
    }

    return 'boss';
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff4e8').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffe2c4').color, 1);
    graphics.fillCircle(62, 118, 104);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff8d6').color, 1);
    graphics.fillCircle(328, 730, 134);
  }

  private drawHeader(): void {
    createSmallButton(this, 42, 42, '←', () => {
      this.scene.start(SceneKeys.BattleSelect, this.getBattleSelectReturnData());
    });
    createSmallButton(this, 348, 42, '≡', () => showGameMenu(this));
    this.add
      .text(GAME_WIDTH / 2, 42, this.getHeaderTitle(), {
        fontFamily: FONT_FAMILY,
        fontSize: this.battleMode === 'streak' ? '17px' : '20px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  /** 対戦画面から戻るとき、今のモードに合う選択画面データを返します。 */
  private getBattleSelectReturnData(): BattleSelectSceneData {
    if (this.battleMode === 'streak') {
      return { battleMode: 'streak' };
    }

    if (this.battleMode === 'boss') {
      return {
        battleMode: 'boss',
        bossId: this.bossBattleId ?? this.trainer.id,
        bossPageIndex: this.bossPageIndex,
        bossSourceStageIds: this.bossSourceStageIds.length > 0 ? this.bossSourceStageIds : undefined,
        returnStageCategoryId: this.returnStageCategoryId ?? undefined,
        returnStagePageIndex: this.returnStagePageIndex,
      };
    }

    return { trainerId: this.trainer.id };
  }

  /** 結果画面から一覧へ戻るとき、選択済み相手を外したデータを返します。 */
  private getBattleListReturnData(): BattleSelectSceneData {
    if (this.battleMode === 'boss') {
      return {
        battleMode: 'boss',
        bossPageIndex: this.bossPageIndex,
        bossSourceStageIds: this.bossSourceStageIds.length > 0 ? this.bossSourceStageIds : undefined,
        returnStageCategoryId: this.returnStageCategoryId ?? undefined,
        returnStagePageIndex: this.returnStagePageIndex,
      };
    }

    if (this.battleMode === 'streak') {
      return { battleMode: 'streak' };
    }

    return {};
  }

  /** モードに合わせて、一覧へ戻るボタンの文言を返します。 */
  private getSelectButtonLabel(): string {
    return this.battleMode === 'boss' ? 'ステージへ' : 'あいてをえらぶ';
  }

  /** 相手はトレーナー本人ではなく、トレーナーの相棒モンスターとして表示します。 */
  private drawOpponentPanel(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(this.opponentMonster.palette.background).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(this.trainer.accentColor).color, 1);
    graphics.fillRoundedRect(28, 78, 334, 188, 20);
    graphics.strokeRoundedRect(28, 78, 334, 188, 20);

    this.opponentNameText = this.add
      .text(282, 116, `あいて\n${this.opponentMonster.name}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);
    this.drawOpponentPartyIcons();

    this.add
      .rectangle(GAME_WIDTH / 2, 232, 252, 14, Phaser.Display.Color.HexStringToColor('#e5d5c8').color, 1)
      .setOrigin(0.5);
    this.opponentHpFill = this.add
      .rectangle(69, 232, 252, 14, Phaser.Display.Color.HexStringToColor(COLORS.red).color, 1)
      .setOrigin(0, 0.5);
    this.opponentHpText = this.add
      .text(GAME_WIDTH / 2, 212, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    this.add
      .rectangle(GAME_WIDTH / 2, 258, OPPONENT_SOLVE_BAR_WIDTH, 6, Phaser.Display.Color.HexStringToColor('#f0dfcd').color, 1)
      .setOrigin(0.5);
    this.opponentSolveFill = this.add
      .rectangle(
        (GAME_WIDTH - OPPONENT_SOLVE_BAR_WIDTH) / 2,
        258,
        1,
        6,
        Phaser.Display.Color.HexStringToColor(this.trainer.accentColor).color,
        1,
      )
      .setOrigin(0, 0.5);
    this.renderActiveOpponent();
  }

  private drawOpponentPartyIcons(): void {
    this.opponentPartyStates.forEach((state, index) => {
      const x = BATTLE_GAME_LAYOUT.opponentPartyIcon.startX + index * BATTLE_GAME_LAYOUT.opponentPartyIcon.gap;
      const frame = this.add
        .rectangle(x, BATTLE_GAME_LAYOUT.opponentPartyIcon.frameY, 34, 40, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.72)
        .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
      createMonsterVisual(
        this,
        state.monster,
        x,
        BATTLE_GAME_LAYOUT.opponentPartyIcon.visualY,
        BATTLE_GAME_LAYOUT.opponentPartyIcon.visualSize,
      );
      const restMark = this.add
        .text(x, BATTLE_GAME_LAYOUT.opponentPartyIcon.frameY, '×', {
          fontFamily: FONT_FAMILY,
          fontSize: '23px',
          fontStyle: '900',
          color: COLORS.red,
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.opponentFrames.push(frame);
      this.opponentRestMarks.push(restMark);
    });
  }

  private renderActiveOpponent(): void {
    const activeOpponent = this.getActiveOpponentState();
    this.opponentMonster = activeOpponent.monster;
    this.opponentHp = activeOpponent.hp;
    this.opponentMaxHp = activeOpponent.maxHp;
    this.opponentVisual?.destroy();
    this.opponentVisual = createMonsterVisual(
      this,
      activeOpponent.monster,
      BATTLE_GAME_LAYOUT.opponentVisual.x,
      BATTLE_GAME_LAYOUT.opponentVisual.y,
      BATTLE_GAME_LAYOUT.opponentVisual.size,
    );
    this.opponentNameText.setText(`あいて\n${activeOpponent.monster.name}`);
    this.updateOpponentHp();
    this.updateOpponentPartyStatus();
    this.opponentSolveFill.width = 1;
  }

  private drawPartyPanel(): void {
    this.add
      .text(52, 294, 'こちらのモンスター', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    this.partyStates.forEach((state, index) => {
      const x = BATTLE_GAME_LAYOUT.partyIcon.startX + index * BATTLE_GAME_LAYOUT.partyIcon.gap;
      const frame = this.add
        .rectangle(x, BATTLE_GAME_LAYOUT.partyIcon.frameY, 50, 62, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.78)
        .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
      createMonsterVisual(
        this,
        state.monster,
        x,
        BATTLE_GAME_LAYOUT.partyIcon.visualY,
        BATTLE_GAME_LAYOUT.partyIcon.visualSize,
      );
      const hpText = this.add
        .text(x, 374, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5);
      this.add
        .zone(x, BATTLE_GAME_LAYOUT.partyIcon.frameY, 50, 62)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.switchActiveMonster(index));
      this.partyFrames.push(frame);
      this.partyHpTexts.push(hpText);
    });

    this.streakText = this.add
      .text(112, 414, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
    this.activeMonsterName = this.add
      .text(314, 382, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5);
    this.add
      .rectangle(314, 428, 86, 10, Phaser.Display.Color.HexStringToColor('#e5d5c8').color, 1)
      .setOrigin(0.5);
    this.activeHpFill = this.add
      .rectangle(271, 428, 86, 10, Phaser.Display.Color.HexStringToColor(COLORS.grass).color, 1)
      .setOrigin(0, 0.5);
    this.activeHpText = this.add
      .text(314, 444, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.renderActiveMonster();
    this.updateStreakText();
  }

  private renderActiveMonster(): void {
    const activeState = this.getActiveState();
    this.activeMonsterVisual?.destroy();
    this.activeMonsterVisual = createMonsterVisual(
      this,
      activeState.monster,
      BATTLE_GAME_LAYOUT.activeMonster.x,
      BATTLE_GAME_LAYOUT.activeMonster.y,
      BATTLE_GAME_LAYOUT.activeMonster.size,
    );
    this.activeMonsterName.setText(`いま\n${activeState.monster.name}\nわざ ${activeState.monster.attack}`);
    this.updateActiveHp();
    this.updatePartyStatus();
  }

  private drawProblemArea(): void {
    this.problemText = this.add
      .text(GAME_WIDTH / 2, 488, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: 350, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.answerText = this.add
      .text(GAME_WIDTH / 2, 538, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.feedbackText = this.add
      .text(GAME_WIDTH / 2, 574, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.grassDark,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: 330, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private drawKeypad(): void {
    drawNumberKeypad(this, {
      startX: 82,
      startY: 628,
      colGap: 112,
      rowGap: 54,
      keyWidth: 88,
      keyHeight: 46,
      digitFontSize: 24,
      actionFontSize: 16,
      allowDecimalPoint: true,
      onKey: (label) => this.handleKey(label),
    });
  }

  /** 画面に入った瞬間に攻撃が始まらないよう、短い開始演出を挟みます。 */
  private showBattleIntro(): void {
    this.isBusy = true;
    this.problemText.setText('');
    this.answerText.setText('');
    this.feedbackText.setText('');
    this.opponentSolveFill.width = 1;

    const trainerLayer = this.add.container(0, 0).setDepth(35);
    const overlay = this.add.container(0, 0).setDepth(36);
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Phaser.Display.Color.HexStringToColor('#fff4e8').color, 0.48)
      .setOrigin(0);
    const inputBlocker = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(5, Phaser.Display.Color.HexStringToColor(this.trainer.accentColor).color, 1);
    panel.fillRoundedRect(46, 300, 298, 174, 24);
    panel.strokeRoundedRect(46, 300, 298, 174, 24);
    const title = this.add
      .text(GAME_WIDTH / 2, 354, `${this.trainer.name}と\nしょうぶ！`, {
        fontFamily: FONT_FAMILY,
        fontSize: '27px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    const countText = this.add
      .text(GAME_WIDTH / 2, 430, '3', {
        fontFamily: FONT_FAMILY,
        fontSize: '50px',
        fontStyle: '900',
        color: this.trainer.accentColor,
      })
      .setAlpha(0)
      .setOrigin(0.5);
    const trainerVisual = this.createBattleIntroVisual().setAlpha(0.94);

    trainerLayer.add(trainerVisual);
    overlay.add([dim, inputBlocker, panel, title, countText]);
    this.tweens.add({
      targets: trainerVisual,
      x: this.getBattleIntroVisualEndX(),
      duration: 520,
      ease: 'Back.easeOut',
      onComplete: () => this.startBattleCountdown(overlay, trainerLayer, countText),
    });
  }

  /** 開始演出に出す見た目を、通常戦はトレーナー、ボス戦はボスモンスターで作ります。 */
  private createBattleIntroVisual(): Phaser.GameObjects.Image {
    if (this.battleMode === 'boss') {
      return createMonsterVisual(
        this,
        this.opponentMonster,
        BATTLE_GAME_LAYOUT.trainerIntro.startX,
        BATTLE_GAME_LAYOUT.trainerIntro.y,
        152,
      );
    }

    return createTrainerIntroVisual(
      this,
      this.trainer,
      BATTLE_GAME_LAYOUT.trainerIntro.startX,
      BATTLE_GAME_LAYOUT.trainerIntro.y,
      BATTLE_GAME_LAYOUT.trainerIntro.size,
    );
  }

  /** 開始演出の到着位置を、ボスモンスターとトレーナーの見た目に合わせて返します。 */
  private getBattleIntroVisualEndX(): number {
    return this.battleMode === 'boss' ? GAME_WIDTH / 2 : BATTLE_GAME_LAYOUT.trainerIntro.endX;
  }

  private startBattleCountdown(
    overlay: Phaser.GameObjects.Container,
    trainerLayer: Phaser.GameObjects.Container,
    countText: Phaser.GameObjects.Text,
  ): void {
    countText.setAlpha(1);
    ['3', '2', '1', 'GO!'].forEach((label, index) => {
      this.time.delayedCall(470 * index, () => {
        countText.setText(label);
        countText.setScale(label === 'GO!' ? 1 : 0.88);
        this.tweens.add({
          targets: countText,
          scale: label === 'GO!' ? 1.16 : 1,
          duration: 170,
          ease: 'Back.easeOut',
        });
      });
    });

    this.time.delayedCall(470 * 4, () => {
      this.tweens.add({
        targets: [overlay, trainerLayer],
        alpha: 0,
        duration: 260,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          overlay.destroy(true);
          trainerLayer.destroy(true);
          this.beginBattle();
        },
      });
    });
  }

  private beginBattle(): void {
    this.showNextProblem();
    this.startBattleClock();
    if (this.genkiBreadUsed) {
      this.feedbackText.setColor(COLORS.grassDark);
      this.feedbackText.setText('げんきパンで\nげんき+15');
    }
  }

  private handleKey(label: NumberKeypadLabel): void {
    if (this.isBusy) {
      return;
    }

    if (usesTwoPartAnswer(this.problem)) {
      this.handleTwoPartAnswerKey(label);
      return;
    }

    const answerDecimalPlaces = this.getAnswerDecimalPlaces();
    const result = resolveNumberKeyInput(label, this.answerInput, this.getAnswerInputMaxDigits(), {
      allowDecimalPoint: answerDecimalPlaces > 0,
      decimalPlaces: answerDecimalPlaces,
    });
    if (result.type === 'submit') {
      this.submitAnswer();
      return;
    }

    if (result.type === 'input') {
      this.answerInput = result.value;
      this.updateAnswerText();
      return;
    }
  }

  /** 二枠回答では、決定キーで前半から後半へ移り、両方そろったら採点します。 */
  private handleTwoPartAnswerKey(label: NumberKeypadLabel): void {
    if (label === 'けす' && this.activeAnswerPart === 'second' && this.secondAnswerInput.length === 0) {
      this.activeAnswerPart = 'first';
      this.updateAnswerText();
      return;
    }

    const currentInput = this.activeAnswerPart === 'first' ? this.answerInput : this.secondAnswerInput;
    const result = resolveNumberKeyInput(label, currentInput, 5);
    if (result.type === 'submit') {
      this.submitAnswer();
      return;
    }
    if (result.type !== 'input') {
      return;
    }

    if (this.activeAnswerPart === 'first') {
      this.answerInput = result.value;
    } else {
      this.secondAnswerInput = result.value;
    }
    this.updateAnswerText();
  }

  /** 入力できる答えのけた数を、問題の答え形式に合わせて返します。 */
  private getAnswerInputMaxDigits(): number {
    const answerDecimalPlaces = this.getAnswerDecimalPlaces();
    if (answerDecimalPlaces > 0) {
      return 5 + answerDecimalPlaces;
    }

    if (isClockTimeProblem(this.problem) && this.problem.answerSlot === 'result' && this.problem.right !== 0) {
      return 4;
    }

    return Math.max(2, Math.min(5, String(Math.max(0, this.problem.answer)).length));
  }

  /** 小数として答える問題なら、その答えで許す小数けた数を返します。 */
  private getAnswerDecimalPlaces(): number {
    return isDecimalProblem(this.problem) || usesSquareRootDecimalValueAnswer(this.problem)
      ? getProblemAnswerDecimalPlaces(this.problem)
      : 0;
  }

  private submitAnswer(): void {
    if (usesTwoPartAnswer(this.problem)) {
      this.submitTwoPartAnswer();
      return;
    }

    if (this.answerInput.length === 0) {
      return;
    }

    this.isBusy = true;
    if (isProblemAnswerCorrect(this.problem, Number(this.answerInput))) {
      this.handleCorrectAnswer();
      return;
    }

    this.streakCount = 0;
    this.updateStreakText();
    this.feedbackText.setColor(COLORS.red);
    this.feedbackText.setText(`こたえは ${formatProblemAnswer(this.problem)}`);
    playWrongAnswerSound();
    this.time.delayedCall(820, () => this.showNextProblem());
  }

  /** あまりや√などの二枠回答を採点し、不足していれば後半入力へ進めます。 */
  private submitTwoPartAnswer(): void {
    const allowsBlankFirst = usesOptionalSquareRootCoefficientInput(this.problem);
    if (this.answerInput.length === 0 && !allowsBlankFirst) {
      return;
    }
    if (this.secondAnswerInput.length === 0) {
      this.activeAnswerPart = 'second';
      this.updateAnswerText();
      return;
    }

    const firstAnswer = this.answerInput.length === 0 && allowsBlankFirst ? null : Number(this.answerInput);
    const secondAnswer = Number(this.secondAnswerInput);
    this.isBusy = true;
    const judgement = getProblemAnswerPairJudgement(this.problem, firstAnswer, secondAnswer);
    if (judgement === 'correct') {
      this.handleCorrectAnswer();
      return;
    }

    this.streakCount = 0;
    this.updateStreakText();
    this.feedbackText.setColor(judgement === 'partial' ? COLORS.fire : COLORS.red);
    this.feedbackText.setText(`${judgement === 'partial' ? '△ ' : ''}こたえは ${formatProblemAnswer(this.problem)}`);
    playWrongAnswerSound();
    this.time.delayedCall(820, () => this.showNextProblem());
  }

  private handleCorrectAnswer(): void {
    playCorrectSound();
    playBattleAttackSound();
    const activeState = this.getActiveState();
    const speedBonus = getAnswerSpeedBonus(this.time.now - this.problemStartedAt);
    const damageResult = calculateBattleDamage(activeState.monster, this.opponentMonster, speedBonus.multiplier);
    this.streakCount += 1;
    this.setActiveOpponentHp(Math.max(0, this.opponentHp - damageResult.amount));
    this.updateOpponentHp(true);
    this.updateStreakText();
    this.animatePlayerAttack();
    playBattleHitSound();
    this.showFloatingDamage('opponent', damageResult.amount);
    this.showShortBattleNote(damageResult.affinity.label, speedBonus.label);

    if (this.opponentHp <= 0) {
      this.handleOpponentMonsterResting();
      return;
    }

    this.time.delayedCall(430, () => this.showNextProblem());
  }

  private handleOpponentMonsterResting(): void {
    this.isSwitchingOpponent = true;
    this.isBusy = true;
    this.stopOpponentSolving();
    this.updateOpponentPartyStatus();

    if (!this.moveToNextStandingOpponent()) {
      this.endBattle();
      this.time.delayedCall(760, () => this.showWinOverlay());
      return;
    }

    this.feedbackText.setText('');
    this.tweens.add({
      targets: this.opponentVisual,
      alpha: 0,
      y: this.opponentVisual.y + 14,
      duration: 220,
      ease: 'Cubic.easeIn',
    });

    this.time.delayedCall(760, () => {
      this.renderActiveOpponent();
      this.opponentVisual.setAlpha(0);
      this.tweens.add({
        targets: this.opponentVisual,
        alpha: 1,
        y: 144,
        duration: 220,
        ease: 'Back.easeOut',
      });
      this.isSwitchingOpponent = false;
      this.showNextProblem();
      this.restartOpponentSolving();
    });
  }

  /** 相手の計算ゲージを動かし、満タンになったら相手の攻撃を出します。 */
  private startBattleClock(): void {
    this.battleActive = true;
    this.restartOpponentSolving();
  }

  private restartOpponentSolving(): void {
    if (!this.battleActive || this.isSwitchingMonster || this.isSwitchingOpponent || this.opponentHp <= 0) {
      return;
    }

    this.stopOpponentSolving();
    this.opponentSolveFill.width = 1;
    this.opponentSolveTween = this.tweens.add({
      targets: this.opponentSolveFill,
      width: OPPONENT_SOLVE_BAR_WIDTH,
      duration: this.getOpponentSolveDuration(),
      ease: 'Linear',
      onComplete: () => {
        this.opponentSolveTween = undefined;
        this.performOpponentAttack();
      },
    });
  }

  private stopOpponentSolving(): void {
    this.opponentSolveTween?.stop();
    this.opponentSolveTween = undefined;
  }

  private getOpponentSolveDuration(): number {
    return Phaser.Math.Clamp(OPPONENT_SOLVE_BASE_MS - this.opponentMonster.attack * 55, OPPONENT_SOLVE_MIN_MS, OPPONENT_SOLVE_BASE_MS);
  }

  /** 相手も計算に正解した、という扱いで一定間隔ごとに攻撃します。 */
  private performOpponentAttack(): void {
    if (!this.battleActive || this.isSwitchingMonster || this.isSwitchingOpponent || this.opponentHp <= 0) {
      return;
    }

    const activeState = this.getActiveState();
    if (activeState.hp <= 0) {
      this.handleActiveMonsterResting();
      return;
    }

    const damageResult = calculateBattleDamage(this.opponentMonster, activeState.monster, 1, OPPONENT_ATTACK_SCALE);
    activeState.hp = Math.max(0, activeState.hp - damageResult.amount);
    this.animateOpponentAttack();
    playBattleHitSound();
    this.showFloatingDamage('player', damageResult.amount);
    this.updateActiveHp(true);
    this.updatePartyStatus();

    if (activeState.hp > 0) {
      this.time.delayedCall(650, () => this.restartOpponentSolving());
      return;
    }

    this.handleActiveMonsterResting();
  }

  private handleActiveMonsterResting(): void {
    const activeState = this.getActiveState();
    this.isSwitchingMonster = true;
    this.isBusy = true;
    this.stopOpponentSolving();
    this.feedbackText.setColor(COLORS.muted);
    this.feedbackText.setText(`${activeState.monster.name}は ひとやすみ`);
    if (!this.moveToNextStandingMonster()) {
      this.endBattle();
      this.time.delayedCall(820, () => this.showLoseOverlay());
      return;
    }

    this.time.delayedCall(820, () => {
      this.renderActiveMonster();
      this.isSwitchingMonster = false;
      this.showNextProblem();
      this.restartOpponentSolving();
    });
  }

  private switchActiveMonster(nextIndex: number): void {
    const nextState = this.partyStates[nextIndex];
    if (
      !this.battleActive ||
      this.isBusy ||
      this.isSwitchingMonster ||
      this.isSwitchingOpponent ||
      nextIndex === this.activeMonsterIndex ||
      !nextState ||
      nextState.hp <= 0
    ) {
      return;
    }

    this.isSwitchingMonster = true;
    this.isBusy = true;
    this.stopOpponentSolving();
    this.activeMonsterIndex = nextIndex;
    this.answerInput = '';
    this.updateAnswerText();
    this.feedbackText.setColor(COLORS.muted);
    this.feedbackText.setText('こうたい');

    this.time.delayedCall(280, () => {
      this.renderActiveMonster();
      this.isSwitchingMonster = false;
      this.isBusy = false;
      this.problemStartedAt = this.time.now;
      this.restartOpponentSolving();
      this.time.delayedCall(360, () => {
        if (!this.isBusy && this.feedbackText.text === 'こうたい') {
          this.feedbackText.setText('');
        }
      });
    });
  }

  private showNextProblem(): void {
    if (this.isSwitchingMonster || this.isSwitchingOpponent || this.opponentHp <= 0 || this.partyStates.every((state) => state.hp <= 0)) {
      return;
    }

    this.problem = this.battleMode === 'boss'
      ? createProblemFromRuleSetAvoiding(this.bossProblemRules, this.problem)
      : createProblemAvoiding(this.trainer.problemRule, this.problem);
    this.answerInput = '';
    this.secondAnswerInput = '';
    this.activeAnswerPart = 'first';
    this.isBusy = false;
    const problemText = formatProblem(this.problem);
    const problemLineCount = problemText.split('\n').length;
    this.problemText.setFontSize(this.getProblemFontSize(this.problem));
    this.problemText.setY(problemLineCount >= 4 ? 472 : problemLineCount >= 2 ? 480 : 488);
    this.answerText.setY(problemLineCount >= 4 ? 584 : problemLineCount >= 2 ? 566 : 538);
    this.problemText.setText(problemText);
    this.feedbackText.setText('');
    this.updateAnswerText();
    this.problemStartedAt = this.time.now;
  }

  /** 問題文の長さに合わせて、画面内に収まる文字サイズを返します。 */
  private getProblemFontSize(problem: MathProblem): number {
    const problemText = formatProblem(problem);
    const lineCount = problemText.split('\n').length;
    if (lineCount >= 4) {
      return 27;
    }
    if (lineCount >= 2) {
      return 30;
    }
    if (problemText.length >= 25) {
      return 24;
    }
    if (problemText.length >= 18) {
      return 30;
    }

    return 38;
  }

  private updateAnswerText(): void {
    if (usesTwoPartAnswer(this.problem)) {
      this.answerText.setText(this.formatTwoPartAnswerInput());
      this.answerText.setColor(this.activeAnswerPart === 'first' ? COLORS.blue : COLORS.muted);
      return;
    }

    if (
      isClockTimeProblem(this.problem)
      && this.problem.answerSlot === 'result'
      && this.problem.right !== 0
      && this.answerInput.length >= 3
    ) {
      this.answerText.setColor(COLORS.muted);
      this.answerText.setText(`こたえ: ${this.formatClockAnswerInput(this.answerInput)}`);
      return;
    }

    this.answerText.setColor(COLORS.muted);
    this.answerText.setText(this.answerInput.length > 0 ? `こたえ: ${this.answerInput}` : 'こたえをいれよう');
  }

  /** 二枠回答の入力状態を、問題形式に合わせた短い文字列にします。 */
  private formatTwoPartAnswerInput(): string {
    const first = this.answerInput.length > 0 ? this.answerInput : '□';
    const second = this.secondAnswerInput.length > 0 ? this.secondAnswerInput : '□';
    const pointer = this.activeAnswerPart === 'first' ? '▶' : '▷';
    if (usesQuotientRemainderAnswer(this.problem)) {
      return `${pointer} ${first} あまり ${second}`;
    }
    if (usesClockMinuteConversionPairAnswer(this.problem)) {
      return `${pointer} ${first}時間 ${second}分`;
    }
    if (usesSquareRootPairAnswer(this.problem)) {
      return `${pointer} ${first} と -${second}`;
    }
    if (usesSquareRootFractionAnswer(this.problem)) {
      return `${pointer} 分子${first} 分母${second}`;
    }
    if (usesSquareRootRationalizeAnswer(this.problem)) {
      return `${pointer} ${first}√${this.problem.right}/${second}`;
    }
    if (usesSquareRootSimplifyAnswer(this.problem) || usesSquareRootExpressionAnswer(this.problem)) {
      return `${pointer} ${first}√${second}`;
    }

    return `${pointer} ${first} / ${second}`;
  }

  /** 時計の答え入力を、時刻として読める場合だけ「時」「分」つきに整えます。 */
  private formatClockAnswerInput(input: string): string {
    const value = Number(input);
    if (!Number.isInteger(value)) {
      return input;
    }

    const minute = value % 100;
    const hour = Math.floor(value / 100);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return input;
    }

    return `${hour}時${minute}分`;
  }

  private updateStreakText(): void {
    this.streakText.setText(`れんぞく ${this.streakCount}`);
  }

  private showShortBattleNote(affinityLabel: 'とくい' | 'にがて' | null, speedLabel: string | null): void {
    const notes = [affinityLabel ? `${affinityLabel}！` : null, speedLabel ? `はやい ${speedLabel}` : null].filter(Boolean);
    this.feedbackText.setColor(affinityLabel === 'にがて' ? COLORS.muted : COLORS.grassDark);
    this.feedbackText.setText(notes.join('  '));
  }

  private animatePlayerAttack(): void {
    this.tweens.add({
      targets: this.activeMonsterVisual,
      x: 286,
      y: 318,
      yoyo: true,
      duration: 100,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: this.opponentVisual,
      x: GAME_WIDTH / 2 + 8,
      yoyo: true,
      repeat: 1,
      duration: 55,
      ease: 'Sine.easeInOut',
    });
  }

  private animateOpponentAttack(): void {
    this.tweens.add({
      targets: this.opponentVisual,
      x: GAME_WIDTH / 2 + 12,
      y: 160,
      yoyo: true,
      duration: 100,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: this.activeMonsterVisual,
      x: 306,
      yoyo: true,
      repeat: 1,
      duration: 55,
      ease: 'Sine.easeInOut',
    });
  }

  private showFloatingDamage(target: 'opponent' | 'player', amount: number): void {
    const targetX = target === 'opponent' ? this.opponentVisual.x : (this.activeMonsterVisual?.x ?? 314);
    const targetY = target === 'opponent' ? this.opponentVisual.y : (this.activeMonsterVisual?.y ?? 336);
    const x = Phaser.Math.Clamp(targetX + Phaser.Math.Between(-42, 42), 62, GAME_WIDTH - 62);
    const y = Phaser.Math.Clamp(targetY + Phaser.Math.Between(-22, 28), 102, 444);
    const damageText = this.add
      .text(x, y, `-${amount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: target === 'opponent' ? '34px' : '27px',
        fontStyle: '900',
        color: target === 'opponent' ? '#ff2e2e' : COLORS.blue,
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAngle(Phaser.Math.Between(-9, 9));
    damageText.setStroke('#ffffff', 8);

    this.tweens.add({
      targets: damageText,
      scale: 1.16,
      duration: 100,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: damageText,
      y: y - 38,
      alpha: 0,
      scale: 1.24,
      duration: 760,
      delay: 160,
      ease: 'Cubic.easeOut',
      onComplete: () => damageText.destroy(),
    });
  }

  private updateOpponentHp(animated = false): void {
    const ratio = Phaser.Math.Clamp(this.opponentHp / this.opponentMaxHp, 0, 1);
    const nextWidth = 252 * ratio;
    this.opponentHpText.setText(`げんき ${this.opponentHp} / ${this.opponentMaxHp}`);

    if (!animated) {
      this.opponentHpFill.width = nextWidth;
      return;
    }

    this.tweens.add({
      targets: this.opponentHpFill,
      width: nextWidth,
      duration: 260,
      ease: 'Cubic.easeOut',
    });
  }

  private updateActiveHp(animated = false): void {
    const activeState = this.getActiveState();
    const ratio = Phaser.Math.Clamp(activeState.hp / activeState.maxHp, 0, 1);
    const nextWidth = 86 * ratio;
    this.activeHpText.setText(`げんき ${activeState.hp} / ${activeState.maxHp}`);

    if (!animated) {
      this.activeHpFill.width = nextWidth;
      return;
    }

    this.tweens.add({
      targets: this.activeHpFill,
      width: nextWidth,
      duration: 260,
      ease: 'Cubic.easeOut',
    });
  }

  private updatePartyStatus(): void {
    this.partyStates.forEach((state, index) => {
      const isActive = index === this.activeMonsterIndex;
      const isResting = state.hp <= 0;
      this.partyFrames[index]?.setStrokeStyle(
        isActive ? 3 : 2,
        Phaser.Display.Color.HexStringToColor(isResting ? COLORS.muted : isActive ? COLORS.yellow : COLORS.line).color,
        isResting ? 0.45 : 1,
      );
      this.partyHpTexts[index]?.setText(isResting ? 'ひとやすみ' : `${state.hp}/${state.maxHp}`);
      this.partyHpTexts[index]?.setColor(isResting ? COLORS.muted : COLORS.ink);
    });
  }

  private updateOpponentPartyStatus(): void {
    this.opponentPartyStates.forEach((state, index) => {
      const isActive = index === this.activeOpponentIndex;
      const isResting = state.hp <= 0;
      this.opponentFrames[index]?.setStrokeStyle(
        isActive ? 3 : 2,
        Phaser.Display.Color.HexStringToColor(isResting ? COLORS.muted : isActive ? COLORS.yellow : COLORS.line).color,
        isResting ? 0.45 : 1,
      );
      this.opponentRestMarks[index]?.setVisible(isResting);
    });
  }

  private moveToNextStandingMonster(): boolean {
    const nextIndex = this.partyStates.findIndex((state) => state.hp > 0);
    if (nextIndex < 0) {
      return false;
    }

    this.activeMonsterIndex = nextIndex;
    return true;
  }

  private moveToNextStandingOpponent(): boolean {
    const nextIndex = this.opponentPartyStates.findIndex((state) => state.hp > 0);
    if (nextIndex < 0) {
      return false;
    }

    this.activeOpponentIndex = nextIndex;
    return true;
  }

  private showWinOverlay(): void {
    this.endBattle();
    playBattleWinFanfare();
    const reward = this.grantBattleReward();
    const hasNextStreakBattle = this.hasNextStreakBattle();
    const isBossWin = this.battleMode === 'boss';
    const overlay = this.add.container(0, 0).setDepth(40);
    const dim = this.add.rectangle(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
      Phaser.Display.Color.HexStringToColor('#fff1a8').color,
      0.94,
    ).setOrigin(0);
    const inputBlocker = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();
    const message = this.add
      .text(GAME_WIDTH / 2, isBossWin ? 154 : 260, this.getWinTitle(), {
        fontFamily: FONT_FAMILY,
        fontSize: isBossWin ? '32px' : '36px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    overlay.add([dim, inputBlocker, message]);
    if (isBossWin) {
      this.showBossWinCelebration(overlay);
    }
    this.add
      .text(GAME_WIDTH / 2, isBossWin ? 512 : 402, this.getRewardMessage(reward), {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 10,
        wordWrap: { width: 310, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(41);
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 588,
      width: 242,
      height: 58,
      label: hasNextStreakBattle ? this.getContinueButtonLabel(reward) : 'もういちど',
      fillColor: this.trainer.accentColor,
      fontSize: 21,
      onClick: () => {
        if (hasNextStreakBattle) {
          this.scene.start(SceneKeys.BattleGame, this.getNextStreakBattleData());
          return;
        }

        this.scene.restart(this.getRestartBattleData());
      },
    }).setDepth(41);
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 664,
      width: 242,
      height: 58,
      label: hasNextStreakBattle ? 'ここでおわる' : this.getSelectButtonLabel(),
      fillColor: COLORS.panel,
      fontSize: 21,
      onClick: () => this.returnToBattleList(),
    }).setDepth(41);
    showRankUpOverlayIfNeeded(this, loadSaveState());
  }

  /** ボス勝利時に、ごほうび箱と味方モンスターのお祝い演出を表示します。 */
  private showBossWinCelebration(overlay: Phaser.GameObjects.Container): void {
    this.showRewardBoxOpeningAnimation(overlay, GAME_WIDTH / 2, 336);
    this.showPartyJumpCelebration(overlay);
  }

  /** ごほうび箱を閉じた画像から開いた画像へ、白い発光をはさんで切り替えます。 */
  private showRewardBoxOpeningAnimation(
    overlay: Phaser.GameObjects.Container,
    x: number,
    y: number,
  ): void {
    const boxScale = 0.245;
    const closedBox = this.add.image(x, y, getRewardBoxTextureKey('closed')).setScale(boxScale);
    const closedWhiteBox = this.add
      .image(x, y, getRewardBoxTextureKey('closedWhite'))
      .setScale(boxScale * 1.04)
      .setAlpha(0);
    const openWhiteBox = this.add
      .image(x, y, getRewardBoxTextureKey('openWhite'))
      .setScale(boxScale * 1.04)
      .setAlpha(0);
    const openBox = this.add
      .image(x, y, getRewardBoxTextureKey('open'))
      .setScale(boxScale)
      .setAlpha(0);

    overlay.add([closedBox, closedWhiteBox, openWhiteBox, openBox]);

    this.tweens.add({
      targets: closedBox,
      x: { from: x - 8, to: x + 8 },
      angle: { from: -2.4, to: 2.4 },
      duration: 48,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        closedBox.setPosition(x, y).setAngle(0);
        this.tweens.add({
          targets: closedWhiteBox,
          alpha: 1,
          duration: 130,
          ease: 'Sine.easeOut',
          onComplete: () => {
            closedBox.setVisible(false);
            closedWhiteBox.setVisible(false);
            openWhiteBox.setAlpha(1);
            this.tweens.add({
              targets: openBox,
              alpha: 1,
              duration: 480,
              ease: 'Cubic.easeOut',
            });
            this.tweens.add({
              targets: openWhiteBox,
              alpha: 0,
              scale: boxScale,
              duration: 480,
              ease: 'Sine.easeIn',
            });
          },
        });
      },
    });
  }

  /** 勝った味方モンスターを小さく並べ、順番に跳ねるお祝い動作を付けます。 */
  private showPartyJumpCelebration(overlay: Phaser.GameObjects.Container): void {
    const winners = (this.partyStates.some((state) => state.hp > 0)
      ? this.partyStates.filter((state) => state.hp > 0)
      : this.partyStates).slice(0, 3);
    const gap = 76;
    const startX = GAME_WIDTH / 2 - ((winners.length - 1) * gap) / 2;

    winners.forEach((state, index) => {
      const x = startX + index * gap;
      const baseY = 452;
      const visual = createMonsterVisual(this, state.monster, x, baseY, 42)
        .setAlpha(0)
        .setScale(0.92);

      overlay.add(visual);
      this.tweens.add({
        targets: visual,
        alpha: 1,
        y: baseY - 8,
        duration: 170,
        delay: index * 80,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: visual,
        y: baseY - 24,
        duration: 260,
        delay: 230 + index * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private showLoseOverlay(): void {
    this.endBattle();
    playBattleLoseJingle();
    const overlay = this.add.container(0, 0).setDepth(40);
    const dim = this.add.rectangle(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
      Phaser.Display.Color.HexStringToColor('#eaf7ff').color,
      0.94,
    ).setOrigin(0);
    const inputBlocker = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();
    const message = this.add
      .text(GAME_WIDTH / 2, 286, this.getLoseTitle(), {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    overlay.add([dim, inputBlocker, message]);
    this.add
      .text(GAME_WIDTH / 2, 394, this.getLoseHint(), {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(41);
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 548,
      width: 242,
      height: 58,
      label: this.battleMode === 'streak' ? 'さいしょから' : 'もういちど',
      fillColor: this.trainer.accentColor,
      fontSize: 21,
      onClick: () => this.scene.restart(this.getRestartBattleData()),
    }).setDepth(41);
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 624,
      width: 242,
      height: 58,
      label: this.getSelectButtonLabel(),
      fillColor: COLORS.panel,
      fontSize: 21,
      onClick: () => this.returnToBattleList(),
    }).setDepth(41);
  }

  private getActiveState(): PartyBattleState {
    return this.partyStates[this.activeMonsterIndex] ?? this.partyStates[0];
  }

  private getActiveOpponentState(): PartyBattleState {
    return this.opponentPartyStates[this.activeOpponentIndex] ?? this.opponentPartyStates[0];
  }

  private setActiveOpponentHp(nextHp: number): void {
    const activeOpponent = this.getActiveOpponentState();
    activeOpponent.hp = nextHp;
    this.opponentHp = nextHp;
  }

  private grantBattleReward(): BattleRewardSummary {
    if (this.battleReward) {
      return this.battleReward;
    }

    const candyAmount = this.trainer.rewardCandyAmount ?? 0;
    let nextSave = addBattleReward(
      this.trainer.id,
      this.trainer.rewardCoins,
      this.trainer.rewardCandyAttribute,
      candyAmount,
    );
    const checkpoint = this.getStreakCheckpointReward();
    if (checkpoint) {
      nextSave = addBattleBonusReward(checkpoint.coins, checkpoint.candyAttribute, checkpoint.candyAmount);
      this.recoverParty(checkpoint.recovery);
    }
    if (this.battleMode === 'streak') {
      nextSave = recordBestStreakWins(this.getStreakWinsAfterThisBattle());
    }

    this.battleReward = {
      coins: this.trainer.rewardCoins,
      candyAttribute: this.trainer.rewardCandyAttribute,
      candyAmount,
      winCount: getBattleWinCount(nextSave, this.trainer.id),
      streakWins: this.getStreakWinsAfterThisBattle(),
      checkpoint,
    };
    return this.battleReward;
  }

  private getRewardMessage(reward: BattleRewardSummary): string {
    const lines = [`コイン ${reward.coins}こ ゲット！`];
    if (reward.candyAttribute && reward.candyAmount > 0) {
      lines.push(`${reward.candyAttribute}アメ ${reward.candyAmount}こ ゲット！`);
    }

    if (!reward.checkpoint) {
      return lines.join('\n');
    }

    lines.push('たからばこ ゲット！');
    lines.push(`コイン ${reward.checkpoint.coins}こ ゲット！`);
    if (reward.checkpoint.candyAttribute && reward.checkpoint.candyAmount > 0) {
      lines.push(`${reward.checkpoint.candyAttribute}アメ ${reward.checkpoint.candyAmount}こ ゲット！`);
    }
    lines.push(`みんな げんき ${reward.checkpoint.recovery}かいふく！`);

    return lines.join('\n');
  }

  /** 結果画面から、ボス戦は元ステージへ、それ以外は対戦一覧へ戻します。 */
  private returnToBattleList(): void {
    if (this.battleMode === 'boss' && this.returnStageCategoryId) {
      this.scene.start(SceneKeys.StageSelect, {
        categoryId: this.returnStageCategoryId,
        pageIndex: this.returnStagePageIndex,
      });
      return;
    }

    this.scene.start(SceneKeys.BattleSelect, this.getBattleListReturnData());
  }

  private getStreakCheckpointReward(): StreakCheckpointReward | undefined {
    if (this.battleMode !== 'streak') {
      return undefined;
    }

    const streakWins = this.getStreakWinsAfterThisBattle();
    const isCheckpoint = streakWins % STREAK_CHECKPOINT_INTERVAL === 0 || streakWins === this.streakTrainerIds.length;
    if (!isCheckpoint) {
      return undefined;
    }

    const checkpointRank = Math.ceil(streakWins / STREAK_CHECKPOINT_INTERVAL);
    const coinRewards = [0, 40, 90, 150];
    return {
      coins: coinRewards[checkpointRank] ?? checkpointRank * 60,
      candyAttribute: this.trainer.rewardCandyAttribute,
      candyAmount: checkpointRank,
      recovery: STREAK_CHECKPOINT_RECOVERY + Math.max(0, checkpointRank - 1) * 5,
    };
  }

  /** 連続対戦の宝箱では全員を少し回復し、次戦へ粘れる余地を作ります。 */
  private recoverParty(amount: number): void {
    if (amount <= 0) {
      return;
    }

    this.partyStates.forEach((state) => {
      state.hp = Math.min(state.maxHp, state.hp + amount);
    });
    this.moveToNextStandingMonster();
    this.updateActiveHp();
    this.updatePartyStatus();
  }

  private getStreakWinsAfterThisBattle(): number {
    return this.battleMode === 'streak' ? this.streakIndex + 1 : 0;
  }

  private getContinueButtonLabel(reward: BattleRewardSummary): string {
    return reward.checkpoint ? 'つぎへすすむ' : 'つぎのあいてへ';
  }

  private getLoseHint(): string {
    if (this.battleMode !== 'streak') {
      return 'また ちょうせんしよう';
    }

    const wonCount = this.streakIndex;
    if (wonCount <= 0) {
      return 'まずは 1にんめを\nめざそう';
    }

    return `もらった ごほうびは\nそのままだよ`;
  }

  private getHeaderTitle(): string {
    if (this.battleMode === 'boss') {
      return BOSS_BATTLE_DISPLAY_NAME;
    }

    if (this.battleMode !== 'streak') {
      return 'モンスターしょうぶ';
    }

    return `れんぞく ${this.streakIndex + 1}/${this.streakTrainerIds.length}  レベル${this.trainer.difficultyLevel}`;
  }

  private getWinTitle(): string {
    if (this.battleMode === 'streak' && !this.hasNextStreakBattle()) {
      return 'ぜんいんに\nかった！';
    }

    return `${this.trainer.name}に\nかった！`;
  }

  private getLoseTitle(): string {
    if (this.battleMode !== 'streak') {
      return 'しょうぶは\nここまで！';
    }

    return `ここまで！\n${this.streakIndex}にんしょうり`;
  }

  private hasNextStreakBattle(): boolean {
    return this.battleMode === 'streak' && this.streakIndex + 1 < this.streakTrainerIds.length;
  }

  private getNextStreakBattleData(): BattleSceneData {
    const nextIndex = this.streakIndex + 1;
    const nextTrainerId = this.streakTrainerIds[nextIndex] ?? this.trainer.id;
    return {
      trainerId: nextTrainerId,
      partyMonsterIds: this.getPartyMonsterIds(),
      battleMode: 'streak',
      streakTrainerIds: this.streakTrainerIds,
      streakIndex: nextIndex,
      partySnapshot: this.getPartySnapshot(),
    };
  }

  private getRestartBattleData(): BattleSceneData {
    if (this.battleMode === 'boss') {
      return {
        bossId: this.bossBattleId ?? this.trainer.id,
        bossPageIndex: this.bossPageIndex,
        bossSourceStageIds: this.bossSourceStageIds.length > 0 ? this.bossSourceStageIds : undefined,
        partyMonsterIds: this.getPartyMonsterIds(),
        battleMode: 'boss',
        returnStageCategoryId: this.returnStageCategoryId ?? undefined,
        returnStagePageIndex: this.returnStagePageIndex,
      };
    }

    if (this.battleMode === 'streak') {
      const firstTrainerId = this.streakTrainerIds[0] ?? this.trainer.id;
      return {
        trainerId: firstTrainerId,
        partyMonsterIds: this.getPartyMonsterIds(),
        battleMode: 'streak',
        streakTrainerIds: this.streakTrainerIds,
        streakIndex: 0,
      };
    }

    return {
      trainerId: this.trainer.id,
      partyMonsterIds: this.getPartyMonsterIds(),
    };
  }

  private getPartyMonsterIds(): string[] {
    return this.partyStates.map((state) => state.monster.id);
  }

  private getPartySnapshot(): BattlePartySnapshot[] {
    return this.partyStates.map((state) => ({
      monsterId: state.monster.id,
      hp: state.hp,
      maxHp: state.maxHp,
    }));
  }

  /** 勝敗決定や画面遷移時に、相手の自動計算ループを確実に止めます。 */
  private endBattle(): void {
    this.battleActive = false;
    this.isBusy = true;
    this.stopOpponentSolving();
  }
}
