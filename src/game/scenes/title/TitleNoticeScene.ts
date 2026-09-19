import * as Phaser from 'phaser';
import { isTitleNoticeNewerThan, titleNoticeEntries, type TitleNoticeEntry } from '../../../data/titleNotices';
import { loadLastSeenTitleNoticeId, markLatestTitleNoticeSeen } from '../../../state/titleNotice';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';

const NOTICE_PAGE_SIZE = 4;
const CARD_LEFT = 28;
const CARD_WIDTH = 334;
// Four cards end at y668, leaving space before the page buttons at y685.
const CARD_HEIGHT = 136;
const CARD_START_Y = 100;
const CARD_GAP = 8;
const CARD_TEXT_TOP = 8;
const TITLE_BODY_GAP = 6;
const PAGE_CONTROLS_Y = 706;

interface TitleNoticeSceneData {
  pageIndex?: number;
}

/** Converts a CSS hex color into the number Phaser graphics needs. */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** Captures newly drawn objects into one layer. */
function captureDrawLayer(scene: Phaser.Scene, draw: () => void): Phaser.GameObjects.Container {
  const before = new Set(scene.children.list);
  draw();
  const layer = scene.add.container(0, 0);
  scene.children.list
    .filter((child) => child !== layer && !before.has(child))
    .forEach((child) => layer.add(child));
  return layer;
}

export class TitleNoticeScene extends Phaser.Scene {
  private lastSeenNoticeId: string | null = null;
  private pageIndex = 0;
  private contentLayer?: Phaser.GameObjects.Container;

  /** Sets up the Phaser scene key for the title notice screen. */
  constructor() {
    super(SceneKeys.TitleNotice);
  }

  /** Reads the page to show when this scene is opened again. */
  init(data?: TitleNoticeSceneData): void {
    this.pageIndex = Phaser.Math.Clamp(Math.floor(data?.pageIndex ?? 0), 0, this.getMaxPageIndex());
  }

  /** Draws the notice screen from the notice data list. */
  create(): void {
    this.lastSeenNoticeId = loadLastSeenTitleNoticeId();
    startBgm('title');
    this.cameras.main.setBackgroundColor('#f7fbff');
    this.drawBackground();
    this.drawHeader();
    this.drawIntroPanel();
    this.redrawNoticeContent();
    this.drawFooter();
    markLatestTitleNoticeSeen();
  }

