import * as Phaser from 'phaser';
import { getBgmVolume, setBgmVolume } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton } from './button';

interface BgmVolumeMenuOption {
  label: string;
  value: number;
}

const bgmVolumeOptions: BgmVolumeMenuOption[] = [
  { label: 'なし', value: 0 },
  { label: '小', value: 0.35 },
  { label: '中', value: 0.7 },
  { label: '大', value: 1 },
];
const openMenuScenes = new WeakSet<Phaser.Scene>();

/** Converts a CSS color string into a Phaser color number. */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** Finds the closest menu option for the current BGM volume. */
function getNearestBgmVolumeOption(value: number): BgmVolumeMenuOption {
  return bgmVolumeOptions.reduce((nearest, option) => (
    Math.abs(option.value - value) < Math.abs(nearest.value - value) ? option : nearest
  ), bgmVolumeOptions[0]);
}

/** Shows the top-right app menu modal. */
export function showGameMenu(scene: Phaser.Scene): Phaser.GameObjects.Container | null {
  if (openMenuScenes.has(scene)) {
    return null;
  }

  openMenuScenes.add(scene);
  const overlay = scene.add.container(0, 0).setDepth(1000);
  const shade = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, colorToNumber(COLORS.line), 0.48)
    .setInteractive();
  const panel = scene.add.graphics();
  panel.fillStyle(colorToNumber(COLORS.panel), 1);
  panel.lineStyle(4, colorToNumber(COLORS.water), 1);
  panel.fillRoundedRect(30, 148, 330, 486, 18);
  panel.strokeRoundedRect(30, 148, 330, 486, 18);
  overlay.add([shade, panel]);

  overlay.add(
    scene.add
      .text(GAME_WIDTH / 2, 192, 'メニュー', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5),
  );

  const bgmText = scene.add
    .text(GAME_WIDTH / 2, 326, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
    })
    .setOrigin(0.5);
  overlay.add(bgmText);

  let bgmButtonLayer: Phaser.GameObjects.Container | null = null;

  /** Rebuilds the BGM volume buttons for the current setting. */
  const drawBgmButtons = (): void => {
    bgmButtonLayer?.destroy(true);
    const selectedOption = getNearestBgmVolumeOption(getBgmVolume());
    bgmText.setText(`BGMのおと: ${selectedOption.label}`);
    bgmButtonLayer = scene.add.container(0, 0);
    bgmVolumeOptions.forEach((option, index) => {
      const isSelected = option === selectedOption;
      bgmButtonLayer?.add(createButton(scene, {
        x: 77 + index * 56,
        y: 374,
        width: 50,
        height: 42,
        label: option.label,
        fontSize: 18,
        fillColor: isSelected ? COLORS.yellow : COLORS.panel,
        strokeColor: isSelected ? '#b52a24' : COLORS.water,
        textColor: COLORS.ink,
        onClick: () => {
          setBgmVolume(option.value);
          scene.time.delayedCall(0, drawBgmButtons);
        },
      }));
    });
    overlay.add(bgmButtonLayer);
  };

  /** Closes the app menu modal. */
  const closeMenu = (): void => {
    overlay.destroy(true);
  };

  const homeButton = createButton(scene, {
    x: GAME_WIDTH / 2,
    y: 254,
    width: 210,
    height: 54,
    label: 'ホームへ',
    fontSize: 22,
    fillColor: COLORS.yellow,
    onClick: () => {
      closeMenu();
      scene.scene.start(SceneKeys.MainMenu);
    },
  });
  overlay.add(homeButton);

  drawBgmButtons();

  const closeButton = createButton(scene, {
    x: GAME_WIDTH / 2,
    y: 544,
    width: 152,
    height: 50,
    label: 'つづける',
    fontSize: 21,
    fillColor: COLORS.panel,
    textColor: COLORS.ink,
    onClick: closeMenu,
  });
  overlay.add(closeButton);
  shade.on('pointerdown', closeMenu);
  overlay.once('destroy', () => openMenuScenes.delete(scene));
  return overlay;
}
