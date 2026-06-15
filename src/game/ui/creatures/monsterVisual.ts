import * as Phaser from 'phaser';
import { COLORS } from '../../constants';
import { getMonsterImageAsset, getMonsterPlaceholderImageAsset, MonsterImageAsset } from '../../assets/monsterImageAssets';
import { MonsterDefinition } from '../../types';

/** CSSカラー文字列を、Phaserの描画で使う数値カラーへ変換します。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** モンスターの見た目をデータから描画します。図鑑やステージ表示にも流用できます。 */
export function createMonsterVisual(
  scene: Phaser.Scene,
  monster: MonsterDefinition,
  x: number,
  y: number,
  size: number,
  silhouette = false,
): Phaser.GameObjects.Image {
  const key = getMonsterTexture(scene, monster, size, silhouette);
  return scene.add.image(x, y, key);
}

/** モンスター画像または図形描画から、指定サイズのテクスチャキーを取得します。 */
function getMonsterTexture(
  scene: Phaser.Scene,
  monster: MonsterDefinition,
  size: number,
  silhouette: boolean,
): string {
  const imageAsset = getMonsterImageAsset(monster.id);
  if (imageAsset && scene.textures.exists(imageAsset.key)) {
    const imageTextureKey = getMonsterImageTexture(scene, monster.id, imageAsset, size, silhouette);
    if (imageTextureKey) {
      return imageTextureKey;
    }
  }

  const placeholderAsset = getMonsterPlaceholderImageAsset();
  if (scene.textures.exists(placeholderAsset.key)) {
    const placeholderTextureKey = getMonsterImageTexture(scene, `${monster.id}-placeholder`, placeholderAsset, size, silhouette);
    if (placeholderTextureKey) {
      return placeholderTextureKey;
    }
  }

  const key = `monster-v5-${monster.id}-${size}-${silhouette ? 'silhouette' : 'normal'}`;
  if (scene.textures.exists(key)) {
    return key;
  }

  const visualTier = getVisualTier(monster);
  const padding = visualTier > 0 ? Math.max(10, Math.round(size * (monster.isRare ? 0.22 : 0.16))) : 8;
  const textureSize = size + padding * 2;
  const center = textureSize / 2;
  const graphics = scene.add.graphics();
  const body = silhouette ? '#263143' : monster.palette.body;
  const accent = silhouette ? '#263143' : monster.palette.accent;
  const shadow = silhouette ? '#263143' : monster.palette.shadow;
  const line = colorToNumber(silhouette ? '#263143' : COLORS.line);
  const radius = size / 2;
  const faceY = visualTier > 0 ? center - radius * 0.18 : center;

  graphics.lineStyle(3, line, 1);
  drawRareAura(graphics, monster, center, center, radius, silhouette);
  if (visualTier > 0) {
    drawDetailedBody(graphics, monster, center, center, radius, body, accent, shadow, silhouette, visualTier);
  }
  drawRareSignatureParts(graphics, monster, center, faceY, radius, body, accent, shadow, silhouette, 'back');
  graphics.lineStyle(3, line, 1);
  drawShape(graphics, monster.shape, center, faceY, radius, body, accent, silhouette);
  drawShapeDecorations(graphics, monster, center, faceY, radius, accent, shadow, silhouette, visualTier);

  if (!silhouette) {
    drawFace(graphics, center, faceY, radius);
  }
  drawRareSignatureParts(graphics, monster, center, faceY, radius, body, accent, shadow, silhouette, 'front');

  graphics.generateTexture(key, textureSize, textureSize);
  graphics.destroy();

  return key;
}

