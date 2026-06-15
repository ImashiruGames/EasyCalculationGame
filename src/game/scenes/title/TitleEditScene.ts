import * as Phaser from 'phaser';
import { monsters } from '../../../data/monsters';
import { getTitleBackgroundTextureKey, titleBackgrounds, TitleBackgroundDefinition } from '../../../data/titleBackgrounds';
import {
  getMonsterCaptureCount,
  getOwnedTitleBackgroundIds,
  getSelectedTitleBackground,
  getTitleMonsterPlacements,
  loadSaveState,
  saveTitleMonsterPlacements,
  selectTitleBackground,
} from '../../../state/save';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import {
  APP_LAYOUT,
  TITLE_EDIT_NEW_MONSTER_POINTS,
  TITLE_MONSTER_DEFAULT_SIZE,
  TITLE_MONSTER_MAX_SIZE,
  TITLE_MONSTER_MIN_SIZE,
  TITLE_MONSTER_PLACEMENT_BOUNDS,
  TITLE_MONSTER_RESIZE_STEP,
  TITLE_MONSTER_ROTATION_STEP,
  TITLE_MONSTER_SLOT_COUNT,
} from '../../layoutConfig';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import { AppSaveState, MonsterDefinition, TitleMonsterPlacementState } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawTitleBackgroundPreview } from '../../ui/title/titleBackground';

interface TitleEditSceneData {
  pageIndex?: number;
  selectedPlacementIndex?: number;
  titleMonsterPlacements?: TitleMonsterPlacementState[];
  message?: string;
}

const TITLE_EDIT_LAYOUT = APP_LAYOUT.titleEdit;

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

