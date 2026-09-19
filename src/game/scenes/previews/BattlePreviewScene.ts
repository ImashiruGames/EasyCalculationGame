import * as Phaser from 'phaser';
import { type BgmTrack, startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createSmallButton } from '../../ui/common/button';

class SimplePreviewScene extends Phaser.Scene {
  /** Registers this scene and its initial presentation settings. */
  constructor(
    sceneKey: string,
    private readonly title: string,
    private readonly track: BgmTrack,
    private readonly accentColor: string,
    private readonly backgroundColor: string,
  ) {
    super(sceneKey);
  }

  /** Starts the scene music and builds the initial display. */
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

  /** Draws the decorative background beneath interactive content. */
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
  /** Registers this scene and its initial presentation settings. */
  constructor() {
    super(SceneKeys.BattlePreview, 'モンスター\nしょうぶ', 'battle', COLORS.fire, '#fff4e8');
  }
}