/** 読み込み済み画像素材を、既存演出で扱いやすい固定サイズのテクスチャへ焼き込みます。 */
function getMonsterImageTexture(
  scene: Phaser.Scene,
  monsterId: string,
  asset: MonsterImageAsset,
  size: number,
  silhouette: boolean,
): string | null {
  const key = `monster-image-v1-${monsterId}-${size}-${silhouette ? 'silhouette' : 'normal'}`;
  if (scene.textures.exists(key)) {
    return key;
  }

  const sourceImage = scene.textures.get(asset.key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const sourceWidth = sourceImage.width;
  const sourceHeight = sourceImage.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  // Phaser内の既存アニメーションはscale=1を前提にしているため、サイズ別の固定テクスチャに焼き込みます。
  const textureSize = Math.ceil(size * 1.36);
  const maxDrawSize = size * 1.18;
  const scale = Math.min(maxDrawSize / sourceWidth, maxDrawSize / sourceHeight);
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);
  const drawX = Math.round((textureSize - drawWidth) / 2);
  const drawY = Math.round((textureSize - drawHeight) / 2);

  const canvasTexture = scene.textures.createCanvas(key, textureSize, textureSize);
  if (!canvasTexture) {
    return null;
  }

  const context = canvasTexture.context;
  context.clearRect(0, 0, textureSize, textureSize);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);

  if (silhouette) {
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = '#263143';
    context.fillRect(0, 0, textureSize, textureSize);
    context.globalCompositeOperation = 'source-over';
  }

  canvasTexture.refresh();
  return key;
}

/** レアや進化段階に応じて、追加装飾の段階を決めます。 */
function getVisualTier(monster: MonsterDefinition): number {
  if (monster.isRare) {
    return 3;
  }

  return Math.max(0, monster.evolutionStage - 1);
}

/** レアモンスターの背後に、光輪と影のような特別演出を描きます。 */
function drawRareAura(
  graphics: Phaser.GameObjects.Graphics,
  monster: MonsterDefinition,
  centerX: number,
  centerY: number,
  radius: number,
  silhouette: boolean,
): void {
  if (!monster.isRare) {
    return;
  }

  const accent = colorToNumber(silhouette ? '#263143' : monster.palette.accent);
  const shadow = colorToNumber(silhouette ? '#263143' : monster.palette.shadow);

  graphics.fillStyle(accent, silhouette ? 1 : 0.26);
  for (let index = 0; index < 10; index += 1) {
    const angle = (Math.PI * 2 * index) / 10;
    const inner = radius * 0.86;
    const outer = radius * (index % 2 === 0 ? 1.14 : 1);
    graphics.fillTriangle(
      centerX + Math.cos(angle - 0.12) * inner,
      centerY + Math.sin(angle - 0.12) * inner,
      centerX + Math.cos(angle) * outer,
      centerY + Math.sin(angle) * outer,
      centerX + Math.cos(angle + 0.12) * inner,
      centerY + Math.sin(angle + 0.12) * inner,
    );
  }

  graphics.fillStyle(shadow, silhouette ? 1 : 0.18);
  graphics.fillEllipse(centerX, centerY + radius * 0.2, radius * 1.85, radius * 1.25);
}

