import * as Phaser from 'phaser';
import { playButtonTapSound } from '../../audio';
import { COLORS, FONT_FAMILY } from '../../constants';
import { getGameButtonTexture } from './textureCache';

interface ButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick?: () => void;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  fontSize?: number;
  disabled?: boolean;
  hitPadding?: number;
  activateOnPointerDown?: boolean;
}

/** ボタン内の文字が枠からはみ出さないよう、文字サイズと縮小率を調整します。 */
function fitLabelInsideButton(
  label: Phaser.GameObjects.Text,
  width: number,
  height: number,
  requestedFontSize: number,
): void {
  const maxWidth = Math.max(18, width - 18);
  const maxHeight = Math.max(14, height - 12);
  const minFontSize = Math.max(8, Math.floor(requestedFontSize * 0.62));
  let fontSize = requestedFontSize;

  label.setWordWrapWidth(label.text.includes('\n') ? maxWidth : null, true);

  while (fontSize > minFontSize && (label.width > maxWidth || label.height > maxHeight)) {
    fontSize -= 1;
    label.setFontSize(fontSize);
  }

  const scaleX = label.width > maxWidth ? maxWidth / label.width : 1;
  const scaleY = label.height > maxHeight ? maxHeight / label.height : 1;
  label.setScale(Math.min(1, scaleX, scaleY));
}

/** タップ可能な共通ボタンを作ります。枠と同じサイズの透明Zoneを使い、見た目と判定を一致させます。 */
export function createButton(scene: Phaser.Scene, options: ButtonOptions): Phaser.GameObjects.Container {
  const fillColor = options.fillColor ?? COLORS.yellow;
  const strokeColor = options.strokeColor ?? '#b52a24';
  const textColor = options.textColor ?? '#7d2a22';
  const fontSize = options.fontSize ?? 22;
  const hitPadding = options.hitPadding ?? 0;
  const container = scene.add.container(options.x, options.y);
  const buttonRadius = Math.min(16, Math.max(10, Math.floor(options.height / 2.6)));
  const normalTexture = getGameButtonTexture(scene, {
    width: options.width,
    height: options.height,
    radius: buttonRadius,
    fillColor,
    strokeColor,
    strokeWidth: 3,
    disabled: options.disabled,
  });
  const pressedTexture = getGameButtonTexture(scene, {
    width: options.width,
    height: options.height,
    radius: buttonRadius,
    fillColor,
    strokeColor,
    strokeWidth: 3,
    pressed: true,
  });
  const background = scene.add.image(0, 0, normalTexture);
  let isPressed = false;

  const label = scene.add
    .text(0, 0, options.label, {
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: '900',
      color: textColor,
      align: 'center',
      lineSpacing: options.label.includes('\n') ? 2 : 0,
      wordWrap: { width: Math.max(18, options.width - 18), useAdvancedWrap: true },
    })
    .setOrigin(0.5);
  fitLabelInsideButton(label, options.width, options.height, fontSize);
  label.setShadow(0, 1, 'rgba(255, 255, 255, 0.55)', 0, true, false);
  label.setAlpha(options.disabled ? 0.62 : 1);
  const hitZone = scene.add
    .zone(0, 0, options.width + hitPadding * 2, options.height + hitPadding * 2)
    .setOrigin(0.5);

  container.add([background, label, hitZone]);
  container.setSize(options.width + hitPadding * 2, options.height + hitPadding * 2);

  if (!options.disabled && options.onClick) {
    /** 押下中の見た目を戻し、必要ならクリック処理を実行します。 */
    const resetPress = (shouldClick: boolean): void => {
      if (!isPressed) {
        return;
      }

      isPressed = false;
      background.setTexture(normalTexture);
      scene.tweens.killTweensOf(container);
      scene.tweens.add({ targets: container, scale: 1, duration: 80 });
      if (shouldClick) {
        options.onClick?.();
      }
    };

    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      playButtonTapSound();
      isPressed = true;
      background.setTexture(pressedTexture);
      scene.tweens.killTweensOf(container);
      scene.tweens.add({ targets: container, scale: 0.98, duration: 70 });
      if (options.activateOnPointerDown) {
        isPressed = false;
        options.onClick?.();
      }
    });
    hitZone.on('pointerup', () => {
      resetPress(true);
    });
    hitZone.on('pointerupoutside', () => {
      resetPress(false);
    });
    hitZone.on('pointerout', () => {
      background.setTexture(normalTexture);
      scene.tweens.killTweensOf(container);
      scene.tweens.add({ targets: container, scale: 1, duration: 80 });
    });
  }

  return container;
}

/** メニューや戻る操作に使う小さなアイコン風ボタンを作ります。 */
export function createSmallButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const button = createButton(scene, {
    x,
    y,
    width: 52,
    height: 44,
    label,
    onClick,
    fillColor: COLORS.panel,
    fontSize: 24,
    hitPadding: 12,
    activateOnPointerDown: true,
  });
  button.setDepth(50);
  return button;
}
