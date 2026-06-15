import * as Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';

const TILE_SIZE = 176;
const TILE_SCROLL_DISTANCE = 176;
const TILE_SCROLL_DURATION_MS = 18000;

const symbolByCategoryId = new Map<string, string[]>([
  ['addition', ['+']],
  ['subtraction', ['-']],
  ['multiplication', ['x']],
  ['division', ['÷', 'あ']],
  ['decimal', ['0.1', '.']],
  ['root', ['ル', '2']],
  ['makeTen', ['\u25a1', '10']],
]);

/** カテゴリと色ごとに、背景パターン用のテクスチャキーを作ります。 */
function getTextureKey(categoryId: string, accentColor: string): string {
  return `math-pattern-${categoryId}-${accentColor.replace(/[^a-z0-9]+/gi, '').toLowerCase()}`;
}

/** ステージ色を薄くして、背景模様に使う透明色へ変換します。 */
function getPatternColor(accentColor: string): string {
  const color = Phaser.Display.Color.HexStringToColor(accentColor);
  return `rgba(${color.red}, ${color.green}, ${color.blue}, 0.18)`;
}

/** カテゴリごとの記号を並べたタイル用テクスチャを作り、作成済みなら再利用します。 */
function createMathPatternTexture(scene: Phaser.Scene, categoryId: string, accentColor: string): string | null {
  const symbols = symbolByCategoryId.get(categoryId);
  if (!symbols) {
    return null;
  }

  const key = getTextureKey(categoryId, accentColor);
  if (scene.textures.exists(key)) {
    return key;
  }

  const texture = scene.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
  if (!texture) {
    return null;
  }

  const context = texture.getContext();
  context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  context.fillStyle = getPatternColor(accentColor);
  context.font = `900 56px ${FONT_FAMILY}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const points = [
    { x: 44, y: 44 },
    { x: 132, y: 44 },
    { x: 44, y: 132 },
    { x: 132, y: 132 },
  ];
  points.forEach((point, index) => {
    context.fillText(symbols[index % symbols.length], point.x, point.y);
  });

  texture.refresh();
  return key;
}

/** 算数カテゴリに合わせた記号パターン背景を敷き、ゆっくりスクロールさせます。 */
export function drawMathPatternBackdrop(scene: Phaser.Scene, categoryId: string, accentColor: string): void {
  const key = createMathPatternTexture(scene, categoryId, accentColor);
  if (!key) {
    return;
  }

  const wash = scene.add.graphics().setDepth(-52);
  wash.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
  wash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  wash.fillStyle(Phaser.Display.Color.HexStringToColor(accentColor).color, 0.08);
  wash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const pattern = scene.add
    .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, key)
    .setDepth(-51)
    .setAlpha(1);

  scene.tweens.add({
    targets: pattern,
    tilePositionX: TILE_SCROLL_DISTANCE,
    tilePositionY: TILE_SCROLL_DISTANCE,
    duration: TILE_SCROLL_DURATION_MS,
    ease: 'Linear',
    repeat: -1,
  });
  pattern.once('destroy', () => scene.tweens.killTweensOf(pattern));
}