/** 進化段階が高いモンスター用に、手足や胴体の追加ディテールを描きます。 */
function drawDetailedBody(
  graphics: Phaser.GameObjects.Graphics,
  monster: MonsterDefinition,
  centerX: number,
  centerY: number,
  radius: number,
  bodyColor: string,
  accentColor: string,
  shadowColor: string,
  silhouette: boolean,
  visualTier: number,
): void {
  const body = colorToNumber(bodyColor);
  const accent = colorToNumber(accentColor);
  const shadow = colorToNumber(shadowColor);
  const bodyWidth = radius * (visualTier >= 3 ? 1.06 : 0.92);
  const bodyHeight = radius * (visualTier >= 3 ? 1.08 : 0.9);
  const bodyY = centerY + radius * 0.36;

  graphics.fillStyle(shadow, silhouette ? 1 : 0.3);
  graphics.fillEllipse(centerX, centerY + radius * 0.9, radius * 1.22, radius * 0.28);

  if (visualTier >= 3) {
    graphics.fillStyle(accent, silhouette ? 1 : 0.58);
    graphics.fillTriangle(
      centerX - radius * 0.78,
      centerY + radius * 0.02,
      centerX - radius * 1.02,
      centerY + radius * 0.74,
      centerX - radius * 0.34,
      centerY + radius * 0.58,
    );
    graphics.fillTriangle(
      centerX + radius * 0.78,
      centerY + radius * 0.02,
      centerX + radius * 1.02,
      centerY + radius * 0.74,
      centerX + radius * 0.34,
      centerY + radius * 0.58,
    );
  }

  graphics.fillStyle(body, 1);
  graphics.fillEllipse(centerX, bodyY, bodyWidth, bodyHeight);
  graphics.strokeEllipse(centerX, bodyY, bodyWidth, bodyHeight);

  graphics.fillStyle(body, 1);
  graphics.fillEllipse(centerX - radius * 0.52, centerY + radius * 0.28, radius * 0.32, radius * 0.52);
  graphics.strokeEllipse(centerX - radius * 0.52, centerY + radius * 0.28, radius * 0.32, radius * 0.52);
  graphics.fillEllipse(centerX + radius * 0.52, centerY + radius * 0.28, radius * 0.32, radius * 0.52);
  graphics.strokeEllipse(centerX + radius * 0.52, centerY + radius * 0.28, radius * 0.32, radius * 0.52);

  graphics.fillEllipse(centerX - radius * 0.26, centerY + radius * 0.82, radius * 0.42, radius * 0.24);
  graphics.strokeEllipse(centerX - radius * 0.26, centerY + radius * 0.82, radius * 0.42, radius * 0.24);
  graphics.fillEllipse(centerX + radius * 0.26, centerY + radius * 0.82, radius * 0.42, radius * 0.24);
  graphics.strokeEllipse(centerX + radius * 0.26, centerY + radius * 0.82, radius * 0.42, radius * 0.24);

  if (!silhouette) {
    graphics.fillStyle(accent, 0.72);
    graphics.fillEllipse(centerX, bodyY + radius * 0.04, bodyWidth * 0.46, bodyHeight * 0.46);
  }

  if (visualTier >= 2) {
    graphics.fillStyle(accent, silhouette ? 1 : 0.95);
    graphics.fillCircle(centerX, bodyY - radius * 0.1, radius * 0.12);
    graphics.fillCircle(centerX, bodyY + radius * 0.18, radius * 0.09);
  }

  if (monster.isRare) {
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(centerX, bodyY + radius * 0.02, radius * 0.18);
    graphics.fillStyle(shadow, silhouette ? 1 : 0.38);
    graphics.fillCircle(centerX, bodyY + radius * 0.02, radius * 0.08);
  }
}

