import * as Phaser from 'phaser';
import { COLORS } from '../../constants';

/** CSSカラー文字列を、Phaserの描画で使う数値カラーへ変換します。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export type CaptureBallVariant = 'normal' | 'gauge';

/** 捕獲ボールのテクスチャを必要なサイズと種類で作り、作成済みなら再利用します。 */
export function getCaptureBallTexture(scene: Phaser.Scene, radius: number, variant: CaptureBallVariant = 'normal'): string {
  const key = `captureBall-${variant}-${radius}`;
  if (scene.textures.exists(key)) {
    return key;
  }

  const padding = 6;
  const textureSize = radius * 2 + padding * 2;
  const center = radius + padding;
  const graphics = scene.add.graphics();

  graphics.fillStyle(colorToNumber(COLORS.panel), 1);
  graphics.fillCircle(center, center, radius);
  graphics.fillStyle(colorToNumber(variant === 'gauge' ? COLORS.blue : COLORS.red), 1);
  graphics.fillCircle(center, center - radius * 0.28, radius * 0.92);
  graphics.fillStyle(colorToNumber(COLORS.panel), 1);
  graphics.fillRect(center - radius, center - radius * 0.05, radius * 2, radius * 1.05);
  graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
  graphics.strokeCircle(center, center, radius);
  graphics.lineBetween(center - radius, center, center + radius, center);
  graphics.fillStyle(colorToNumber(COLORS.panel), 1);
  graphics.fillCircle(center, center, radius * 0.26);
  graphics.strokeCircle(center, center, radius * 0.26);
  graphics.generateTexture(key, textureSize, textureSize);
  graphics.destroy();

  return key;
}

/** 捕獲演出で使うボール画像を、指定位置に配置します。 */
export function createCaptureBall(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  variant: CaptureBallVariant = 'normal',
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, getCaptureBallTexture(scene, radius, variant));
}
