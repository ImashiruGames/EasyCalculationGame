import * as Phaser from 'phaser';
import { getEvolutionLabel, monsters } from '../../../data/monsters';
import { getEmbeddedStoryDraftForMonsterDex } from '../../../data/stories';
import { shopItems, ShopItemDefinition } from '../../../data/shopItems';
import { getTitleBackgroundTextureKey, titleBackgrounds, TitleBackgroundDefinition } from '../../../data/titleBackgrounds';
import {
  buyTitleBackground,
  buyShopItem,
  canExchangeFragmentsForCandy,
  canUnlockDexStory,
  COINS_PER_CANDY,
  exchangeCandyForCoins,
  exchangeFragmentsForCandy,
  getCandyCount,
  getCoinCount,
  getItemCount,
  getMonsterCaptureCount,
  getMonsterFragmentCount,
  getSelectedTitleBackground,
  getUniqueCaptureCount,
  isDexStoryUnlocked,
  isTitleBackgroundOwned,
  loadSaveState,
  selectTitleBackground,
} from '../../../state/save';
import type { StoryCreatorDraft } from '../../../state/storyCreator';
import { playExchangeSound, playShopPurchaseSound } from '../../audio';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';
import { startBgm, type BgmTrack } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { getMonsterImageAssetsByIds, preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import { startSceneWithLoading } from '../../sceneNavigation';
import { AppSaveState, MonsterDefinition } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawRareSecretCircleFrame, drawRareSecretRoundedFrame } from '../../ui/creatures/rareSecretFrame';
import { createRubyText } from '../../ui/common/rubyText';
import { drawTitleBackgroundPreview } from '../../ui/title/titleBackground';

const SHOP_ATTRIBUTES = Array.from(new Set(monsters.map((monster) => monster.elementName)));

class SimplePreviewScene extends Phaser.Scene {
  constructor(
    sceneKey: string,
    private readonly title: string,
    private readonly track: BgmTrack,
    private readonly accentColor: string,
    private readonly backgroundColor: string,
  ) {
    super(sceneKey);
  }

  create(): void {
    startBgm(this.track);
    this.cameras.main.setBackgroundColor(this.backgroundColor);
    this.drawBackground();
    createSmallButton(this, 42, 52, '←', () => this.scene.start(SceneKeys.MainMenu));

    this.add
      .text(GAME_WIDTH / 2, 260, this.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(this.backgroundColor).color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(this.accentColor).color, 0.26);
    graphics.fillCircle(72, 132, 102);
    graphics.fillCircle(322, 676, 138);
    graphics.lineStyle(5, Phaser.Display.Color.HexStringToColor(this.accentColor).color, 0.55);
    graphics.strokeRoundedRect(58, 214, 274, 116, 24);
  }
}

export class BattlePreviewScene extends SimplePreviewScene {
  constructor() {
    super(SceneKeys.BattlePreview, 'モンスター\nしょうぶ', 'battle', COLORS.fire, '#fff4e8');
  }
}

interface DexSceneData {
  pageIndex?: number;
  selectedMonsterId?: string;
  showCapturedOnly?: boolean;
}

const DEX_PAGE_SIZE = 10;
const DEX_GRID_START_Y = 208;
const DEX_GRID_ROW_GAP = 104;
const FRAGMENT_EXCHANGE_PAGE_SIZE = 3;
const TITLE_BACKGROUND_PAGE_SIZE = 3;

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

export class DexPreviewScene extends Phaser.Scene {
  private pageIndex = 0;
  private selectedMonsterId: string | null = null;
  private showCapturedOnly = false;
  private contentLayer?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.DexPreview);
  }

  init(data?: DexSceneData): void {
    this.pageIndex = Math.max(0, data?.pageIndex ?? 0);
    this.selectedMonsterId = data?.selectedMonsterId ?? null;
    this.showCapturedOnly = data?.showCapturedOnly ?? false;
  }

  preload(): void {
    const saveState = loadSaveState();
    this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.getMaxPageIndex(saveState));
    preloadMonsterImageAssetsByIds(
      this,
      this.getPageMonsters(saveState).map((monster) => monster.id),
    );
  }

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

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#f2fbff').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.ice).color, 0.3);
    graphics.fillCircle(58, 128, 96);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.82);
    graphics.fillCircle(332, 708, 142);
  }

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

  private getPageMonsters(saveState = loadSaveState()): MonsterDefinition[] {
    const visibleMonsters = this.getVisibleMonsters(saveState);
    const start = this.pageIndex * DEX_PAGE_SIZE;
    return visibleMonsters.slice(start, start + DEX_PAGE_SIZE);
  }

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

  private getVisibleMonsters(saveState: AppSaveState): MonsterDefinition[] {
    if (!this.showCapturedOnly) {
      return monsters;
    }

    return monsters.filter((monster) => getMonsterCaptureCount(saveState, monster.id) > 0);
  }

  private getMaxPageIndex(saveState = loadSaveState()): number {
    return Math.max(0, Math.ceil(this.getVisibleMonsters(saveState).length / DEX_PAGE_SIZE) - 1);
  }
}

