import * as Phaser from 'phaser';
import { getTitleBackgroundTextureKey, TitleBackgroundDefinition } from '../../../data/titleBackgrounds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT, TITLE_MONSTER_PLACEMENT_BOUNDS } from '../../layoutConfig';

/** CSSカラー文字列を、Phaserの描画で使う数値カラーへ変換します。 */
function color(colorText: string): number {
  return Phaser.Display.Color.HexStringToColor(colorText).color;
}

interface TitleBackgroundPreviewOptions {
  cropToPlacementArea?: boolean;
}

/** タイトル画面いっぱいに背景画像を敷き、文字が読める薄い白い面を重ねます。 */
export function drawTitleBackgroundArt(
  scene: Phaser.Scene,
  background: TitleBackgroundDefinition,
): void {
  if (!scene.textures.exists(getTitleBackgroundTextureKey(background))) {
    drawImageFallback(scene, background, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0);
    return;
  }

  const image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, getTitleBackgroundTextureKey(background));
  const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const scale = Math.max(GAME_WIDTH / source.width, GAME_HEIGHT / source.height);
  image.setScale(scale);
  image.setDepth(0);

  const overlay = scene.add.graphics();
  overlay.fillStyle(color('#ffffff'), 0.12);
  const topWash = APP_LAYOUT.title.backgroundTopWash;
  overlay.fillRect(topWash.x, topWash.y, topWash.width, topWash.height);
  overlay.fillStyle(color('#ffffff'), 0.1);
  const titlePanel = APP_LAYOUT.title.titleReadabilityPanel;
  overlay.fillRoundedRect(
    titlePanel.x,
    titlePanel.y,
    titlePanel.width,
    titlePanel.height,
    titlePanel.radius,
  );
  overlay.setDepth(1);
}

/** ショップや編集画面で使う、タイトル背景の小さなプレビューを描きます。 */
export function drawTitleBackgroundPreview(
  scene: Phaser.Scene,
  background: TitleBackgroundDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
  options: TitleBackgroundPreviewOptions = {},
): void {
  if (scene.textures.exists(getTitleBackgroundTextureKey(background))) {
    if (options.cropToPlacementArea) {
      drawPlacementImagePreview(scene, background, x, y, width, height);
    } else {
      drawFullImagePreview(scene, background, x, y, width, height);
    }
  } else {
    drawImageFallback(scene, background, x, y, width, height, APP_LAYOUT.titleBackground.previewRadius);
  }

  const graphics = scene.add.graphics();
  graphics.lineStyle(2, color(background.accentColor), 0.8);
  graphics.strokeRoundedRect(
    x - width / 2,
    y - height / 2,
    width,
    height,
    APP_LAYOUT.titleBackground.previewRadius,
  );
}

/** 背景画像全体を、指定されたプレビュー枠にトリミングして描きます。 */
function drawFullImagePreview(
  scene: Phaser.Scene,
  background: TitleBackgroundDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const image = scene.add.image(x, y, getTitleBackgroundTextureKey(background));
  const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    image.setDisplaySize(width, height);
    return;
  }

  const targetAspect = width / height;
  const sourceAspect = sourceWidth / sourceHeight;
  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceAspect > targetAspect) {
    cropWidth = sourceHeight * targetAspect;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetAspect;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  image.setCrop(cropX, cropY, cropWidth, cropHeight);
  image.setScale(width / cropWidth, height / cropHeight);
}

/** タイトルモンスターを置ける範囲を中心に、背景画像を切り出して描きます。 */
function drawPlacementImagePreview(
  scene: Phaser.Scene,
  background: TitleBackgroundDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const image = scene.add.image(x, y, getTitleBackgroundTextureKey(background));
  const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (sourceWidth > 0 && sourceHeight > 0) {
    const fullScale = Math.max(GAME_WIDTH / sourceWidth, GAME_HEIGHT / sourceHeight);
    const displayWidth = sourceWidth * fullScale;
    const displayHeight = sourceHeight * fullScale;
    const offsetX = GAME_WIDTH / 2 - displayWidth / 2;
    const offsetY = GAME_HEIGHT / 2 - displayHeight / 2;
    const cropX = Phaser.Math.Clamp((TITLE_MONSTER_PLACEMENT_BOUNDS.minX - offsetX) / fullScale, 0, sourceWidth);
    const cropY = Phaser.Math.Clamp((TITLE_MONSTER_PLACEMENT_BOUNDS.minY - offsetY) / fullScale, 0, sourceHeight);
    const cropWidth = Phaser.Math.Clamp(
      (TITLE_MONSTER_PLACEMENT_BOUNDS.maxX - TITLE_MONSTER_PLACEMENT_BOUNDS.minX) / fullScale,
      1,
      sourceWidth - cropX,
    );
    const cropHeight = Phaser.Math.Clamp(
      (TITLE_MONSTER_PLACEMENT_BOUNDS.maxY - TITLE_MONSTER_PLACEMENT_BOUNDS.minY) / fullScale,
      1,
      sourceHeight - cropY,
    );
    image.setCrop(
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    );
    image.setScale(width / cropWidth, height / cropHeight);
    return;
  }
  image.setDisplaySize(width, height);
}

/** 背景画像がない場合に、色と楕円だけで代替プレビューを描きます。 */
function drawImageFallback(
  scene: Phaser.Scene,
  background: TitleBackgroundDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const left = x - width / 2;
  const top = y - height / 2;
  const graphics = scene.add.graphics();
  graphics.fillStyle(color(background.skyColor), 1);
  if (radius > 0) {
    graphics.fillRoundedRect(left, top, width, height, radius);
  } else {
    graphics.fillRect(left, top, width, height);
  }
  graphics.fillStyle(color(background.accentColor), 0.36);
  graphics.fillEllipse(x, top + height * 0.78, width * 0.92, height * 0.42);
}