export class TitleEditScene extends Phaser.Scene {
  private pageIndex = 0;
  private selectedPlacementIndex = 0;
  private titleMonsterPlacements: TitleMonsterPlacementState[] | null = null;
  private message = '';
  private contentLayer?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.TitleEdit);
  }

  init(data?: TitleEditSceneData): void {
    this.pageIndex = Math.max(0, data?.pageIndex ?? 0);
    this.selectedPlacementIndex = Math.max(0, data?.selectedPlacementIndex ?? 0);
    this.titleMonsterPlacements = data?.titleMonsterPlacements
      ? this.normalizeWorkingTitleMonsterPlacements(data.titleMonsterPlacements)
      : null;
    this.message = data?.message ?? '';
  }

  preload(): void {
    const saveState = loadSaveState();
    const capturedMonsters = this.getCapturedMonsters(saveState);
    this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxPageIndex(capturedMonsters.length));
    const placements = this.titleMonsterPlacements ?? this.getEditableTitleMonsterPlacements(saveState);
    const ownedBackgroundIds = new Set(getOwnedTitleBackgroundIds(saveState));

    titleBackgrounds.forEach((background) => {
      if (ownedBackgroundIds.has(background.id) && background.imagePath && !this.textures.exists(getTitleBackgroundTextureKey(background))) {
        this.load.image(getTitleBackgroundTextureKey(background), background.imagePath);
      }
    });

    preloadMonsterImageAssetsByIds(this, [
      ...placements.map((placement) => placement.monsterId),
      ...this.getPageMonsters(capturedMonsters).map((monster) => monster.id),
    ]);
  }

  create(): void {
    startBgm('home');
    this.cameras.main.setBackgroundColor(TITLE_EDIT_LAYOUT.backgroundColor);
    this.drawBackground();
    this.redrawTitleEditView();
  }

  /** タイトル編集の操作UIだけを、Sceneを再起動せず描き直します。 */
  private redrawTitleEditView(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const saveState = loadSaveState();
      const capturedMonsters = this.getCapturedMonsters(saveState);
      const titleBackground = getSelectedTitleBackground(saveState);
      this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxPageIndex(capturedMonsters.length));
      this.titleMonsterPlacements ??= this.getEditableTitleMonsterPlacements(saveState);
      this.selectedPlacementIndex = Phaser.Math.Clamp(
        this.selectedPlacementIndex,
        0,
        Math.max(0, this.titleMonsterPlacements.length - 1),
      );

      this.drawHeader(capturedMonsters.length, titleBackground);
      this.drawPlacementPreview(saveState, titleBackground);
      this.drawMonsterChoices(capturedMonsters);
      this.drawPageControls(capturedMonsters.length);
      this.drawPlacedEditSelector();
      this.drawActionButtons(capturedMonsters, saveState);
    });
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(TITLE_EDIT_LAYOUT.backgroundColor).color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(TITLE_EDIT_LAYOUT.sun.color).color, 1);
    graphics.fillCircle(TITLE_EDIT_LAYOUT.sun.x, TITLE_EDIT_LAYOUT.sun.y, TITLE_EDIT_LAYOUT.sun.radius);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(TITLE_EDIT_LAYOUT.workspaceColor).color, 1);
    const workspacePanel = TITLE_EDIT_LAYOUT.workspacePanel;
    graphics.fillRoundedRect(
      workspacePanel.x,
      workspacePanel.y,
      workspacePanel.width,
      workspacePanel.height,
      workspacePanel.radius,
    );
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(TITLE_EDIT_LAYOUT.sidePanelColor).color, TITLE_EDIT_LAYOUT.sidePanelAlpha);
    const shelfPanel = TITLE_EDIT_LAYOUT.shelfPanel;
    graphics.fillRoundedRect(shelfPanel.x, shelfPanel.y, shelfPanel.width, shelfPanel.height, shelfPanel.radius);
    const toolPanel = TITLE_EDIT_LAYOUT.toolPanel;
    graphics.fillRoundedRect(toolPanel.x, toolPanel.y, toolPanel.width, toolPanel.height, toolPanel.radius);
    const placedSelectorPanel = TITLE_EDIT_LAYOUT.placedSelectorPanel;
    graphics.fillRoundedRect(
      placedSelectorPanel.x,
      placedSelectorPanel.y,
      placedSelectorPanel.width,
      placedSelectorPanel.height,
      placedSelectorPanel.radius,
    );
  }

  private drawHeader(capturedCount: number, titleBackground: TitleBackgroundDefinition): void {
    createSmallButton(
      this,
      TITLE_EDIT_LAYOUT.backButton.x,
      TITLE_EDIT_LAYOUT.backButton.y,
      '←',
      () => this.scene.start(SceneKeys.MainMenu),
    );
    this.add
      .text(TITLE_EDIT_LAYOUT.headerTitle.x, TITLE_EDIT_LAYOUT.headerTitle.y, 'かざりつけ', {
        fontFamily: FONT_FAMILY,
        fontSize: `${TITLE_EDIT_LAYOUT.headerTitle.fontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    this.add
      .text(TITLE_EDIT_LAYOUT.headerSubtitle.x, TITLE_EDIT_LAYOUT.headerSubtitle.y, `${capturedCount}しゅるい / ${titleBackground.name}`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${titleBackground.name.length >= 8
          ? TITLE_EDIT_LAYOUT.headerSubtitle.compactFontSize
          : TITLE_EDIT_LAYOUT.headerSubtitle.fontSize}px`,
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawPlacementPreview(saveState: AppSaveState, titleBackground: TitleBackgroundDefinition): void {
    this.add
      .text(TITLE_EDIT_LAYOUT.placementLabel.x, TITLE_EDIT_LAYOUT.placementLabel.y, `${TITLE_MONSTER_SLOT_COUNT}ひきまで`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${TITLE_EDIT_LAYOUT.placementLabel.fontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const preview = TITLE_EDIT_LAYOUT.preview;
    drawTitleBackgroundPreview(this, titleBackground, preview.x, preview.y, preview.width, preview.height);
    this.drawPlacementBoundsGuide(titleBackground);
    this.titleMonsterPlacements?.forEach((placement, index) => {
      const monster = monsters.find((candidate) => candidate.id === placement.monsterId);
      if (!monster || getMonsterCaptureCount(saveState, monster.id) <= 0) {
        return;
      }

      this.drawPlacedMonster(monster, placement, index);
    });
  }

  private drawPlacedMonster(
    monster: MonsterDefinition,
    placement: TitleMonsterPlacementState,
    index: number,
  ): void {
    const previewPoint = this.titleToPreviewPoint(placement.x, placement.y);
    const previewMonster = TITLE_EDIT_LAYOUT.previewMonster;
    const previewSize = Math.max(previewMonster.minSize, Math.round(placement.size * this.getPreviewMetrics().scale));
    const selected = index === this.selectedPlacementIndex;
    const selectionRing = selected
      ? this.add
        .circle(
          previewPoint.x,
          previewPoint.y,
          previewSize * previewMonster.selectionRadiusRatio,
          Phaser.Display.Color.HexStringToColor(previewMonster.selectionFillColor).color,
          0,
        )
        .setStrokeStyle(
          previewMonster.selectionStrokeWidth,
          Phaser.Display.Color.HexStringToColor(previewMonster.selectionColor).color,
          0.9,
        )
        .setDepth(previewMonster.selectionDepth)
      : null;

    const visual = createMonsterVisual(this, monster, previewPoint.x, previewPoint.y, previewSize)
      .setAngle(placement.angle)
      .setDepth(this.getPlacedMonsterDepth(index, previewPoint.y));
    if (!selected) {
      return;
    }

    visual.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(visual);
    visual.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const clampedPoint = this.clampGamePoint(dragX, dragY);
      visual.setPosition(clampedPoint.x, clampedPoint.y);
      visual.setDepth(this.getPlacedMonsterDepth(index, clampedPoint.y));
      selectionRing?.setPosition(clampedPoint.x, clampedPoint.y);
      selectionRing?.setDepth(previewMonster.selectionDepth);
    });
    visual.on('dragend', () => {
      if (this.isInTrashDropZone(visual.x, visual.y)) {
        this.removePlacement(index);
        return;
      }

      const clampedPreviewPoint = this.clampPreviewPoint(visual.x, visual.y);
      const titlePoint = this.previewToTitlePoint(clampedPreviewPoint.x, clampedPreviewPoint.y);
      visual.setPosition(clampedPreviewPoint.x, clampedPreviewPoint.y);
      visual.setDepth(this.getPlacedMonsterDepth(index, clampedPreviewPoint.y));
      selectionRing?.setPosition(clampedPreviewPoint.x, clampedPreviewPoint.y);
      selectionRing?.setDepth(previewMonster.selectionDepth);
      if (this.titleMonsterPlacements?.[index]) {
        this.titleMonsterPlacements[index] = {
          ...this.titleMonsterPlacements[index],
          x: titlePoint.x,
          y: titlePoint.y,
        };
      }
    });
  }

  private getPlacedMonsterDepth(index: number, y: number): number {
    const previewMonster = TITLE_EDIT_LAYOUT.previewMonster;
    return index === this.selectedPlacementIndex
      ? previewMonster.selectedDepth
      : previewMonster.depthBase + y;
  }

  private titleToPreviewPoint(x: number, y: number): { x: number; y: number } {
    const metrics = this.getPreviewMetrics();
    return {
      x: metrics.left + x * metrics.scale,
      y: metrics.top + y * metrics.scale,
    };
  }

  private previewToTitlePoint(x: number, y: number): { x: number; y: number } {
    const metrics = this.getPreviewMetrics();
    return {
      x: Math.round((x - metrics.left) / metrics.scale),
      y: Math.round((y - metrics.top) / metrics.scale),
    };
  }

  private clampPreviewPoint(x: number, y: number): { x: number; y: number } {
    const bounds = this.getPlacementPreviewBounds();
    return {
      x: Phaser.Math.Clamp(x, bounds.left, bounds.right),
      y: Phaser.Math.Clamp(y, bounds.top, bounds.bottom),
    };
  }

  private getPreviewMetrics(): { left: number; right: number; top: number; bottom: number; scale: number } {
    const preview = TITLE_EDIT_LAYOUT.preview;
    const titleWidth = GAME_WIDTH;
    const titleHeight = GAME_HEIGHT;
    const scale = Math.min(preview.width / titleWidth, preview.height / titleHeight);
    const contentWidth = titleWidth * scale;
    const contentHeight = titleHeight * scale;
    const left = preview.x - contentWidth / 2;
    const top = preview.y - contentHeight / 2;

    return {
      left,
      right: left + contentWidth,
      top,
      bottom: top + contentHeight,
      scale,
    };
  }

  private getPlacementPreviewBounds(): { left: number; right: number; top: number; bottom: number } {
    const topLeft = this.titleToPreviewPoint(
      TITLE_MONSTER_PLACEMENT_BOUNDS.minX,
      TITLE_MONSTER_PLACEMENT_BOUNDS.minY,
    );
    const bottomRight = this.titleToPreviewPoint(
      TITLE_MONSTER_PLACEMENT_BOUNDS.maxX,
      TITLE_MONSTER_PLACEMENT_BOUNDS.maxY,
    );

    return {
      left: topLeft.x,
      right: bottomRight.x,
      top: topLeft.y,
      bottom: bottomRight.y,
    };
  }

  private drawPlacementBoundsGuide(titleBackground: TitleBackgroundDefinition): void {
    const bounds = this.getPlacementPreviewBounds();
    const graphics = this.add.graphics();
    const guide = TITLE_EDIT_LAYOUT.placementGuide;
    graphics.lineStyle(guide.strokeWidth, Phaser.Display.Color.HexStringToColor(titleBackground.accentColor).color, guide.alpha);
    graphics.strokeRoundedRect(
      bounds.left,
      bounds.top,
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
      guide.radius,
    );
  }

  private clampGamePoint(x: number, y: number): { x: number; y: number } {
    return {
      x: Phaser.Math.Clamp(x, 0, GAME_WIDTH),
      y: Phaser.Math.Clamp(y, 0, GAME_HEIGHT),
    };
  }

  private isInTrashDropZone(x: number, y: number): boolean {
    const trashDropZone = TITLE_EDIT_LAYOUT.trashDropZone;
    return x >= trashDropZone.x - trashDropZone.width / 2
      && x <= trashDropZone.x + trashDropZone.width / 2
      && y >= trashDropZone.y - trashDropZone.height / 2
      && y <= trashDropZone.y + trashDropZone.height / 2;
  }

  private drawMonsterChoices(capturedMonsters: MonsterDefinition[]): void {
    this.add
      .text(TITLE_EDIT_LAYOUT.choiceLabel.x, TITLE_EDIT_LAYOUT.choiceLabel.y, 'もってる', {
        fontFamily: FONT_FAMILY,
        fontSize: `${TITLE_EDIT_LAYOUT.choiceLabel.fontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    if (capturedMonsters.length === 0) {
      this.add
        .text(TITLE_EDIT_LAYOUT.emptyChoiceText.x, TITLE_EDIT_LAYOUT.emptyChoiceText.y, 'まだ\nいないよ', {
          fontFamily: FONT_FAMILY,
          fontSize: `${TITLE_EDIT_LAYOUT.choiceLabel.fontSize}px`,
          fontStyle: '900',
          color: COLORS.muted,
          align: 'center',
          lineSpacing: 8,
        })
        .setOrigin(0.5);
      return;
    }

    this.getPageMonsters(capturedMonsters).forEach((monster, index) => {
      const col = index % TITLE_EDIT_LAYOUT.choiceGrid.cols;
      const row = Math.floor(index / TITLE_EDIT_LAYOUT.choiceGrid.cols);
      this.drawMonsterChoiceCard(
        monster,
        TITLE_EDIT_LAYOUT.choiceGrid.firstX + col * TITLE_EDIT_LAYOUT.choiceGrid.colGap,
        TITLE_EDIT_LAYOUT.choiceGrid.firstY + row * TITLE_EDIT_LAYOUT.choiceGrid.rowGap,
      );
    });
  }

  private drawMonsterChoiceCard(monster: MonsterDefinition, x: number, y: number): void {
    const placedIndex = this.titleMonsterPlacements?.findIndex((placement) => placement.monsterId === monster.id) ?? -1;
    const alreadyPlaced = placedIndex >= 0;
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(alreadyPlaced ? monster.palette.background : COLORS.panel).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(alreadyPlaced ? monster.palette.accent : COLORS.line).color, 0.9);
    const choiceCard = TITLE_EDIT_LAYOUT.choiceCard;
    graphics.fillRoundedRect(x - choiceCard.width / 2, y - choiceCard.height / 2, choiceCard.width, choiceCard.height, choiceCard.radius);
    graphics.strokeRoundedRect(x - choiceCard.width / 2, y - choiceCard.height / 2, choiceCard.width, choiceCard.height, choiceCard.radius);

    createMonsterVisual(this, monster, x + choiceCard.monsterOffsetX, y + choiceCard.monsterOffsetY, choiceCard.monsterSize);
    this.add
      .text(x + choiceCard.nameOffsetX, y + choiceCard.nameOffsetY, monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: `${monster.name.length >= 5 ? choiceCard.compactNameFontSize : choiceCard.nameFontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: choiceCard.nameWrapWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    this.add
      .zone(x, y, choiceCard.width, choiceCard.height)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (alreadyPlaced) {
          this.refreshWith({ selectedPlacementIndex: placedIndex });
          return;
        }

        this.addMonsterPlacement(monster.id);
      });
  }

  private drawPlacedEditSelector(): void {
    const placedMonsters = (this.titleMonsterPlacements ?? [])
      .map((placement, index) => ({
        index,
        placement,
        monster: monsters.find((candidate) => candidate.id === placement.monsterId),
      }))
      .filter((entry): entry is {
        index: number;
        placement: TitleMonsterPlacementState;
        monster: MonsterDefinition;
      } => Boolean(entry.monster))
      .slice(0, TITLE_EDIT_LAYOUT.placedSelector.maxCards);
    const card = TITLE_EDIT_LAYOUT.placedSelector;

    if (placedMonsters.length === 0) {
      this.add
        .text(card.emptyText.x, card.emptyText.y, 'まだ\nいないよ', {
          fontFamily: FONT_FAMILY,
          fontSize: `${card.emptyText.fontSize}px`,
          fontStyle: '900',
          color: COLORS.muted,
          align: 'center',
          lineSpacing: 8,
        })
        .setOrigin(0.5);
      return;
    }

    placedMonsters.forEach(({ index, placement, monster }, displayIndex) => {
      const selected = index === this.selectedPlacementIndex;
      const x = card.centerX - ((placedMonsters.length - 1) * card.colGap) / 2 + displayIndex * card.colGap;
      this.drawPlacedSelectorCard(monster, placement, index, x, card.y, selected);
    });
  }

  private drawPlacedSelectorCard(
    monster: MonsterDefinition,
    placement: TitleMonsterPlacementState,
    index: number,
    x: number,
    y: number,
    selected: boolean,
  ): void {
    const card = TITLE_EDIT_LAYOUT.placedSelector;
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(monster.palette.background).color, 1);
    graphics.lineStyle(
      selected ? card.selectedStrokeWidth : card.normalStrokeWidth,
      Phaser.Display.Color.HexStringToColor(selected ? COLORS.yellow : monster.palette.accent).color,
      0.95,
    );
    graphics.fillRoundedRect(x - card.width / 2, y - card.height / 2, card.width, card.height, card.radius);
    graphics.strokeRoundedRect(x - card.width / 2, y - card.height / 2, card.width, card.height, card.radius);
    if (selected) {
      this.add
        .text(x, y + card.labelOffsetY, 'いま', {
          fontFamily: FONT_FAMILY,
          fontSize: `${card.labelFontSize}px`,
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5);
    }

    createMonsterVisual(this, monster, x, y + card.monsterOffsetY, card.monsterSize)
      .setAngle(placement.angle);
    this.add
      .text(x, y + card.nameOffsetY, monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: `${monster.name.length >= 5 ? card.compactNameFontSize : card.nameFontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: card.nameWrapWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    this.add
      .zone(x, y, card.width, card.height)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (selected) {
          return;
        }

        this.refreshWith({ selectedPlacementIndex: index });
      });
  }

  private drawPageControls(capturedCount: number): void {
    const maxPageIndex = this.getMaxPageIndex(capturedCount);
    if (capturedCount <= TITLE_EDIT_LAYOUT.pageSize) {
      return;
    }

    this.add
      .text(TITLE_EDIT_LAYOUT.pageText.x, TITLE_EDIT_LAYOUT.pageText.y, `${this.pageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${TITLE_EDIT_LAYOUT.pageText.fontSize}px`,
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.pageIndex > 0) {
      createButton(this, {
        x: TITLE_EDIT_LAYOUT.prevPageButton.x,
        y: TITLE_EDIT_LAYOUT.prevPageButton.y,
        width: TITLE_EDIT_LAYOUT.pageButton.width,
        height: TITLE_EDIT_LAYOUT.pageButton.height,
        label: '<',
        fillColor: COLORS.panel,
        fontSize: TITLE_EDIT_LAYOUT.pageButton.fontSize,
        onClick: () => this.refreshWith({ pageIndex: this.pageIndex - 1 }),
      });
    }

    if (this.pageIndex < maxPageIndex) {
      createButton(this, {
        x: TITLE_EDIT_LAYOUT.nextPageButton.x,
        y: TITLE_EDIT_LAYOUT.nextPageButton.y,
        width: TITLE_EDIT_LAYOUT.pageButton.width,
        height: TITLE_EDIT_LAYOUT.pageButton.height,
        label: '>',
        fillColor: COLORS.panel,
        fontSize: TITLE_EDIT_LAYOUT.pageButton.fontSize,
        onClick: () => this.refreshWith({ pageIndex: this.pageIndex + 1 }),
      });
    }
  }

  private drawActionButtons(capturedMonsters: MonsterDefinition[], saveState: AppSaveState): void {
    const hasSelection = Boolean(this.titleMonsterPlacements?.[this.selectedPlacementIndex]);
    if (this.message) {
      this.add
        .text(TITLE_EDIT_LAYOUT.message.x, TITLE_EDIT_LAYOUT.message.y, this.message, {
          fontFamily: FONT_FAMILY,
          fontSize: `${TITLE_EDIT_LAYOUT.message.fontSize}px`,
          fontStyle: '900',
          color: COLORS.red,
          align: 'center',
        })
        .setOrigin(0.5);
    }

    this.add
      .text(TITLE_EDIT_LAYOUT.toolLabel.x, TITLE_EDIT_LAYOUT.toolLabel.y, 'そうさ', {
        fontFamily: FONT_FAMILY,
        fontSize: `${TITLE_EDIT_LAYOUT.toolLabel.fontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: TITLE_EDIT_LAYOUT.trashDropZone.x,
      y: TITLE_EDIT_LAYOUT.trashDropZone.y,
      width: TITLE_EDIT_LAYOUT.trashDropZone.width,
      height: TITLE_EDIT_LAYOUT.trashDropZone.height,
      label: 'すてる',
      fillColor: TITLE_EDIT_LAYOUT.trashButton.fillColor,
      fontSize: TITLE_EDIT_LAYOUT.trashButton.fontSize,
      disabled: !hasSelection,
      onClick: () => this.removePlacement(this.selectedPlacementIndex),
    });
    createButton(this, {
      x: TITLE_EDIT_LAYOUT.smallButton.x,
      y: TITLE_EDIT_LAYOUT.smallButton.y,
      width: TITLE_EDIT_LAYOUT.smallButton.width,
      height: TITLE_EDIT_LAYOUT.smallButton.height,
      label: 'ちい',
      fillColor: COLORS.panel,
      fontSize: TITLE_EDIT_LAYOUT.smallButton.fontSize,
      disabled: !hasSelection,
      onClick: () => this.resizeSelectedPlacement(-TITLE_MONSTER_RESIZE_STEP),
    });
    createButton(this, {
      x: TITLE_EDIT_LAYOUT.bigButton.x,
      y: TITLE_EDIT_LAYOUT.bigButton.y,
      width: TITLE_EDIT_LAYOUT.bigButton.width,
      height: TITLE_EDIT_LAYOUT.bigButton.height,
      label: 'おお',
      fillColor: COLORS.panel,
      fontSize: TITLE_EDIT_LAYOUT.bigButton.fontSize,
      disabled: !hasSelection,
      onClick: () => this.resizeSelectedPlacement(TITLE_MONSTER_RESIZE_STEP),
    });
    createButton(this, {
      x: TITLE_EDIT_LAYOUT.rotateButton.x,
      y: TITLE_EDIT_LAYOUT.rotateButton.y,
      width: TITLE_EDIT_LAYOUT.rotateButton.width,
      height: TITLE_EDIT_LAYOUT.rotateButton.height,
      label: 'まわす',
      fillColor: COLORS.panel,
      fontSize: TITLE_EDIT_LAYOUT.rotateButton.fontSize,
      disabled: !hasSelection,
      onClick: () => this.rotateSelectedPlacement(),
    });
    createButton(this, {
      x: TITLE_EDIT_LAYOUT.changeButton.x,
      y: TITLE_EDIT_LAYOUT.changeButton.y,
      width: TITLE_EDIT_LAYOUT.changeButton.width,
      height: TITLE_EDIT_LAYOUT.changeButton.height,
      label: 'かえる',
      fillColor: COLORS.panel,
      fontSize: TITLE_EDIT_LAYOUT.changeButton.fontSize,
      disabled: !hasSelection || capturedMonsters.length <= 1,
      onClick: () => this.changeSelectedMonster(capturedMonsters),
    });
    createButton(this, {
      x: TITLE_EDIT_LAYOUT.backgroundButton.x,
      y: TITLE_EDIT_LAYOUT.backgroundButton.y,
      width: TITLE_EDIT_LAYOUT.backgroundButton.width,
      height: TITLE_EDIT_LAYOUT.backgroundButton.height,
      label: 'はいけい',
      fillColor: COLORS.panel,
      fontSize: TITLE_EDIT_LAYOUT.backgroundButton.fontSize,
      onClick: () => this.changeTitleBackground(saveState),
    });
    createButton(this, {
      x: TITLE_EDIT_LAYOUT.saveButton.x,
      y: TITLE_EDIT_LAYOUT.saveButton.y,
      width: TITLE_EDIT_LAYOUT.saveButton.width,
      height: TITLE_EDIT_LAYOUT.saveButton.height,
      label: 'ほぞん',
      fillColor: COLORS.yellow,
      fontSize: TITLE_EDIT_LAYOUT.saveButton.fontSize,
      onClick: () => this.saveAndPreviewTitle(),
    });
  }

  private getCapturedMonsters(saveState: AppSaveState): MonsterDefinition[] {
    return monsters.filter((monster) => getMonsterCaptureCount(saveState, monster.id) > 0);
  }

  private getEditableTitleMonsterPlacements(saveState: AppSaveState): TitleMonsterPlacementState[] {
    return getTitleMonsterPlacements(saveState)
      .filter((placement) => getMonsterCaptureCount(saveState, placement.monsterId) > 0);
  }

  private getPageMonsters(capturedMonsters: MonsterDefinition[]): MonsterDefinition[] {
    const start = this.pageIndex * TITLE_EDIT_LAYOUT.pageSize;
    return capturedMonsters.slice(start, start + TITLE_EDIT_LAYOUT.pageSize);
  }

  private getMaxPageIndex(capturedCount: number): number {
    return Math.max(0, Math.ceil(capturedCount / TITLE_EDIT_LAYOUT.pageSize) - 1);
  }

  private normalizeWorkingTitleMonsterPlacements(
    placements: TitleMonsterPlacementState[],
  ): TitleMonsterPlacementState[] {
    const normalized: TitleMonsterPlacementState[] = [];
    const usedMonsterIds = new Set<string>();
    placements.slice(0, TITLE_MONSTER_SLOT_COUNT).forEach((placement) => {
      if (!monsters.some((monster) => monster.id === placement.monsterId) || usedMonsterIds.has(placement.monsterId)) {
        return;
      }

      normalized.push(this.clampTitlePlacement(placement));
      usedMonsterIds.add(placement.monsterId);
    });

    return normalized;
  }

  private clampTitlePlacement(placement: TitleMonsterPlacementState): TitleMonsterPlacementState {
    return {
      monsterId: placement.monsterId,
      x: Phaser.Math.Clamp(Math.round(placement.x), TITLE_MONSTER_PLACEMENT_BOUNDS.minX, TITLE_MONSTER_PLACEMENT_BOUNDS.maxX),
      y: Phaser.Math.Clamp(Math.round(placement.y), TITLE_MONSTER_PLACEMENT_BOUNDS.minY, TITLE_MONSTER_PLACEMENT_BOUNDS.maxY),
      size: Phaser.Math.Clamp(Math.round(placement.size), TITLE_MONSTER_MIN_SIZE, TITLE_MONSTER_MAX_SIZE),
      angle: this.normalizeAngle(placement.angle),
    };
  }

  private addMonsterPlacement(monsterId: string): void {
    const nextPlacements = [...(this.titleMonsterPlacements ?? [])];
    if (nextPlacements.length >= TITLE_MONSTER_SLOT_COUNT) {
      this.refreshWith({ message: `${TITLE_MONSTER_SLOT_COUNT}ひきまでだよ` });
      return;
    }

    nextPlacements.push({
      monsterId,
      ...this.getNewPlacementPoint(nextPlacements.length),
      size: TITLE_MONSTER_DEFAULT_SIZE,
      angle: 0,
    });
    this.refreshWith({
      titleMonsterPlacements: nextPlacements,
      selectedPlacementIndex: nextPlacements.length - 1,
    });
  }

  private getNewPlacementPoint(index: number): { x: number; y: number } {
    return TITLE_EDIT_NEW_MONSTER_POINTS[index] ?? TITLE_EDIT_NEW_MONSTER_POINTS[0];
  }

  private removePlacement(index: number): void {
    const nextPlacements = [...(this.titleMonsterPlacements ?? [])];
    if (nextPlacements.length === 0) {
      return;
    }

    nextPlacements.splice(index, 1);
    this.refreshWith({
      titleMonsterPlacements: nextPlacements,
      selectedPlacementIndex: Math.max(0, index - 1),
    });
  }

  private resizeSelectedPlacement(delta: number): void {
    const nextPlacements = [...(this.titleMonsterPlacements ?? [])];
    const selectedPlacement = nextPlacements[this.selectedPlacementIndex];
    if (!selectedPlacement) {
      return;
    }

    nextPlacements[this.selectedPlacementIndex] = this.clampTitlePlacement({
      ...selectedPlacement,
      size: selectedPlacement.size + delta,
    });
    this.refreshWith({ titleMonsterPlacements: nextPlacements });
  }

  private rotateSelectedPlacement(): void {
    const nextPlacements = [...(this.titleMonsterPlacements ?? [])];
    const selectedPlacement = nextPlacements[this.selectedPlacementIndex];
    if (!selectedPlacement) {
      return;
    }

    nextPlacements[this.selectedPlacementIndex] = {
      ...selectedPlacement,
      angle: this.normalizeAngle(selectedPlacement.angle + TITLE_MONSTER_ROTATION_STEP),
    };
    this.refreshWith({ titleMonsterPlacements: nextPlacements });
  }

  private changeSelectedMonster(capturedMonsters: MonsterDefinition[]): void {
    const nextPlacements = [...(this.titleMonsterPlacements ?? [])];
    const selectedPlacement = nextPlacements[this.selectedPlacementIndex];
    if (!selectedPlacement) {
      return;
    }

    const placedMonsterIds = new Set(nextPlacements.map((placement, index) => (
      index === this.selectedPlacementIndex ? null : placement.monsterId
    )));
    const currentMonsterIndex = capturedMonsters.findIndex((monster) => monster.id === selectedPlacement.monsterId);
    for (let offset = 1; offset <= capturedMonsters.length; offset += 1) {
      const nextMonster = capturedMonsters[(Math.max(0, currentMonsterIndex) + offset) % capturedMonsters.length];
      if (!nextMonster || placedMonsterIds.has(nextMonster.id)) {
        continue;
      }

      nextPlacements[this.selectedPlacementIndex] = {
        ...selectedPlacement,
        monsterId: nextMonster.id,
      };
      this.refreshWith({ titleMonsterPlacements: nextPlacements });
      return;
    }

    this.refreshWith({ message: 'かえられるモンスターが いないよ' });
  }

  private changeTitleBackground(saveState: AppSaveState): void {
    const ownedBackgroundIds = new Set(getOwnedTitleBackgroundIds(saveState));
    const ownedBackgrounds = titleBackgrounds.filter((background) => ownedBackgroundIds.has(background.id));
    if (ownedBackgrounds.length <= 1) {
      this.refreshWith({ message: 'はいけいはショップで ふやせるよ' });
      return;
    }

    const currentBackground = getSelectedTitleBackground(saveState);
    const currentIndex = ownedBackgrounds.findIndex((background) => background.id === currentBackground.id);
    const nextBackground = ownedBackgrounds[(Math.max(0, currentIndex) + 1) % ownedBackgrounds.length];
    if (!nextBackground || !selectTitleBackground(nextBackground.id)) {
      this.refreshWith({ message: 'はいけいを かえられなかったよ' });
      return;
    }

    this.refreshWith({ message: `${nextBackground.name}に かえたよ` });
  }

  private normalizeAngle(angle: unknown): number {
    if (typeof angle !== 'number' || !Number.isFinite(angle)) {
      return 0;
    }

    return ((Math.round(angle) % 360) + 360) % 360;
  }

  private saveAndPreviewTitle(): void {
    if (!saveTitleMonsterPlacements(this.titleMonsterPlacements ?? [])) {
      this.refreshWith({ message: 'ほぞんできなかったよ' });
      return;
    }

    this.scene.start(SceneKeys.Title);
  }

  /** 編集中の状態を更新し、Sceneを再起動せず表示だけ描き直します。 */
  private refreshWith(overrides: Partial<TitleEditSceneData>): void {
    this.pageIndex = Math.max(0, overrides.pageIndex ?? this.pageIndex);
    this.selectedPlacementIndex = Math.max(0, overrides.selectedPlacementIndex ?? this.selectedPlacementIndex);
    if (overrides.titleMonsterPlacements !== undefined) {
      this.titleMonsterPlacements = this.normalizeWorkingTitleMonsterPlacements(overrides.titleMonsterPlacements);
    }
    this.message = overrides.message ?? '';
    this.redrawTitleEditView();
  }
}