  /** Draws the soft paper-like background. */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#f7fbff'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, colorToNumber('#d9edf8'), 0.62);
    for (let y = 28; y < GAME_HEIGHT; y += 28) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    graphics.fillStyle(colorToNumber('#fff1a8'), 0.9);
    graphics.fillRoundedRect(246, 92, 168, 64, 24);
    graphics.fillStyle(colorToNumber('#dff9e8'), 0.9);
    graphics.fillRoundedRect(-42, 178, 210, 62, 24);
    graphics.fillStyle(colorToNumber('#ffddec'), 0.9);
    graphics.fillRoundedRect(224, 680, 218, 70, 28);
    graphics.fillStyle(colorToNumber('#d8f2ff'), 0.9);
    graphics.fillRoundedRect(-32, 722, 202, 56, 22);
  }

  /** Draws the top title and back button. */
  private drawHeader(): void {
    createSmallButton(this, 42, 52, '←', () => this.scene.start(SceneKeys.Title));
    this.add
      .text(GAME_WIDTH / 2, 54, 'おしらせ！', {
        fontFamily: FONT_FAMILY,
        fontSize: '32px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** Draws the short lead text above the notice cards. */
  private drawIntroPanel(): void {
    // const graphics = this.add.graphics();
    // graphics.fillStyle(colorToNumber('#ffffff'), 0.98);
    // graphics.lineStyle(4, colorToNumber(COLORS.yellow), 1);
    // graphics.fillRoundedRect(32, 104, 326, 96, 18);
    // graphics.strokeRoundedRect(32, 104, 326, 96, 18);
    // graphics.fillStyle(colorToNumber(COLORS.yellow), 0.28);
    // graphics.fillCircle(78, 152, 28);

    // this.add
    //   .text(78, 153, '!', {
    //     fontFamily: FONT_FAMILY,
    //     fontSize: '29px',
    //     fontStyle: '900',
    //     color: '#b52a24',
    //   })
    //   .setOrigin(0.5);

    // this.add
    //   .text(124, 130, 'アップデートを ここに ならべるよ', {
    //     fontFamily: FONT_FAMILY,
    //     fontSize: '17px',
    //     fontStyle: '900',
    //     color: COLORS.ink,
    //   })
    //   .setOrigin(0, 0.5);
    // this.add
    //   .text(124, 166, 'あとから 1つずつ ふやせるよ', {
    //     fontFamily: FONT_FAMILY,
    //     fontSize: '14px',
    //     fontStyle: '800',
    //     color: COLORS.muted,
    //   })
    //   .setOrigin(0, 0.5);
  }

  /** Redraws the notice cards and page buttons. */
  private redrawNoticeContent(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      this.drawNoticeList();
      this.drawPageControls();
    });
  }

  /** Returns the last page index for the notice list. */
  private getMaxPageIndex(): number {
    return Math.max(0, Math.ceil(titleNoticeEntries.length / NOTICE_PAGE_SIZE) - 1);
  }

  /** Returns the notice entries shown on the current page. */
  private getCurrentPageEntries(): TitleNoticeEntry[] {
    const startIndex = this.pageIndex * NOTICE_PAGE_SIZE;
    return titleNoticeEntries.slice(startIndex, startIndex + NOTICE_PAGE_SIZE);
  }

  /** Moves the notice list to another page. */
  private changePage(nextPageIndex: number): void {
    const nextPage = Phaser.Math.Clamp(nextPageIndex, 0, this.getMaxPageIndex());
    if (nextPage === this.pageIndex) {
      return;
    }
    this.pageIndex = nextPage;
    this.redrawNoticeContent();
  }

  /** Draws the notice cards for the current page. */
  private drawNoticeList(): void {
    this.getCurrentPageEntries().forEach((entry, index) => {
      this.drawNoticeCard(entry, CARD_START_Y + index * (CARD_HEIGHT + CARD_GAP));
    });
  }

  /** Draws page controls when notices have more than one page. */
  private drawPageControls(): void {
    const maxPageIndex = this.getMaxPageIndex();
    if (maxPageIndex <= 0) {
      return;
    }

    createButton(this, {
      x: 108,
      y: PAGE_CONTROLS_Y,
      width: 88,
      height: 42,
      label: 'まえ',
      fillColor: this.pageIndex > 0 ? COLORS.panel : '#e8eef2',
      textColor: this.pageIndex > 0 ? COLORS.ink : COLORS.muted,
      fontSize: 16,
      onClick: () => this.changePage(this.pageIndex - 1),
    });

    this.add
      .text(GAME_WIDTH / 2, PAGE_CONTROLS_Y, `${this.pageIndex + 1}/${maxPageIndex + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: GAME_WIDTH - 108,
      y: PAGE_CONTROLS_Y,
      width: 88,
      height: 42,
      label: 'つぎ',
      fillColor: this.pageIndex < maxPageIndex ? COLORS.panel : '#e8eef2',
      textColor: this.pageIndex < maxPageIndex ? COLORS.ink : COLORS.muted,
      fontSize: 16,
      onClick: () => this.changePage(this.pageIndex + 1),
    });
  }

  /** Draws one notice card. */
  private drawNoticeCard(entry: TitleNoticeEntry, top: number): void {
    const graphics = this.add.graphics();
    const isNew = isTitleNoticeNewerThan(entry.id, this.lastSeenNoticeId);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.98);
    graphics.lineStyle(3, colorToNumber(entry.accentColor), 1);
    graphics.fillRoundedRect(CARD_LEFT, top, CARD_WIDTH, CARD_HEIGHT, 16);
    graphics.strokeRoundedRect(CARD_LEFT, top, CARD_WIDTH, CARD_HEIGHT, 16);
    graphics.fillStyle(colorToNumber(entry.accentColor), 0.28);
    graphics.fillRoundedRect(CARD_LEFT + 14, top + 14, 76, 26, 13);

    this.add
      .text(CARD_LEFT + 52, top + 27, entry.dateLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
    if (isNew) {
      this.drawCardNewBadge(CARD_LEFT + 52, top + 61);
    }
    const title = this.add
      .text(CARD_LEFT + 106, top + CARD_TEXT_TOP, entry.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.ink,
        wordWrap: { width: 220, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    // Wrapped titles must push the body down instead of sharing fixed center positions.
    this.add
      .text(CARD_LEFT + 106, title.y + title.height + TITLE_BODY_GAP, entry.body, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '800',
        color: COLORS.muted,
        lineSpacing: 3,
        wordWrap: { width: 220, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
  }

  /** Draws the NEW label inside one notice card. */
  private drawCardNewBadge(x: number, y: number): void {
    const width = 58;
    const height = 24;
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber(COLORS.red), 1);
    graphics.lineStyle(2, colorToNumber('#ffffff'), 1);
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
    graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);

    this.add
      .text(x, y + 1, 'NEW', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  /** Draws the bottom return button. */
  private drawFooter(): void {
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 770,
      width: 140,
      height: 50,
      label: 'もどる',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 19,
      onClick: () => this.scene.start(SceneKeys.Title),
    });
  }
}
