import * as Phaser from 'phaser';
import { getEvolutionLabel, monsters } from '../../../data/monsters';
import { getEmbeddedStoryDraftForMonsterDex } from '../../../data/stories';
import {
  canUnlockDexStory,
  getCandyCount,
  getCoinCount,
  getMonsterCaptureCount,
  getMonsterFragmentCount,
  getUniqueCaptureCount,
  isDexStoryUnlocked,
  loadSaveState,
} from '../../../state/save';
import { StoryCreatorDraft } from '../../../state/storyCreator';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';
import { getMonsterImageAssetsByIds, preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { startSceneWithLoading } from '../../sceneNavigation';
import { AppSaveState, MonsterDefinition } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createRubyText } from '../../ui/common/rubyText';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawRareSecretCircleFrame, drawRareSecretRoundedFrame } from '../../ui/creatures/rareSecretFrame';
import { captureDrawLayer } from './previewLayer';

interface DexSceneData {
  pageIndex?: number;
  selectedMonsterId?: string;
  showCapturedOnly?: boolean;
}

const DEX_PAGE_SIZE = 10;

const DEX_GRID_START_Y = 208;

const DEX_GRID_ROW_GAP = 104;

export class DexPreviewScene extends Phaser.Scene {
  private pageIndex = 0;
  private selectedMonsterId: string | null = null;
  private showCapturedOnly = false;
  private contentLayer?: Phaser.GameObjects.Container;

  /** Registers this scene and its initial presentation settings. */
  constructor() {
    super(SceneKeys.DexPreview);
  }

  /** Restores navigation parameters for each new visit to this scene. */
  init(data?: DexSceneData): void {
    this.pageIndex = Math.max(0, data?.pageIndex ?? 0);
    this.selectedMonsterId = data?.selectedMonsterId ?? null;
    this.showCapturedOnly = data?.showCapturedOnly ?? false;
  }

