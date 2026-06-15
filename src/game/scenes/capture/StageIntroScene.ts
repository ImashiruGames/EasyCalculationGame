import * as Phaser from 'phaser';
import { getEvolutionLabel, getMonsterById, getMonstersByIds, pickEncounterMonsterId } from '../../../data/monsters';
import { SHOP_ITEM_IDS } from '../../../data/shopItems';
import { getEmbeddedStoryDraftForStageIntro } from '../../../data/stories';
import { getStageById } from '../../../data/stages';
import {
  consumeShopItem,
  getItemCount,
  getMonsterCaptureCount,
  getStagePlayLimitStatus,
  loadSaveState,
  recordEncounterMonster,
  recordStagePlayEntry,
} from '../../../state/save';
import type { StoryCreatorDraft } from '../../../state/storyCreator';
import { getStageAvailability } from '../../../state/progression';
import { COLORS, FONT_FAMILY } from '../../constants';
import { APP_LAYOUT, STAGE_INTRO_MONSTER_CANDIDATE_POSITIONS } from '../../layoutConfig';
import { SceneKeys } from '../../sceneKeys';
import { MonsterDefinition, StageDefinition, StageId, StageSceneData } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawRareSecretRoundedFrame } from '../../ui/creatures/rareSecretFrame';
import { startStageBgm } from '../../bgm';
import { drawStageBackdrop, drawStageIntroReadabilityPanels } from '../../ui/stage/stageBackdrop';
import { drawStagePlayLimitGauge, scheduleStagePlayLimitRefresh } from '../../ui/stage/stagePlayLimitGauge';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { preloadStageBackgroundAsset } from '../../assets/stageBackgroundAssets';

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

export class StageIntroScene extends Phaser.Scene {
  private stageId: StageId = 'g1-tashizan-hazimarinosougen';
  private skipIntroStory = false;
  private contentLayer?: Phaser.GameObjects.Container;

  /** Phaserにステージ開始画面のSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.StageIntro);
  }

  /** 前の画面から渡されたステージIDを保持し、未指定なら最初のステージにします。 */
  init(data?: StageSceneData): void {
    this.stageId = data?.stageId ?? 'g1-tashizan-hazimarinosougen';
    this.skipIntroStory = data?.skipIntroStory ?? false;
  }

  /** 背景と出現モンスター画像を、画面を作る前に読み込みます。 */
  preload(): void {
    const stage = getStageById(this.stageId);
    preloadStageBackgroundAsset(this, stage.id);
    preloadMonsterImageAssetsByIds(
      this,
      getMonstersByIds(stage.monsterIds).map((monster) => monster.id),
    );
  }

  /** ステージに入れるか確認してから、背景、見出し、出現候補、開始ボタンを描きます。 */
  create(): void {
    const stage = getStageById(this.stageId);
    const saveState = loadSaveState();
    if (getStageAvailability(stage, saveState) !== 'available') {
      this.scene.start(SceneKeys.StageSelect, { stageId: stage.id });
      return;
    }

    const introStoryDraft = this.skipIntroStory ? undefined : this.getStageIntroStoryDraft(stage);
    if (introStoryDraft) {
      this.openStageIntroStory(introStoryDraft, stage);
      return;
    }

    startStageBgm(stage.id);
    this.cameras.main.setBackgroundColor('#fffdf2');
    if (drawStageBackdrop(this, this.stageId)) {
      drawStageIntroReadabilityPanels(this);
    }
    this.redrawStageIntroView(stage);
  }

  /** ステージ開始画面の操作部分だけを、Sceneを再起動せず描き直します。 */
  private redrawStageIntroView(stage: StageDefinition): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const saveState = loadSaveState();
      this.drawHeader(stage);
      this.drawMonsterCandidates(stage, saveState);
      this.drawItemHint(stage, saveState);
      const playLimitStatus = getStagePlayLimitStatus(saveState, stage.id);
      if (!stage.playLimitDisabled) {
        drawStagePlayLimitGauge(
          this,
          APP_LAYOUT.stageIntro.playLimitGauge.x,
          APP_LAYOUT.stageIntro.playLimitGauge.y,
          () => getStagePlayLimitStatus(loadSaveState(), stage.id),
          {
            fillColor: stage.accentColor,
            squareSize: APP_LAYOUT.stageIntro.playLimitGauge.squareSize,
            gap: APP_LAYOUT.stageIntro.playLimitGauge.gap,
            fontSize: APP_LAYOUT.stageIntro.playLimitGauge.fontSize,
          },
        );
        if (playLimitStatus.isLimited) {
          scheduleStagePlayLimitRefresh(this, () => getStagePlayLimitStatus(loadSaveState(), stage.id), () => {
            this.redrawStageIntroView(stage);
          });
        }
      }