type ShopTab = 'buy' | 'exchange' | 'background';

interface ShopSceneData {
  tab?: ShopTab;
  message?: string;
  fragmentPageIndex?: number;
  backgroundPageIndex?: number;
}

export class ShopPreviewScene extends Phaser.Scene {
  private tab: ShopTab = 'buy';
  private message = '';
  private fragmentPageIndex = 0;
  private backgroundPageIndex = 0;
  private contentLayer?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.ShopPreview);
  }

  init(data?: ShopSceneData): void {
    this.tab = data?.tab ?? 'buy';
    this.message = data?.message ?? '';
    this.fragmentPageIndex = Math.max(0, data?.fragmentPageIndex ?? 0);
    this.backgroundPageIndex = Math.max(0, data?.backgroundPageIndex ?? 0);
  }

  preload(): void {
    if (this.tab === 'background') {
      this.backgroundPageIndex = Phaser.Math.Clamp(
        this.backgroundPageIndex,
        0,
        this.getMaxTitleBackgroundPageIndex(),
      );
      this.preloadTitleBackgroundPage();
      return;
    }

    if (this.tab !== 'exchange') {
      return;
    }

    const saveState = loadSaveState();
    const candidates = this.getFragmentExchangeCandidates(saveState);
    this.fragmentPageIndex = Phaser.Math.Clamp(
      this.fragmentPageIndex,
      0,
      this.getMaxFragmentPageIndex(candidates.length),
    );
    preloadMonsterImageAssetsByIds(
      this,
      this.getFragmentPageCandidates(candidates).map((candidate) => candidate.monster.id),
    );
  }

  create(): void {
    startBgm('shop');
    this.cameras.main.setBackgroundColor('#fff9e8');
    this.drawBackground();
    this.redrawShopView();
  }

  /** ショップの中身だけを、Sceneを再起動せず描き直します。 */
  private redrawShopView(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const saveState = loadSaveState();

      this.drawHeader(saveState);
      this.drawTabs();
      if (this.tab === 'buy') {
        this.drawItemShop(saveState);
        return;
      }

      if (this.tab === 'background') {
        this.drawTitleBackgroundShop(saveState);
        this.warmNextTitleBackgroundPage();
        return;
      }

      this.drawFragmentExchange(saveState);
      this.drawCandyExchange(saveState);
      this.warmNextFragmentPage(saveState);
    });
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff9e8').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0.3);
    graphics.fillCircle(56, 126, 96);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.78);
    graphics.fillCircle(336, 712, 136);
  }

  private drawHeader(saveState: AppSaveState): void {
    createSmallButton(this, 42, 52, '←', () => this.scene.start(SceneKeys.MainMenu));
    this.add
      .text(GAME_WIDTH / 2, 54, 'ショップ', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 94, `コイン ${getCoinCount(saveState)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawTabs(): void {
    createButton(this, {
      x: 76,
      y: 132,
      width: 102,
      height: 42,
      label: 'アイテム',
      fillColor: this.tab === 'buy' ? COLORS.yellow : COLORS.panel,
      fontSize: 15,
      onClick: () => this.changeShopTab('buy'),
    });
    createButton(this, {
      x: 195,
      y: 132,
      width: 102,
      height: 42,
      label: 'こうかん',
      fillColor: this.tab === 'exchange' ? COLORS.yellow : COLORS.panel,
      fontSize: 15,
      onClick: () => this.changeShopTab('exchange'),
    });
    createButton(this, {
      x: 314,
      y: 132,
      width: 102,
      height: 42,
      label: 'はいけい',
      fillColor: this.tab === 'background' ? COLORS.yellow : COLORS.panel,
      fontSize: 15,
      onClick: () => this.changeShopTab('background'),
    });

    if (!this.message) {
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 166, this.message, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.grassDark,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** ショップのタブを切り替え、同じScene内で表示を更新します。 */
  private changeShopTab(tab: ShopTab): void {
    this.tab = tab;
    this.message = '';
    if (tab === 'exchange') {
      this.fragmentPageIndex = 0;
    }
    if (tab === 'background') {
      this.backgroundPageIndex = 0;
    }
    this.redrawShopView();
  }

  private drawItemShop(saveState: AppSaveState): void {
    const startY = shopItems.length >= 4 ? 214 : 236;
    const cardGap = shopItems.length >= 4 ? 118 : 148;
    shopItems.forEach((item, index) => {
      this.drawShopItemCard(item, saveState, startY + index * cardGap);
    });

    this.add
      .text(GAME_WIDTH / 2, 724, 'アイテムごとに\nつかえるばしょで つかえるよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
  }

  private drawShopItemCard(item: ShopItemDefinition, saveState: AppSaveState, y: number): void {
    const ownedCount = getItemCount(saveState, item.id);
    const canBuy = getCoinCount(saveState) >= item.price;
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.96);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(item.accentColor).color, 1);
    graphics.fillRoundedRect(28, y - 58, 334, 116, 18);
    graphics.strokeRoundedRect(28, y - 58, 334, 116, 18);

    this.drawShopItemIcon(item, 72, y);
    this.add
      .text(112, y - 28, item.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(112, y + 6, item.description, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
        lineSpacing: 3,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(112, y + 42, `もってる ${ownedCount}こ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 306,
      y,
      width: 92,
      height: 50,
      label: `${item.price}\nかう`,
      fontSize: 15,
      fillColor: canBuy ? COLORS.yellow : COLORS.panel,
      disabled: !canBuy,
      onClick: () => {
        if (!buyShopItem(item.id, item.price)) {
          this.showShopMessage('なおせなかったよ。もういちどためしてね');
          return;
        }

        playShopPurchaseSound();
        this.showShopMessage(`${item.name}を買ったよ！`);
      },
    });
  }

  /** ショップのメッセージを変えて、同じScene内で表示を更新します。 */
  private showShopMessage(message: string): void {
    this.message = message;
    this.redrawShopView();
  }

  private drawShopItemIcon(item: ShopItemDefinition, x: number, y: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(item.accentColor).color, 1);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    graphics.fillCircle(x, y, 24);
    graphics.strokeCircle(x, y, 24);
    this.add
      .text(x, y, item.iconLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  private drawTitleBackgroundShop(saveState: AppSaveState): void {
    const maxPageIndex = this.getMaxTitleBackgroundPageIndex();
    this.backgroundPageIndex = Phaser.Math.Clamp(this.backgroundPageIndex, 0, maxPageIndex);
    this.getTitleBackgroundPage().forEach((background, index) => {
      this.drawTitleBackgroundCard(background, saveState, 230 + index * 148);
    });
    this.drawTitleBackgroundPageControls(maxPageIndex);

    this.add
      .text(GAME_WIDTH / 2, 724, 'はいけいごとに\n5ひきまで かざれるよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
  }

  private preloadTitleBackgroundPage(): void {
    this.getTitleBackgroundPage().forEach((background) => {
      if (background.imagePath && !this.textures.exists(getTitleBackgroundTextureKey(background))) {
        this.load.image(getTitleBackgroundTextureKey(background), background.imagePath);
      }
    });
  }

  private warmNextTitleBackgroundPage(): void {
    const start = (this.backgroundPageIndex + 1) * TITLE_BACKGROUND_PAGE_SIZE;
    scheduleImageAssetWarmup(
      this,
      titleBackgrounds.slice(start, start + TITLE_BACKGROUND_PAGE_SIZE).map((background) => (
        background.imagePath
          ? { key: getTitleBackgroundTextureKey(background), path: background.imagePath }
          : null
      )),
      {
        startDelayMs: 900,
        gapMs: 650,
        maxAssets: TITLE_BACKGROUND_PAGE_SIZE,
      },
    );
  }

  private getTitleBackgroundPage(): TitleBackgroundDefinition[] {
    const start = this.backgroundPageIndex * TITLE_BACKGROUND_PAGE_SIZE;
    return titleBackgrounds.slice(start, start + TITLE_BACKGROUND_PAGE_SIZE);
  }

  private getMaxTitleBackgroundPageIndex(): number {
    return Math.max(0, Math.ceil(titleBackgrounds.length / TITLE_BACKGROUND_PAGE_SIZE) - 1);
  }

  private drawTitleBackgroundPageControls(maxPageIndex: number): void {
    if (maxPageIndex <= 0) {
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 650, `${this.backgroundPageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.backgroundPageIndex > 0) {
      createSmallButton(this, 62, 650, '<', () => this.changeBackgroundPage(this.backgroundPageIndex - 1));
    }

    if (this.backgroundPageIndex < maxPageIndex) {
      createSmallButton(this, 328, 650, '>', () => this.changeBackgroundPage(this.backgroundPageIndex + 1));
    }
  }

  /** 背景ショップのページ番号を変えて、同じScene内で描き直します。 */
  private changeBackgroundPage(nextPageIndex: number): void {
    this.backgroundPageIndex = Phaser.Math.Clamp(nextPageIndex, 0, this.getMaxTitleBackgroundPageIndex());
    this.redrawShopView();
  }

  private drawTitleBackgroundCard(
    background: TitleBackgroundDefinition,
    saveState: AppSaveState,
    y: number,
  ): void {
    const isOwned = isTitleBackgroundOwned(saveState, background.id);
    const isSelected = getSelectedTitleBackground(saveState).id === background.id;
    const canBuy = getCoinCount(saveState) >= background.price;
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.96);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(background.accentColor).color, isSelected ? 1 : 0.82);
    graphics.fillRoundedRect(28, y - 64, 334, 128, 18);
    graphics.strokeRoundedRect(28, y - 64, 334, 128, 18);

    drawTitleBackgroundPreview(this, background, 78, y, 82, 86);

    this.add
      .text(132, y - 38, background.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(132, y - 7, background.description, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
        lineSpacing: 3,
        wordWrap: { width: 126, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);
    this.add
      .text(132, y + 34, isSelected ? 'タイトルでつかってる' : isOwned ? '買ったよ' : `${background.price}コイン`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: isSelected ? COLORS.grassDark : COLORS.ink,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 306,
      y,
      width: 92,
      height: 50,
      label: isSelected ? 'つかう中' : isOwned ? 'つかう' : `${background.price}\nかう`,
      fontSize: 15,
      fillColor: isSelected ? COLORS.panel : canBuy || isOwned ? COLORS.yellow : COLORS.panel,
      disabled: isSelected || (!isOwned && !canBuy),
      onClick: () => {
        const nextState = isOwned
          ? selectTitleBackground(background.id)
          : buyTitleBackground(background.id);
        if (!nextState) {
          this.showShopMessage('なおせなかったよ。もういちどためしてね');
          return;
        }

        if (!isOwned) {
          playShopPurchaseSound();
        }
        this.showShopMessage(isOwned ? `${background.name}に かえたよ` : `${background.name}を買ったよ！`);
      },
    });
  }

  /** 手持ちのかけらから、交換できそうなモンスターを優先して表示します。 */
  private drawFragmentExchange(saveState: AppSaveState): void {
    const titleY = this.message ? 194 : 178;
    const cardStartY = this.message ? 264 : 250;
    this.add
      .text(34, titleY, `かけら 5こ → アメ 1こ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    const candidates = this.getFragmentExchangeCandidates(saveState);

    if (candidates.length === 0) {
      this.drawEmptyFragmentPanel();
      return;
    }

    const maxPageIndex = this.getMaxFragmentPageIndex(candidates.length);
    this.fragmentPageIndex = Phaser.Math.Clamp(this.fragmentPageIndex, 0, maxPageIndex);
    const pageCandidates = this.getFragmentPageCandidates(candidates);

    pageCandidates.forEach((candidate, index) => {
      this.drawFragmentCard(candidate.monster, candidate.fragmentCount, cardStartY + index * 96, saveState);
    });
    this.drawFragmentPageControls(maxPageIndex);
  }

  private getFragmentExchangeCandidates(
    saveState: AppSaveState,
  ): Array<{ monster: MonsterDefinition; fragmentCount: number }> {
    return Array.from(
      monsters.reduce((families, monster) => {
        const fragmentCount = getMonsterFragmentCount(saveState, monster.id);
        if (!canExchangeFragmentsForCandy(saveState, monster.id, monster.attribute)) {
          return families;
        }

        const current = families.get(monster.evolutionFamilyId);
        if (!current || monster.evolutionStage > current.monster.evolutionStage) {
          families.set(monster.evolutionFamilyId, { monster, fragmentCount });
        }

        return families;
      }, new Map<string, { monster: MonsterDefinition; fragmentCount: number }>())
        .values(),
    )
      .sort((left, right) => {
        return right.fragmentCount - left.fragmentCount;
      });
  }

  private warmNextFragmentPage(saveState: AppSaveState): void {
    const candidates = this.getFragmentExchangeCandidates(saveState);
    const maxPageIndex = this.getMaxFragmentPageIndex(candidates.length);
    this.fragmentPageIndex = Phaser.Math.Clamp(this.fragmentPageIndex, 0, maxPageIndex);
    const start = (this.fragmentPageIndex + 1) * FRAGMENT_EXCHANGE_PAGE_SIZE;
    scheduleImageAssetWarmup(
      this,
      getMonsterImageAssetsByIds(
        candidates.slice(start, start + FRAGMENT_EXCHANGE_PAGE_SIZE).map((candidate) => candidate.monster.id),
      ),
      {
        startDelayMs: 850,
        gapMs: 550,
        maxAssets: FRAGMENT_EXCHANGE_PAGE_SIZE,
      },
    );
  }

  private getFragmentPageCandidates(
    candidates: Array<{ monster: MonsterDefinition; fragmentCount: number }>,
  ): Array<{ monster: MonsterDefinition; fragmentCount: number }> {
    const start = this.fragmentPageIndex * FRAGMENT_EXCHANGE_PAGE_SIZE;
    return candidates.slice(start, start + FRAGMENT_EXCHANGE_PAGE_SIZE);
  }

  private getMaxFragmentPageIndex(totalCandidateCount: number): number {
    return Math.max(0, Math.ceil(totalCandidateCount / FRAGMENT_EXCHANGE_PAGE_SIZE) - 1);
  }

  private drawFragmentPageControls(maxPageIndex: number): void {
    if (maxPageIndex <= 0) {
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 512, `${this.fragmentPageIndex + 1} / ${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (this.fragmentPageIndex > 0) {
      createSmallButton(this, 62, 512, '<', () => this.changeFragmentPage(this.fragmentPageIndex - 1));
    }

    if (this.fragmentPageIndex < maxPageIndex) {
      createSmallButton(this, 328, 512, '>', () => this.changeFragmentPage(this.fragmentPageIndex + 1));
    }
  }

  /** かけら交換のページ番号を変えて、同じScene内で描き直します。 */
  private changeFragmentPage(nextPageIndex: number): void {
    const maxPageIndex = this.getMaxFragmentPageIndex(this.getFragmentExchangeCandidates(loadSaveState()).length);
    this.fragmentPageIndex = Phaser.Math.Clamp(nextPageIndex, 0, maxPageIndex);
    this.redrawShopView();
  }

  private drawEmptyFragmentPanel(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.9);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.9);
    graphics.fillRoundedRect(34, 210, 322, 90, 18);
    graphics.strokeRoundedRect(34, 210, 322, 90, 18);
    this.add
      .text(GAME_WIDTH / 2, 255, 'しんかと お話を\nすすめると アメにできます', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
  }

  private drawFragmentCard(
    monster: MonsterDefinition,
    fragmentCount: number,
    y: number,
    saveState: AppSaveState,
  ): void {
    const top = y - 42;
    const canExchange = canExchangeFragmentsForCandy(saveState, monster.id, monster.attribute);
    const statusText = 'アメに できるよ';
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.96);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.88);
    graphics.fillRoundedRect(34, top, 322, 84, 18);
    graphics.strokeRoundedRect(34, top, 322, 84, 18);

    createMonsterVisual(this, monster, 74, y, 52);
    this.add
      .text(116, y - 18, monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(116, y + 14, `${monster.elementName}アメ +1\nかけら ${fragmentCount}\n${statusText}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.grassDark,
        lineSpacing: 0,
        wordWrap: { width: 142, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 302,
      y,
      width: 92,
      height: 48,
      label: 'アメに\nする',
      fontSize: 15,
      fillColor: canExchange ? COLORS.yellow : COLORS.panel,
      disabled: !canExchange,
      onClick: () => {
        if (!exchangeFragmentsForCandy(monster.id, monster.attribute)) {
          this.showShopMessage('なおせなかったよ。もういちどためしてね');
          return;
        }

        playExchangeSound();
        this.showShopMessage(`${monster.elementName}アメに したよ`);
      },
    });
  }

  private drawCandyExchange(saveState: AppSaveState): void {
    this.add
      .text(34, 560, `アメ 1こ → ${COINS_PER_CANDY}コイン`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    SHOP_ATTRIBUTES.forEach((attribute, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const candyCount = getCandyCount(saveState, attribute);
      createButton(this, {
        x: 76 + col * 119,
        y: 626 + row * 62,
        width: 100,
        height: 52,
        label: `${attribute}アメ\n${candyCount}こ`,
        fontSize: attribute.length >= 4 ? 13 : 14,
        fillColor: candyCount > 0 ? COLORS.yellow : COLORS.panel,
        disabled: candyCount <= 0,
        onClick: () => {
          if (!exchangeCandyForCoins(attribute)) {
            this.showShopMessage('なおせなかったよ。もういちどためしてね');
            return;
          }

          playExchangeSound();
          this.showShopMessage(`${COINS_PER_CANDY}コインに したよ`);
        },
      });
    });
  }
}