  /** Loads only the assets needed by the current page before drawing. */
  preload(): void {
    const saveState = loadSaveState();
    this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxPageIndex(saveState));
    preloadMonsterImageAssetsByIds(
      this,
      this.getPageMonsters(saveState).map((monster) => monster.id),
    );
  }

  /** Starts the scene music and builds the initial display. */
  create(): void {
    startBgm('dex');
    this.cameras.main.setBackgroundColor('#f2fbff');
    this.drawBackground();
    this.redrawDexView();
  }

  /** 図鑑の見える部分だけを、Sceneを再起動せず描き直します。 */
  private redrawDexView(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const saveState = loadSaveState();
      const maxPageIndex = this.getMaxPageIndex(saveState);
      this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, maxPageIndex);
      const pageMonsters = this.getPageMonsters(saveState);
      const selectedMonsterId = pageMonsters.find((monster) => monster.id === this.selectedMonsterId)?.id ?? pageMonsters[0]?.id ?? monsters[0].id;

      this.drawHeader(saveState);
      this.drawMonsterGrid(pageMonsters, saveState);
      this.drawPageControls(selectedMonsterId, saveState);
      this.warmNextDexPage(saveState);
    });
  }

  /** Draws the decorative background beneath interactive content. */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#f2fbff').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.ice).color, 0.3);
    graphics.fillCircle(58, 128, 96);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.82);
    graphics.fillCircle(332, 708, 142);
  }

  /** Shows navigation and the current saved totals above the content. */
  private drawHeader(saveState: AppSaveState): void {
    createSmallButton(this, 42, 52, '←', () => this.scene.start(SceneKeys.MainMenu));
    this.add
      .text(GAME_WIDTH / 2, 54, 'モンスターずかん', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 92, `${getUniqueCaptureCount(saveState)} / ${monsters.length} しゅるい  コイン ${getCoinCount(saveState)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 112,
      y: 130,
      width: 150,
      height: 42,
      label: this.showCapturedOnly ? 'ぜんぶみる' : 'みつけた子だけ',
      fillColor: this.showCapturedOnly ? COLORS.ice : COLORS.panel,
      fontSize: 15,
      onClick: () => this.toggleCapturedFilter(),
    });

    createButton(this, {
      x: 278,
      y: 130,
      width: 130,
      height: 42,
      label: 'タイトル\nへんしゅう',
      fillColor: COLORS.panel,
      fontSize: 13,
      onClick: () => startSceneWithLoading(this, SceneKeys.TitleEdit, 'titleEdit'),
    });
  }

  /** Places the current page of monsters in the dex grid. */
  private drawMonsterGrid(
    pageMonsters: MonsterDefinition[],
    saveState: AppSaveState,
  ): void {
    if (pageMonsters.length === 0) {
      this.drawEmptyDexPanel();
      return;
    }

    pageMonsters.forEach((monster, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      this.drawDexCard(monster, 106 + col * 178, DEX_GRID_START_Y + row * DEX_GRID_ROW_GAP, saveState);
    });
  }

  /** Explains the empty result when the dex filter has no matches. */
  private drawEmptyDexPanel(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.9);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.75);
    graphics.fillRoundedRect(38, 300, 314, 132, 18);
    graphics.strokeRoundedRect(38, 300, 314, 132, 18);
    this.add
      .text(GAME_WIDTH / 2, 366, 'みつけたモンスターは\nまだいないよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);
  }

  /** Builds one monster card with its saved capture and selection state. */
  private drawDexCard(
    monster: MonsterDefinition,
    x: number,
    y: number,
    saveState: AppSaveState,
  ): void {
    const capturedCount = getMonsterCaptureCount(saveState, monster.id);
    const fragmentCount = getMonsterFragmentCount(saveState, monster.id);
    const captured = capturedCount > 0;
    const graphics = this.add.graphics();

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(captured ? monster.palette.background : COLORS.panel).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    graphics.fillRoundedRect(x - 76, y - 44, 152, 92, 14);
    graphics.strokeRoundedRect(x - 76, y - 44, 152, 92, 14);
    if (monster.isRare) {
      drawRareSecretRoundedFrame(this, x, y, 156, 96, 16);
    }

    createMonsterVisual(this, monster, x - 40, y, 48, !captured);
    const nameText = this.add
      .text(x + 4, y - 16, captured ? monster.name : '???', {
        fontFamily: FONT_FAMILY,
        fontSize: captured ? '14px' : '18px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'left',
      })
      .setOrigin(0, 0.5);
    this.fitTextToWidth(nameText, 68, captured ? 10 : 18);

    this.add
      .text(x + 4, y + 16, captured ? `${monster.elementName} / かけら ${fragmentCount}` : 'みはっけん', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '800',
        color: captured ? COLORS.muted : COLORS.muted,
        align: 'left',
        wordWrap: { width: 68, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.add
      .zone(x, y, 152, 92)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.showMonsterDetail(monster, saveState);
      });
  }

  /** 1行で出したい文字が指定幅を超えた時、最小サイズまで少しずつ縮めます。 */
  private fitTextToWidth(text: Phaser.GameObjects.Text, maxWidth: number, minFontSize: number): void {
    const currentSize = Number.parseInt(`${text.style.fontSize}`, 10);
    let nextSize = Number.isFinite(currentSize) ? currentSize : minFontSize;
    while (text.width > maxWidth && nextSize > minFontSize) {
      nextSize -= 1;
      text.setFontSize(nextSize);
    }
  }

  /** Opens monster details with the available evolution and story actions. */
  private showMonsterDetail(monster: MonsterDefinition, saveState: AppSaveState): void {
    const capturedCount = getMonsterCaptureCount(saveState, monster.id);
    const fragmentCount = getMonsterFragmentCount(saveState, monster.id);
    const candyCount = getCandyCount(saveState, monster.elementName);
    const captured = capturedCount > 0;
    const overlay = this.add.container(0, 0).setDepth(60);
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Phaser.Display.Color.HexStringToColor('#243044').color, 0.62)
      .setOrigin(0);
    const inputBlocker = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setInteractive()
      .setOrigin(0.5);
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(captured ? monster.palette.background : COLORS.panel).color, 1);
    panel.lineStyle(5, Phaser.Display.Color.HexStringToColor(captured ? monster.palette.accent : COLORS.ice).color, 1);
    panel.fillRoundedRect(24, 72, 342, 696, 22);
    panel.strokeRoundedRect(24, 72, 342, 696, 22);
    const rareSecretPanelFrame = monster.isRare
      ? drawRareSecretRoundedFrame(this, GAME_WIDTH / 2, 420, 346, 700, 24)
      : null;

    const closeButton = createButton(this, {
      x: 310,
      y: 112,
      width: 82,
      height: 46,
      label: 'とじる',
      fillColor: COLORS.panel,
      fontSize: 17,
      onClick: () => overlay.destroy(true),
    });
    const title = this.add
      .text(GAME_WIDTH / 2, 116, captured ? monster.name : '???', {
        fontFamily: FONT_FAMILY,
        fontSize: captured ? '28px' : '32px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
    const visual = createMonsterVisual(this, monster, GAME_WIDTH / 2, 238, 132, !captured);
    const rareSecretVisualFrame = monster.isRare
      ? drawRareSecretCircleFrame(this, GAME_WIDTH / 2, 238, 78)
      : null;

    const typeText = this.add
      .text(
        GAME_WIDTH / 2,
        336,
        captured ? `${monster.elementName}タイプ / ${getEvolutionLabel(monster)}` : 'まだ みつけていない',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          fontStyle: '900',
          color: captured ? COLORS.ink : COLORS.muted,
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const memoTitle = this.add
      .text(54, 382, 'ずかんメモ', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    const description = this.getDexDescription(monster, captured, saveState);
    const rubyDescription = createRubyText(this, 54, 412, description, {
      width: 282,
      baseFontSize: 18,
      rubyFontSize: 10,
      color: COLORS.ink,
      rubyColor: COLORS.muted,
      lineGap: 8,
    });
    const storyDraft = captured ? this.getMonsterStoryDraft(monster, saveState) : undefined;
    const storyButton = storyDraft
      ? createButton(this, {
          x: GAME_WIDTH / 2,
          y: 562,
          width: 154,
          height: 42,
          label: 'ストーリー',
          fillColor: '#fff1a8',
          strokeColor: '#b8941e',
          fontSize: 16,
          onClick: () => this.openMonsterStory(storyDraft, monster),
        })
      : null;
    const storyStatusText = !storyButton ? this.getLockedMonsterStoryStatus(monster, saveState, captured) : null;
    const storyStatus = storyStatusText
      ? this.add
          .text(GAME_WIDTH / 2, 562, storyStatusText, {
            fontFamily: FONT_FAMILY,
            fontSize: '15px',
            fontStyle: '900',
            color: '#7d2a22',
            align: 'center',
            lineSpacing: 4,
          })
          .setOrigin(0.5)
      : null;

    const moveText = this.add
      .text(54, 598, captured ? `わざ\n${monster.moveNames.join(' / ')}` : 'わざ\n???', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '800',
        color: captured ? COLORS.ink : COLORS.muted,
        align: 'left',
        lineSpacing: 6,
        wordWrap: { width: 282, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    const countText = this.add
      .text(
        54,
        684,
        captured
          ? `つかまえた ${capturedCount} / かけら ${fragmentCount} / ${monster.elementName}アメ ${candyCount}`
          : 'つかまえると きろくされます',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '15px',
          fontStyle: '900',
          color: captured ? COLORS.ink : COLORS.muted,
        },
      )
      .setOrigin(0, 0.5);
    overlay.add([
      dim,
      inputBlocker,
      panel,
      ...(rareSecretPanelFrame ? [rareSecretPanelFrame] : []),
      closeButton,
      title,
      visual,
      ...(rareSecretVisualFrame ? [rareSecretVisualFrame] : []),
      typeText,
      memoTitle,
      rubyDescription,
      ...(storyButton ? [storyButton] : []),
      ...(storyStatus ? [storyStatus] : []),
      moveText,
      countText,
    ]);
  }

  /** ずかんのモンスターにひもづいた埋め込みストーリーを返します。 */
  private getMonsterStoryDraft(monster: MonsterDefinition, saveState: AppSaveState): StoryCreatorDraft | undefined {
    if (!monster.dexStoryEnabled || !isDexStoryUnlocked(saveState, monster.id)) {
      return undefined;
    }

    return getEmbeddedStoryDraftForMonsterDex(monster.id);
  }

  /** 未解放の図鑑ストーリーがある時、必要なかけら数などの予告文を返します。 */
  private getLockedMonsterStoryStatus(
    monster: MonsterDefinition,
    saveState: AppSaveState,
    captured: boolean,
  ): string | null {
    if (!captured
      || !monster.dexStoryEnabled
      || isDexStoryUnlocked(saveState, monster.id)) {
      return null;
    }

    const requiredFragments = monster.dexStoryRequiredFragments;
    if (requiredFragments === null) {
      return 'ストーリーが あるよ';
    }

    const fragmentCount = getMonsterFragmentCount(saveState, monster.id);
    const remainingFragments = Math.max(0, requiredFragments - fragmentCount);
    if (remainingFragments <= 0 && !canUnlockDexStory(saveState, monster.id)) {
      return 'まえのお話から';
    }

    return `ストーリーまで\nあと ${remainingFragments}こ`;
  }

  /** モンスターずかんから埋め込みストーリーのプレビューを開きます。 */
  private openMonsterStory(draft: StoryCreatorDraft, monster: MonsterDefinition): void {
    this.scene.start(SceneKeys.StoryPreview, {
      draft,
      returnScene: 'dex',
      returnDexData: {
        pageIndex: this.pageIndex,
        selectedMonsterId: monster.id,
        showCapturedOnly: this.showCapturedOnly,
      },
    });
  }

  /** 図鑑メモに出す文を、発見状況と同じ進化ラインの登録状況に合わせて返します。 */
  private getDexDescription(monster: MonsterDefinition, captured: boolean, saveState: AppSaveState): string {
    if (captured) {
      return monster.dexDescription;
    }

    const capturedFamilyMonster = this.getCapturedFamilyMonster(monster, saveState);
    if (capturedFamilyMonster) {
      if (capturedFamilyMonster.evolutionStage < monster.evolutionStage) {
        return `${capturedFamilyMonster.name}が\nしんかしたすがただよ。`;
      }

      return `${capturedFamilyMonster.name}と\nおなじなかまだよ。`;
    }

    if (monster.previousEvolutionId) {
      return 'まだみつけていないモンスターが\nしんかしたすがただよ。';
    }

    return 'まだくわしいことはわからない。ステージでつかまえてみよう。';
  }

  /** 同じ進化ラインで発見済みのモンスターを、対象に近いものから探します。 */
  private getCapturedFamilyMonster(monster: MonsterDefinition, saveState: AppSaveState): MonsterDefinition | undefined {
    return monsters
      .filter((candidate) => (
        candidate.id !== monster.id
        && candidate.evolutionFamilyId === monster.evolutionFamilyId
        && getMonsterCaptureCount(saveState, candidate.id) > 0
      ))
      .sort((left, right) => {
        const leftIsPreviousForm = left.evolutionStage < monster.evolutionStage;
        const rightIsPreviousForm = right.evolutionStage < monster.evolutionStage;
        if (leftIsPreviousForm !== rightIsPreviousForm) {
          return leftIsPreviousForm ? -1 : 1;
        }

        return Math.abs(left.evolutionStage - monster.evolutionStage)
          - Math.abs(right.evolutionStage - monster.evolutionStage);
      })[0];
  }

  /** Adds dex paging controls while preserving the selected monster. */
  private drawPageControls(selectedMonsterId: string, saveState: AppSaveState): void {
    const visibleMonsterCount = this.getVisibleMonsters(saveState).length;
    const maxPageIndex = this.getMaxPageIndex(saveState);
    this.add
      .text(GAME_WIDTH / 2, 756, visibleMonsterCount > 0 ? `${this.pageIndex + 1} / ${maxPageIndex + 1}` : '0 / 0', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.pageIndex > 0) {
      createButton(this, {
        x: 92,
        y: 794,
        width: 118,
        height: 48,
        label: 'まえへ',
        fillColor: COLORS.panel,
        fontSize: 18,
        onClick: () => this.changeDexPage(this.pageIndex - 1, selectedMonsterId),
      });
    }

    if (this.pageIndex < maxPageIndex) {
      createButton(this, {
        x: 298,
        y: 794,
        width: 118,
        height: 48,
        label: 'つぎへ',
        fillColor: COLORS.panel,
        fontSize: 18,
        onClick: () => this.changeDexPage(this.pageIndex + 1, selectedMonsterId),
      });
    }
  }

  /** 捕獲ずみだけを見る切り替えを、同じScene内で反映します。 */
  private toggleCapturedFilter(): void {
    this.pageIndex = 0;
    this.showCapturedOnly = !this.showCapturedOnly;
    this.redrawDexView();
  }

  /** 図鑑のページ番号を更新し、同じScene内でページを描き直します。 */
  private changeDexPage(nextPageIndex: number, selectedMonsterId: string): void {
    this.pageIndex = nextPageIndex;
    this.selectedMonsterId = selectedMonsterId;
    this.redrawDexView();
  }

  /** Returns the visible monsters within the current dex page. */
  private getPageMonsters(saveState = loadSaveState()): MonsterDefinition[] {
    const visibleMonsters = this.getVisibleMonsters(saveState);
    const start = this.pageIndex * DEX_PAGE_SIZE;
    return visibleMonsters.slice(start, start + DEX_PAGE_SIZE);
  }

  /** Schedules next-page images without blocking the current dex page. */
  private warmNextDexPage(saveState: AppSaveState): void {
    const visibleMonsters = this.getVisibleMonsters(saveState);
    const start = (this.pageIndex + 1) * DEX_PAGE_SIZE;
    scheduleImageAssetWarmup(
      this,
      getMonsterImageAssetsByIds(visibleMonsters.slice(start, start + DEX_PAGE_SIZE).map((monster) => monster.id)),
      {
        startDelayMs: 750,
        gapMs: 500,
        maxAssets: DEX_PAGE_SIZE,
      },
    );
  }

  /** Applies the captured-only filter to the monster catalogue. */
  private getVisibleMonsters(saveState: AppSaveState): MonsterDefinition[] {
    if (!this.showCapturedOnly) {
      return monsters;
    }

    return monsters.filter((monster) => getMonsterCaptureCount(saveState, monster.id) > 0);
  }

  /** Returns the last valid dex page for the current saved collection. */
  private getMaxPageIndex(saveState = loadSaveState()): number {
    return Math.max(0, Math.ceil(this.getVisibleMonsters(saveState).length / DEX_PAGE_SIZE) - 1);
  }
}