/** モンスターの基本シルエットを、shapeごとの図形で描き分けます。 */
function drawShape(
  graphics: Phaser.GameObjects.Graphics,
  shape: MonsterDefinition['shape'],
  centerX: number,
  centerY: number,
  radius: number,
  bodyColor: string,
  accentColor: string,
  silhouette: boolean,
): void {
  const body = colorToNumber(bodyColor);
  const accent = colorToNumber(accentColor);

  graphics.fillStyle(body, 1);

  if (shape === 'sprout') {
    graphics.fillCircle(centerX, centerY + 6, radius * 0.72);
    graphics.strokeCircle(centerX, centerY + 6, radius * 0.72);
    graphics.fillStyle(accent, 1);
    graphics.fillEllipse(centerX - radius * 0.26, centerY - radius * 0.58, radius * 0.58, radius * 0.36);
    graphics.strokeEllipse(centerX - radius * 0.26, centerY - radius * 0.58, radius * 0.58, radius * 0.36);
    graphics.fillEllipse(centerX + radius * 0.28, centerY - radius * 0.52, radius * 0.62, radius * 0.36);
    graphics.strokeEllipse(centerX + radius * 0.28, centerY - radius * 0.52, radius * 0.62, radius * 0.36);
    return;
  }

  if (shape === 'puff') {
    graphics.fillCircle(centerX - radius * 0.3, centerY - radius * 0.1, radius * 0.42);
    graphics.fillCircle(centerX + radius * 0.3, centerY - radius * 0.1, radius * 0.42);
    graphics.fillCircle(centerX, centerY + radius * 0.14, radius * 0.56);
    graphics.strokeCircle(centerX, centerY + radius * 0.14, radius * 0.56);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(centerX + radius * 0.42, centerY - radius * 0.52, radius * 0.18);
    return;
  }

  if (shape === 'rabbit') {
    graphics.fillEllipse(centerX, centerY + radius * 0.12, radius * 1.1, radius * 0.95);
    graphics.strokeEllipse(centerX, centerY + radius * 0.12, radius * 1.1, radius * 0.95);
    graphics.fillTriangle(centerX - radius * 0.52, centerY - radius * 0.1, centerX - radius * 0.24, centerY - radius * 0.92, centerX - radius * 0.02, centerY - radius * 0.08);
    graphics.fillTriangle(centerX + radius * 0.52, centerY - radius * 0.1, centerX + radius * 0.24, centerY - radius * 0.92, centerX + radius * 0.02, centerY - radius * 0.08);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(centerX + radius * 0.45, centerY + radius * 0.18, radius * 0.16);
    return;
  }

  if (shape === 'snowball') {
    graphics.fillCircle(centerX, centerY + radius * 0.12, radius * 0.68);
    graphics.strokeCircle(centerX, centerY + radius * 0.12, radius * 0.68);
    graphics.fillStyle(accent, 1);
    graphics.fillEllipse(centerX, centerY - radius * 0.42, radius * 0.92, radius * 0.32);
    graphics.strokeEllipse(centerX, centerY - radius * 0.42, radius * 0.92, radius * 0.32);
    return;
  }

  if (shape === 'crystal') {
    const topX = centerX;
    const topY = centerY - radius * 0.82;
    const rightX = centerX + radius * 0.56;
    const rightY = centerY - radius * 0.08;
    const bottomRightX = centerX + radius * 0.28;
    const bottomRightY = centerY + radius * 0.72;
    const bottomLeftX = centerX - radius * 0.34;
    const bottomLeftY = centerY + radius * 0.72;
    const leftX = centerX - radius * 0.56;
    const leftY = centerY - radius * 0.08;

    graphics.fillTriangle(topX, topY, rightX, rightY, bottomRightX, bottomRightY);
    graphics.fillTriangle(topX, topY, bottomRightX, bottomRightY, bottomLeftX, bottomLeftY);
    graphics.fillTriangle(topX, topY, bottomLeftX, bottomLeftY, leftX, leftY);
    graphics.lineBetween(topX, topY, rightX, rightY);
    graphics.lineBetween(rightX, rightY, bottomRightX, bottomRightY);
    graphics.lineBetween(bottomRightX, bottomRightY, bottomLeftX, bottomLeftY);
    graphics.lineBetween(bottomLeftX, bottomLeftY, leftX, leftY);
    graphics.lineBetween(leftX, leftY, topX, topY);
    if (!silhouette) {
      graphics.fillStyle(accent, 0.55);
      graphics.fillTriangle(centerX, centerY - radius * 0.7, centerX + radius * 0.3, centerY, centerX, centerY + radius * 0.55);
    }
    return;
  }

  if (shape === 'seal') {
    graphics.fillEllipse(centerX, centerY + radius * 0.14, radius * 1.14, radius * 0.82);
    graphics.strokeEllipse(centerX, centerY + radius * 0.14, radius * 1.14, radius * 0.82);
    graphics.fillStyle(accent, 1);
    graphics.fillTriangle(centerX - radius * 0.48, centerY + radius * 0.38, centerX - radius * 0.86, centerY + radius * 0.62, centerX - radius * 0.46, centerY + radius * 0.02);
    graphics.fillTriangle(centerX + radius * 0.48, centerY + radius * 0.38, centerX + radius * 0.86, centerY + radius * 0.62, centerX + radius * 0.46, centerY + radius * 0.02);
    return;
  }

  if (shape === 'ember') {
    graphics.fillCircle(centerX, centerY + radius * 0.2, radius * 0.58);
    graphics.strokeCircle(centerX, centerY + radius * 0.2, radius * 0.58);
    graphics.fillStyle(accent, 1);
    graphics.fillTriangle(centerX, centerY - radius * 0.86, centerX + radius * 0.42, centerY + radius * 0.08, centerX - radius * 0.42, centerY + radius * 0.08);
    return;
  }

  if (shape === 'spark') {
    graphics.fillTriangle(centerX, centerY - radius * 0.86, centerX + radius * 0.62, centerY + radius * 0.1, centerX + radius * 0.16, centerY + radius * 0.1);
    graphics.fillTriangle(centerX, centerY + radius * 0.82, centerX - radius * 0.62, centerY - radius * 0.1, centerX - radius * 0.16, centerY - radius * 0.1);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(centerX, centerY, radius * 0.38);
    graphics.strokeCircle(centerX, centerY, radius * 0.38);
    return;
  }

  graphics.fillCircle(centerX, centerY + radius * 0.16, radius * 0.62);
  graphics.strokeCircle(centerX, centerY + radius * 0.16, radius * 0.62);
  graphics.fillStyle(accent, 1);
  graphics.fillCircle(centerX + radius * 0.28, centerY - radius * 0.32, radius * 0.22);
}