      createButton(this, {
        x: APP_LAYOUT.stageIntro.startButton.x,
        y: APP_LAYOUT.stageIntro.startButton.y,
        width: APP_LAYOUT.stageIntro.startButton.width,
        height: APP_LAYOUT.stageIntro.startButton.height,
        label: playLimitStatus.isLimited ? 'このステージは\n休けいちゅう' : 'つかまえにいくよ！',
        fillColor: stage.accentColor,
        fontSize: playLimitStatus.isLimited ? 23 : 27,
        disabled: playLimitStatus.isLimited,
        onClick: () => this.startCapture(stage),
      });
    });
  }

  /** ステージ開始前に流す埋め込みストーリーを返します。 */
  private getStageIntroStoryDraft(stage: StageDefinition): StoryCreatorDraft | undefined {
    return getEmbeddedStoryDraftForStageIntro(stage.id);
  }

  /** ステージ開始前のストーリーを一度だけ開き、戻った後は通常の開始画面を描けるようにします。 */
  private openStageIntroStory(draft: StoryCreatorDraft, stage: StageDefinition): void {
    this.scene.start(SceneKeys.StoryPreview, {
      draft,
      returnScene: 'stageIntro',
      returnStageIntroData: {
        stageId: stage.id,
        skipIntroStory: true,
      },
    });
  }

  /** レアベルを持っていて対象がいるときだけ、次にレアが出ることを小さく知らせます。 */
  private drawItemHint(stage: StageDefinition, saveState: ReturnType<typeof loadSaveState>): void {
    const rareMonster = getMonstersByIds(stage.monsterIds).find((monster) => monster.isRare);
    const rareBellCount = getItemCount(saveState, SHOP_ITEM_IDS.rareBell);
    if (!rareMonster || rareBellCount <= 0) {
      return;
    }

    const hint = this.add.graphics();
    hint.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.88);
    hint.lineStyle(2, Phaser.Display.Color.HexStringToColor(stage.accentColor).color, 0.9);
    const hintPanel = APP_LAYOUT.stageIntro.rareBellHintPanel;
    hint.fillRoundedRect(hintPanel.x, hintPanel.y, hintPanel.width, hintPanel.height, hintPanel.radius);
    hint.strokeRoundedRect(hintPanel.x, hintPanel.y, hintPanel.width, hintPanel.height, hintPanel.radius);

    this.add
      .text(
        APP_LAYOUT.stageIntro.rareBellHintText.x,
        APP_LAYOUT.stageIntro.rareBellHintText.y,
        `レアベル ${rareBellCount}こ　つぎはレアがでるよ`,
        {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
          wordWrap: { width: APP_LAYOUT.stageIntro.rareBellHintText.wrapWidth, useAdvancedWrap: true },
        },
      )
      .setOrigin(0.5);
  }

  /** 戻るボタン、メニューボタン、ステージ名、問題の種類を上部にまとめます。 */
  private drawHeader(stage: StageDefinition): void {
    createSmallButton(
      this,
      APP_LAYOUT.stageIntro.backButton.x,
      APP_LAYOUT.stageIntro.backButton.y,
      '←',
      () => this.scene.start(SceneKeys.StageSelect, { stageId: stage.id }),
    );
    createSmallButton(
      this,
      APP_LAYOUT.stageIntro.menuButton.x,
      APP_LAYOUT.stageIntro.menuButton.y,
      '≡',
      () => showGameMenu(this),
    );

    this.add
      .text(APP_LAYOUT.stageIntro.stageName.x, APP_LAYOUT.stageIntro.stageName.y, stage.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(3, Phaser.Display.Color.HexStringToColor(stage.accentColor).color, 1);
    const problemPanel = APP_LAYOUT.stageIntro.problemPanel;
    panel.fillRoundedRect(problemPanel.x, problemPanel.y, problemPanel.width, problemPanel.height, problemPanel.radius);
    panel.strokeRoundedRect(problemPanel.x, problemPanel.y, problemPanel.width, problemPanel.height, problemPanel.radius);

    this.add
      .text(APP_LAYOUT.stageIntro.problemLabel.x, APP_LAYOUT.stageIntro.problemLabel.y, 'このステージのもんだい', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    this.add
      .text(APP_LAYOUT.stageIntro.themeLabel.x, APP_LAYOUT.stageIntro.themeLabel.y, stage.themeLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: '26px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  /** ステージで出るモンスターを最大5体までカードで並べます。 */
  private drawMonsterCandidates(stage: StageDefinition, saveState: ReturnType<typeof loadSaveState>): void {
    this.add
      .text(APP_LAYOUT.stageIntro.monsterSectionLabel.x, APP_LAYOUT.stageIntro.monsterSectionLabel.y, 'でるモンスター', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    const monsters = getMonstersByIds(stage.monsterIds).slice(0, 5);
    const positions = this.getMonsterCandidatePositions(monsters.length);
    monsters.forEach((monster, index) => {
      const position = positions[index];
      this.drawMonsterCard(monster, position.x, position.y, saveState);
    });
  }

  /** 出現数が少ないステージでも、カードが片寄って見えないように配置します。 */
  private getMonsterCandidatePositions(count: number): Array<{ x: number; y: number }> {
    return STAGE_INTRO_MONSTER_CANDIDATE_POSITIONS[Phaser.Math.Clamp(count, 1, 5)];
  }

  /** 捕獲済みか未発見かに応じて、モンスターカードの見た目と名前表示を変えます。 */
  private drawMonsterCard(monster: MonsterDefinition, x: number, y: number, saveState: ReturnType<typeof loadSaveState>): void {
    const captured = getMonsterCaptureCount(saveState, monster.id) > 0;
    const card = this.add.graphics();
    card.fillStyle(Phaser.Display.Color.HexStringToColor(captured ? monster.palette.background : COLORS.panel).color, 1);
    card.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    const monsterCard = APP_LAYOUT.stageIntro.monsterCard;
    card.fillRoundedRect(
      x - monsterCard.width / 2,
      y - monsterCard.height / 2 - 2,
      monsterCard.width,
      monsterCard.height,
      monsterCard.radius,
    );
    card.strokeRoundedRect(
      x - monsterCard.width / 2,
      y - monsterCard.height / 2 - 2,
      monsterCard.width,
      monsterCard.height,
      monsterCard.radius,
    );
    if (monster.isRare) {
      drawRareSecretRoundedFrame(
        this,
        x,
        y - 2,
        monsterCard.width + 4,
        monsterCard.height + 4,
        monsterCard.radius + 2,
      );
    }
    createMonsterVisual(this, monster, x, y + monsterCard.visualOffsetY, monsterCard.visualSize, !captured);
    if (captured && this.isEvolutionLineComplete(monster, saveState)) {
      this.drawCompleteEvolutionStar(x + monsterCard.completeStarOffsetX, y + monsterCard.completeStarOffsetY);
    }
    this.add
      .text(x, y + monsterCard.nameOffsetY, captured ? monster.name : '???', {
        fontFamily: FONT_FAMILY,
        fontSize: captured ? '12px' : '18px',
        fontStyle: '800',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    const label = captured
      ? monster.isRare
        ? `★レア\n${getEvolutionLabel(monster)}`
        : getEvolutionLabel(monster)
      : 'みはっけん';
    this.add
      .text(x, y + monsterCard.labelOffsetY, label, {
        fontFamily: FONT_FAMILY,
        fontSize: captured && monster.isRare ? '10px' : '11px',
        fontStyle: '800',
        color: captured && monster.isRare ? '#c47a00' : COLORS.muted,
        align: 'center',
        lineSpacing: 1,
      })
      .setOrigin(0.5);
  }

  /** 進化ラインの最終形まで捕獲済みかを調べます。 */
  private isEvolutionLineComplete(monster: MonsterDefinition, saveState: ReturnType<typeof loadSaveState>): boolean {
    let finalMonster = monster;
    while (finalMonster.nextEvolutionId) {
      finalMonster = getMonsterById(finalMonster.nextEvolutionId);
    }

    return getMonsterCaptureCount(saveState, finalMonster.id) > 0;
  }

  /** 進化ライン完成済みのカードに付ける星バッジを描きます。 */
  private drawCompleteEvolutionStar(x: number, y: number): void {
    this.add
      .circle(x, y, 10, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    this.add
      .text(x, y + 1, '★', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  /** 入場回数とアイテムを反映して、出現モンスターを決めて捕獲画面へ進みます。 */
  private startCapture(stage: StageDefinition): void {
    if (getStageAvailability(stage, loadSaveState()) !== 'available') {
      this.scene.start(SceneKeys.StageSelect, { stageId: stage.id });
      return;
    }

    if (!recordStagePlayEntry(stage.id)) {
      this.redrawStageIntroView(stage);
      return;
    }

    const rareMonster = getMonstersByIds(stage.monsterIds).find((monster) => monster.isRare);
    const usedRareBell = rareMonster ? consumeShopItem(SHOP_ITEM_IDS.rareBell) : null;
    const monsterId = usedRareBell && rareMonster
      ? rareMonster.id
      : pickEncounterMonsterId(stage.monsterIds, loadSaveState().encounterStreak);
    recordEncounterMonster(monsterId);
    this.scene.start(SceneKeys.CaptureGame, { stageId: stage.id, monsterId });
  }
}
