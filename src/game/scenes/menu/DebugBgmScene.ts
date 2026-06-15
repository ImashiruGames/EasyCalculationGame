import * as Phaser from 'phaser';
import { stages } from '../../../data/stages';
import { BASE_BGM_TRACK_OPTIONS, startBgm, stopBgm, type BgmTrack, type BgmTrackOption } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';

const TRACKS_PER_PAGE = 7;

export class DebugBgmScene extends Phaser.Scene {
  private pageIndex = 0;
  private playingTrackId: BgmTrack | null = null;
  private readonly trackOptions: BgmTrackOption[] = [
    ...BASE_BGM_TRACK_OPTIONS,
    ...stages.map((stage) => ({
      id: `capture:${stage.id}` as BgmTrack,
      label: `capture:${stage.id}`,
    })),
  ];
  private listContainer: Phaser.GameObjects.Container | null = null;

  /** PhaserにBGM試聴用のデバッグSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.DebugBgm);
  }

  /** 背景BGMを止め、BGM ID一覧と試聴ボタンを作ります。 */
  create(): void {
    stopBgm();
    this.cameras.main.setBackgroundColor('#f6fbff');
    this.drawBackground();
    createSmallButton(this, 42, 52, '←', () => this.goBack());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopBgm());

    this.add
      .text(GAME_WIDTH / 2, 62, 'BGMテスト', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 104, 'BGM ID', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    this.drawTrackList();
  }

  /** 背景の淡い面と横線を描きます。 */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#f6fbff').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, Phaser.Display.Color.HexStringToColor('#cfeafa').color, 0.58);
    for (let y = 132; y < GAME_HEIGHT; y += 46) {
      graphics.lineBetween(30, y, GAME_WIDTH - 30, y);
    }
  }

  /** 表示中ページのBGM IDと操作ボタンを描き直します。 */
  private drawTrackList(): void {
    this.listContainer?.destroy(true);
    const listContainer = this.add.container(0, 0);
    this.listContainer = listContainer;

    const pageCount = this.getPageCount();
    const startIndex = this.pageIndex * TRACKS_PER_PAGE;
    const visibleTracks = this.trackOptions.slice(startIndex, startIndex + TRACKS_PER_PAGE);

    visibleTracks.forEach((track, index) => {
      this.drawTrackRow(listContainer, track, index);
    });

    listContainer.add(
      this.add
        .text(GAME_WIDTH / 2, 696, `${this.pageIndex + 1}/${pageCount}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5),
    );

    listContainer.add(createButton(this, {
      x: 92,
      y: 742,
      width: 108,
      height: 46,
      label: 'まえ',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 18,
      disabled: this.pageIndex === 0,
      onClick: () => this.goToPage(this.pageIndex - 1),
    }));

    listContainer.add(createButton(this, {
      x: 298,
      y: 742,
      width: 108,
      height: 46,
      label: 'つぎ',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 18,
      disabled: this.pageIndex >= pageCount - 1,
      onClick: () => this.goToPage(this.pageIndex + 1),
    }));

    listContainer.add(createButton(this, {
      x: GAME_WIDTH / 2,
      y: 804,
      width: 180,
      height: 50,
      label: 'ストップ',
      fillColor: '#ffe05c',
      strokeColor: '#b52a24',
      fontSize: 20,
      disabled: this.playingTrackId === null,
      onClick: () => this.stopTrack(),
    }));
  }

  /** 1行ぶんのBGM ID、ラベル、試聴ボタンを作ります。 */
  private drawTrackRow(container: Phaser.GameObjects.Container, track: BgmTrackOption, index: number): void {
    const rowY = 154 + index * 82;
    const isPlaying = this.playingTrackId === track.id;
    const isOtherPlaying = this.playingTrackId !== null && !isPlaying;
    const rowGraphics = this.add.graphics();
    rowGraphics.fillStyle(Phaser.Display.Color.HexStringToColor(isPlaying ? '#fff0a8' : '#ffffff').color, 0.96);
    rowGraphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(isPlaying ? '#b58b24' : '#cfeafa').color, 1);
    rowGraphics.fillRoundedRect(28, rowY - 32, 334, 64, 12);
    rowGraphics.strokeRoundedRect(28, rowY - 32, 334, 64, 12);
    container.add(rowGraphics);

    container.add(this.add
      .text(46, rowY - 11, track.id, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
        wordWrap: { width: 214, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5));

    container.add(this.add
      .text(46, rowY + 17, track.label, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.muted,
        wordWrap: { width: 214, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5));

    container.add(createButton(this, {
      x: 314,
      y: rowY,
      width: 76,
      height: 42,
      label: isPlaying ? 'いま' : 'きく',
      fillColor: isPlaying ? '#ffe05c' : '#d7f0ff',
      strokeColor: isPlaying ? '#b52a24' : '#276b9e',
      fontSize: 17,
      disabled: isPlaying || isOtherPlaying,
      onClick: () => this.playTrack(track.id),
    }));
  }

  /** 指定したBGMだけを再生し、ほかの試聴ボタンを押せない状態へ更新します。 */
  private playTrack(trackId: BgmTrack): void {
    if (this.playingTrackId !== null) {
      return;
    }

    this.playingTrackId = trackId;
    startBgm(trackId);
    this.drawTrackList();
  }

  /** 今流れているBGMを止め、ほかのBGMを選べる状態へ戻します。 */
  private stopTrack(): void {
    stopBgm();
    this.playingTrackId = null;
    this.drawTrackList();
  }

  /** ページ番号を安全な範囲に丸めてから一覧を描き直します。 */
  private goToPage(nextPageIndex: number): void {
    this.pageIndex = Phaser.Math.Clamp(nextPageIndex, 0, this.getPageCount() - 1);
    this.drawTrackList();
  }

  /** BGM ID一覧の総ページ数を返します。 */
  private getPageCount(): number {
    return Math.max(1, Math.ceil(this.trackOptions.length / TRACKS_PER_PAGE));
  }

  /** BGMを止めてからメインメニューへ戻ります。 */
  private goBack(): void {
    stopBgm();
    this.scene.start(SceneKeys.MainMenu);
  }
}