/** 進化段階やレア度に応じて、基本形状の上に飾りを追加します。 */
function drawShapeDecorations(
  graphics: Phaser.GameObjects.Graphics,
  monster: MonsterDefinition,
  centerX: number,
  centerY: number,
  radius: number,
  accentColor: string,
  shadowColor: string,
  silhouette: boolean,
  visualTier: number,
): void {
  if (visualTier === 0) {
    return;
  }

  const accent = colorToNumber(accentColor);
  const shadow = colorToNumber(shadowColor);
  const alpha = silhouette ? 1 : 0.95;

  graphics.fillStyle(accent, alpha);

  if (monster.shape === 'sprout') {
    graphics.fillEllipse(centerX, centerY - radius * 0.9, radius * 0.48, radius * 0.26);
    if (visualTier >= 2) {
      graphics.fillEllipse(centerX - radius * 0.55, centerY - radius * 0.3, radius * 0.36, radius * 0.2);
      graphics.fillEllipse(centerX + radius * 0.55, centerY - radius * 0.3, radius * 0.36, radius * 0.2);
    }
    return;
  }

  if (monster.shape === 'puff') {
    graphics.fillCircle(centerX - radius * 0.5, centerY - radius * 0.5, radius * 0.16);
    graphics.fillCircle(centerX + radius * 0.5, centerY - radius * 0.5, radius * 0.16);
    if (visualTier >= 2) {
      graphics.fillCircle(centerX, centerY - radius * 0.72, radius * 0.18);
    }
    return;
  }

  if (monster.shape === 'rabbit') {
    graphics.fillStyle(shadow, silhouette ? 1 : 0.55);
    graphics.fillEllipse(centerX - radius * 0.22, centerY - radius * 0.53, radius * 0.16, radius * 0.48);
    graphics.fillEllipse(centerX + radius * 0.22, centerY - radius * 0.53, radius * 0.16, radius * 0.48);
    if (visualTier >= 2 || monster.isRare) {
      graphics.fillStyle(accent, alpha);
      graphics.fillCircle(centerX, centerY - radius * 0.58, radius * 0.12);
    }
    return;
  }

  if (monster.shape === 'snowball') {
    graphics.fillEllipse(centerX, centerY - radius * 0.72, radius * 0.54, radius * 0.18);
    graphics.fillCircle(centerX - radius * 0.34, centerY - radius * 0.48, radius * 0.12);
    graphics.fillCircle(centerX + radius * 0.34, centerY - radius * 0.48, radius * 0.12);
    return;
  }

  if (monster.shape === 'crystal') {
    graphics.fillStyle(accent, silhouette ? 1 : 0.7);
    graphics.fillTriangle(centerX, centerY - radius * 1.02, centerX + radius * 0.18, centerY - radius * 0.6, centerX - radius * 0.18, centerY - radius * 0.6);
    if (visualTier >= 2 || monster.isRare) {
      graphics.fillTriangle(centerX - radius * 0.5, centerY - radius * 0.55, centerX - radius * 0.78, centerY - radius * 0.08, centerX - radius * 0.32, centerY - radius * 0.18);
      graphics.fillTriangle(centerX + radius * 0.5, centerY - radius * 0.55, centerX + radius * 0.78, centerY - radius * 0.08, centerX + radius * 0.32, centerY - radius * 0.18);
    }
    return;
  }

  if (monster.shape === 'seal') {
    graphics.fillStyle(accent, silhouette ? 1 : 0.8);
    graphics.fillEllipse(centerX, centerY - radius * 0.58, radius * 0.7, radius * 0.22);
    if (visualTier >= 2 || monster.isRare) {
      graphics.fillCircle(centerX - radius * 0.5, centerY - radius * 0.1, radius * 0.13);
      graphics.fillCircle(centerX + radius * 0.5, centerY - radius * 0.1, radius * 0.13);
    }
    return;
  }

  if (monster.shape === 'ember') {
    graphics.fillStyle(accent, 1);
    graphics.fillTriangle(centerX, centerY - radius * 1.18, centerX + radius * 0.26, centerY - radius * 0.56, centerX - radius * 0.26, centerY - radius * 0.56);
    if (visualTier >= 2 || monster.isRare) {
      graphics.fillStyle(shadow, silhouette ? 1 : 0.42);
      graphics.fillTriangle(centerX, centerY - radius * 0.98, centerX + radius * 0.12, centerY - radius * 0.62, centerX - radius * 0.12, centerY - radius * 0.62);
    }
    return;
  }

  if (monster.shape === 'spark') {
    graphics.fillStyle(accent, alpha);
    graphics.fillTriangle(centerX - radius * 0.72, centerY - radius * 0.55, centerX - radius * 0.34, centerY - radius * 0.12, centerX - radius * 0.62, centerY - radius * 0.1);
    graphics.fillTriangle(centerX + radius * 0.72, centerY + radius * 0.55, centerX + radius * 0.34, centerY + radius * 0.12, centerX + radius * 0.62, centerY + radius * 0.1);
    return;
  }

  graphics.fillStyle(accent, silhouette ? 1 : 0.78);
  graphics.fillRoundedRect(centerX - radius * 0.44, centerY - radius * 0.78, radius * 0.88, radius * 0.18, radius * 0.08);
  if (visualTier >= 2 || monster.isRare) {
    graphics.fillCircle(centerX - radius * 0.34, centerY - radius * 0.32, radius * 0.1);
    graphics.fillCircle(centerX + radius * 0.34, centerY - radius * 0.32, radius * 0.1);
  }
}

