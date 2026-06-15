import * as Phaser from 'phaser';

const RAINBOW_FRAME_COLORS = [
  '#ff5c8a',
  '#ffb84c',
  '#fff36c',
  '#5ee27a',
  '#55c8ff',
  '#9b7cff',
];

/** CSSカラー文字列を、Phaserの描画で使う数値カラーへ変換します。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** レア未発見枠に使う、虹色の角丸フレームを描きます。 */
export function drawRareSecretRoundedFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  alpha = 1,
): Phaser.GameObjects.Graphics {
  const frame = scene.add.graphics();
  RAINBOW_FRAME_COLORS.forEach((color, index) => {
    const inset = index * 1.45;
    frame.lineStyle(2, colorToNumber(color), alpha * (0.96 - index * 0.06));
    frame.strokeRoundedRect(
      x - width / 2 + inset,
      y - height / 2 + inset,
      width - inset * 2,
      height - inset * 2,
      Math.max(4, radius - inset),
    );
  });

  return frame;
}

/** レア未発見の丸いアイコン枠に使う、虹色の円フレームを描きます。 */
export function drawRareSecretCircleFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
): Phaser.GameObjects.Graphics {
  const frame = scene.add.graphics();
  RAINBOW_FRAME_COLORS.forEach((color, index) => {
    frame.lineStyle(2, colorToNumber(color), alpha * (0.94 - index * 0.06));
    frame.strokeCircle(x, y, radius + index * 1.5);
  });

  return frame;
}
