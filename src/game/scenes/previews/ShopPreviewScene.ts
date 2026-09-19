import * as Phaser from 'phaser';
import { monsters } from '../../../data/monsters';
import { ShopItemDefinition, shopItems } from '../../../data/shopItems';
import {
  getTitleBackgroundTextureKey,
  TitleBackgroundDefinition,
  titleBackgrounds,
} from '../../../data/titleBackgrounds';
import {
  buyShopItem,
  buyTitleBackground,
  canExchangeFragmentsForCandy,
  COINS_PER_CANDY,
  exchangeCandyForCoins,
  exchangeFragmentsForCandy,
  getCandyCount,
  getCoinCount,
  getItemCount,
  getMonsterFragmentCount,
  getSelectedTitleBackground,
  isTitleBackgroundOwned,
  loadSaveState,
  selectTitleBackground,
} from '../../../state/save';
import { scheduleImageAssetWarmup } from '../../assets/assetWarmup';
import { getMonsterImageAssetsByIds, preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { playExchangeSound, playShopPurchaseSound } from '../../audio';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { AppSaveState, MonsterDefinition } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawTitleBackgroundPreview } from '../../ui/title/titleBackground';
import { captureDrawLayer } from './previewLayer';

const SHOP_ATTRIBUTES = Array.from(new Set(monsters.map((monster) => monster.elementName)));

const FRAGMENT_EXCHANGE_PAGE_SIZE = 3;

const TITLE_BACKGROUND_PAGE_SIZE = 3;

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

  /** Registers this scene and its initial presentation settings. */
  constructor() {
    super(SceneKeys.ShopPreview);
  }

  /** Restores navigation parameters for each new visit to this scene. */
  init(data?: ShopSceneData): void {
    this.tab = data?.tab ?? 'buy';
    this.message = data?.message ?? '';
    this.fragmentPageIndex = Math.max(0, data?.fragmentPageIndex ?? 0);
    this.backgroundPageIndex = Math.max(0, data?.backgroundPageIndex ?? 0);
  }

  /** Loads only the assets needed by the current page before drawing. */
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

  /** Starts the scene music and builds the initial display. */
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

  /** Draws the decorative background beneath interactive content. */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff9e8').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0.3);
    graphics.fillCircle(56, 126, 96);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.78);
    graphics.fillCircle(336, 712, 136);
  }

  /** Shows navigation and the current saved totals above the content. */
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

  /** Builds the shop tab controls and marks the active category. */
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

  /** Lays out the purchasable items using the current saved inventory. */
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

  /** Shows one item and routes its purchase result back to the shop. */
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

  /** Draws the item-specific icon inside a shop card. */
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

  /** Shows the current page of purchasable title backgrounds. */
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

  /** Queues title images required by the selected background page. */
  private preloadTitleBackgroundPage(): void {
    this.getTitleBackgroundPage().forEach((background) => {
      if (background.imagePath && !this.textures.exists(getTitleBackgroundTextureKey(background))) {
        this.load.image(getTitleBackgroundTextureKey(background), background.imagePath);
      }
    });
  }

  /** Warms the following page of title images in the background. */
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

  /** Slices the title catalogue to the selected page. */
  private getTitleBackgroundPage(): TitleBackgroundDefinition[] {
    const start = this.backgroundPageIndex * TITLE_BACKGROUND_PAGE_SIZE;
    return titleBackgrounds.slice(start, start + TITLE_BACKGROUND_PAGE_SIZE);
  }

  /** Returns the last page in the title background catalogue. */
  private getMaxTitleBackgroundPageIndex(): number {
    return Math.max(0, Math.ceil(titleBackgrounds.length / TITLE_BACKGROUND_PAGE_SIZE) - 1);
  }

  /** Adds previous and next controls for title backgrounds. */
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

  /** Shows background ownership with the purchase or selection action. */
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

  /** Keeps the highest eligible evolution per family and sorts by fragments. */
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

  /** Warms monster images for the next fragment exchange page. */
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

  /** Returns the exchange candidates on the selected page. */
  private getFragmentPageCandidates(
    candidates: Array<{ monster: MonsterDefinition; fragmentCount: number }>,
  ): Array<{ monster: MonsterDefinition; fragmentCount: number }> {
    const start = this.fragmentPageIndex * FRAGMENT_EXCHANGE_PAGE_SIZE;
    return candidates.slice(start, start + FRAGMENT_EXCHANGE_PAGE_SIZE);
  }

  /** Returns the last page for the current exchange candidate count. */
  private getMaxFragmentPageIndex(totalCandidateCount: number): number {
    return Math.max(0, Math.ceil(totalCandidateCount / FRAGMENT_EXCHANGE_PAGE_SIZE) - 1);
  }

  /** Adds paging controls for eligible fragment exchanges. */
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

  /** Explains why no fragment exchanges are currently available. */
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

  /** Shows one eligible monster and handles exchanging its fragments. */
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

  /** Builds the attribute-specific actions for exchanging candy into coins. */
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