/** レアモンスター固有の飾りを、前面または背面レイヤーとして描きます。 */
function drawRareSignatureParts(
  graphics: Phaser.GameObjects.Graphics,
  monster: MonsterDefinition,
  centerX: number,
  centerY: number,
  radius: number,
  bodyColor: string,
  accentColor: string,
  shadowColor: string,
  silhouette: boolean,
  layer: 'back' | 'front',
): void {
  if (!monster.isRare) {
    return;
  }

  const body = colorToNumber(bodyColor);
  const accent = colorToNumber(accentColor);
  const shadow = colorToNumber(shadowColor);
  const light = colorToNumber(silhouette ? '#263143' : COLORS.panel);

  if (monster.id === 'sunomaru') {
    if (layer === 'back') {
      graphics.fillStyle(accent, 1);
      graphics.fillTriangle(centerX - radius * 0.46, centerY - radius * 0.58, centerX - radius * 0.72, centerY - radius * 1.08, centerX - radius * 0.22, centerY - radius * 0.74);
      graphics.fillTriangle(centerX + radius * 0.46, centerY - radius * 0.58, centerX + radius * 0.72, centerY - radius * 1.08, centerX + radius * 0.22, centerY - radius * 0.74);
      graphics.fillEllipse(centerX, centerY + radius * 0.78, radius * 1.1, radius * 0.26);
      return;
    }

    graphics.fillStyle(light, silhouette ? 1 : 0.92);
    drawStar(graphics, centerX, centerY - radius * 0.36, radius * 0.2, radius * 0.08);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(centerX - radius * 0.56, centerY + radius * 0.08, radius * 0.1);
    graphics.fillCircle(centerX + radius * 0.56, centerY + radius * 0.08, radius * 0.1);
    return;
  }

  if (monster.id === 'achichin') {
    if (layer === 'back') {
      graphics.fillStyle(accent, 1);
      graphics.fillTriangle(centerX + radius * 0.5, centerY + radius * 0.36, centerX + radius * 1.18, centerY - radius * 0.12, centerX + radius * 0.76, centerY + radius * 0.78);
      graphics.fillStyle(shadow, silhouette ? 1 : 0.45);
      graphics.fillTriangle(centerX + radius * 0.62, centerY + radius * 0.34, centerX + radius * 0.98, centerY + radius * 0.02, centerX + radius * 0.78, centerY + radius * 0.58);
      return;
    }

    graphics.fillStyle(accent, 1);
    graphics.fillTriangle(centerX - radius * 0.4, centerY - radius * 0.56, centerX - radius * 0.58, centerY - radius * 1.1, centerX - radius * 0.12, centerY - radius * 0.72);
    graphics.fillTriangle(centerX + radius * 0.4, centerY - radius * 0.56, centerX + radius * 0.58, centerY - radius * 1.1, centerX + radius * 0.12, centerY - radius * 0.72);
    graphics.lineStyle(2, shadow, silhouette ? 1 : 0.7);
    graphics.lineBetween(centerX - radius * 0.22, centerY + radius * 0.2, centerX - radius * 0.05, centerY + radius * 0.52);
    graphics.lineBetween(centerX + radius * 0.18, centerY + radius * 0.14, centerX + radius * 0.02, centerY + radius * 0.48);
    return;
  }

  if (monster.id === 'goropeka') {
    if (layer === 'back') {
      graphics.lineStyle(Math.max(3, radius * 0.12), accent, 1);
      graphics.lineBetween(centerX - radius * 0.84, centerY - radius * 0.28, centerX - radius * 1.14, centerY + radius * 0.04);
      graphics.lineBetween(centerX - radius * 1.14, centerY + radius * 0.04, centerX - radius * 0.88, centerY + radius * 0.16);
      graphics.lineBetween(centerX + radius * 0.84, centerY - radius * 0.28, centerX + radius * 1.14, centerY + radius * 0.04);
      graphics.lineBetween(centerX + radius * 1.14, centerY + radius * 0.04, centerX + radius * 0.88, centerY + radius * 0.16);
      return;
    }

    graphics.fillStyle(accent, 1);
    graphics.fillTriangle(centerX, centerY - radius * 1.18, centerX + radius * 0.18, centerY - radius * 0.62, centerX - radius * 0.1, centerY - radius * 0.62);
    graphics.fillTriangle(centerX + radius * 0.1, centerY - radius * 0.82, centerX + radius * 0.42, centerY - radius * 0.42, centerX + radius * 0.02, centerY - radius * 0.48);
    return;
  }

  if (monster.id === 'mizukira') {
    if (layer === 'back') {
      graphics.fillStyle(accent, silhouette ? 1 : 0.72);
      graphics.fillTriangle(centerX - radius * 0.62, centerY + radius * 0.1, centerX - radius * 1.08, centerY - radius * 0.18, centerX - radius * 0.74, centerY + radius * 0.62);
      graphics.fillTriangle(centerX + radius * 0.62, centerY + radius * 0.1, centerX + radius * 1.08, centerY - radius * 0.18, centerX + radius * 0.74, centerY + radius * 0.62);
      return;
    }

    graphics.fillStyle(light, silhouette ? 1 : 0.88);
    graphics.fillEllipse(centerX, centerY - radius * 0.78, radius * 0.34, radius * 0.52);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(centerX, centerY - radius * 0.3, radius * 0.12);
    return;
  }

  if (monster.id === 'hoshimimi') {
    if (layer === 'back') {
      graphics.fillStyle(accent, 1);
      graphics.fillTriangle(centerX - radius * 0.44, centerY - radius * 0.34, centerX - radius * 0.86, centerY - radius * 1.24, centerX - radius * 0.14, centerY - radius * 0.68);
      graphics.fillTriangle(centerX + radius * 0.44, centerY - radius * 0.34, centerX + radius * 0.86, centerY - radius * 1.24, centerX + radius * 0.14, centerY - radius * 0.68);
      return;
    }

    graphics.fillStyle(light, silhouette ? 1 : 0.95);
    drawStar(graphics, centerX - radius * 0.78, centerY - radius * 1.08, radius * 0.18, radius * 0.07);
    drawStar(graphics, centerX + radius * 0.78, centerY - radius * 1.08, radius * 0.18, radius * 0.07);
    graphics.lineStyle(3, accent, silhouette ? 1 : 0.82);
    graphics.arc(centerX, centerY - radius * 0.44, radius * 0.44, Math.PI * 0.18, Math.PI * 0.82, false);
    return;
  }

  if (monster.id === 'rainbow') {
    if (layer === 'back') {
      graphics.lineStyle(Math.max(3, radius * 0.12), accent, silhouette ? 1 : 0.7);
      graphics.arc(centerX, centerY + radius * 0.2, radius * 1.04, Math.PI * 1.08, Math.PI * 1.92, false);
      graphics.lineStyle(Math.max(2, radius * 0.08), body, silhouette ? 1 : 0.62);
      graphics.arc(centerX, centerY + radius * 0.22, radius * 0.84, Math.PI * 1.08, Math.PI * 1.92, false);
      return;
    }

    graphics.fillStyle(accent, 1);
    graphics.fillRoundedRect(centerX - radius * 0.36, centerY - radius * 1.02, radius * 0.72, radius * 0.24, radius * 0.1);
    graphics.fillStyle(light, silhouette ? 1 : 0.9);
    graphics.fillCircle(centerX - radius * 0.16, centerY - radius * 0.9, radius * 0.07);
    graphics.fillCircle(centerX + radius * 0.16, centerY - radius * 0.9, radius * 0.07);
    return;
  }

  if (monster.id === 'komorebi') {
    if (layer === 'back') {
      graphics.lineStyle(4, shadow, 1);
      graphics.lineBetween(centerX - radius * 0.34, centerY - radius * 0.58, centerX - radius * 0.78, centerY - radius * 1.1);
      graphics.lineBetween(centerX + radius * 0.34, centerY - radius * 0.58, centerX + radius * 0.78, centerY - radius * 1.1);
      graphics.fillStyle(accent, 1);
      graphics.fillEllipse(centerX - radius * 0.86, centerY - radius * 1.04, radius * 0.34, radius * 0.18);
      graphics.fillEllipse(centerX + radius * 0.86, centerY - radius * 1.04, radius * 0.34, radius * 0.18);
      return;
    }

    graphics.fillStyle(light, silhouette ? 1 : 0.75);
    graphics.fillCircle(centerX - radius * 0.3, centerY - radius * 0.28, radius * 0.1);
    graphics.fillCircle(centerX + radius * 0.28, centerY - radius * 0.38, radius * 0.08);
    graphics.fillStyle(accent, silhouette ? 1 : 0.9);
    graphics.fillEllipse(centerX, centerY + radius * 0.22, radius * 0.62, radius * 0.18);
    return;
  }

  if (monster.id === 'kiramekisama') {
    if (layer === 'back') {
      graphics.fillStyle(accent, silhouette ? 1 : 0.82);
      graphics.fillTriangle(centerX - radius * 0.6, centerY - radius * 0.24, centerX - radius * 1.04, centerY - radius * 0.82, centerX - radius * 0.32, centerY - radius * 0.58);
      graphics.fillTriangle(centerX + radius * 0.6, centerY - radius * 0.24, centerX + radius * 1.04, centerY - radius * 0.82, centerX + radius * 0.32, centerY - radius * 0.58);
      return;
    }

    graphics.fillStyle(light, silhouette ? 1 : 0.86);
    graphics.fillTriangle(centerX, centerY - radius * 1.2, centerX + radius * 0.22, centerY - radius * 0.62, centerX - radius * 0.22, centerY - radius * 0.62);
    graphics.fillStyle(accent, 1);
    drawStar(graphics, centerX, centerY - radius * 0.22, radius * 0.18, radius * 0.07);
  }
}

/** 五芒星を、外側と内側の半径を交互に使って描きます。 */
function drawStar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
): void {
  graphics.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (Math.PI * index) / 5;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (index === 0) {
      graphics.moveTo(pointX, pointY);
      continue;
    }

    graphics.lineTo(pointX, pointY);
  }
  graphics.closePath();
  graphics.fillPath();
}

/** モンスターの目と口を、基本形状の上に描きます。 */
function drawFace(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  graphics.fillStyle(colorToNumber(COLORS.ink), 1);
  graphics.fillCircle(centerX - radius * 0.2, centerY + radius * 0.08, radius * 0.055);
  graphics.fillCircle(centerX + radius * 0.2, centerY + radius * 0.08, radius * 0.055);
  graphics.lineStyle(2, colorToNumber(COLORS.ink), 1);
  graphics.arc(centerX, centerY + radius * 0.2, radius * 0.16, 0, Math.PI, false);
}
