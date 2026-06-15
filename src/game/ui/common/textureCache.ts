import * as Phaser from 'phaser';

interface RoundedRectTextureOptions {
  width: number;
  height: number;
  radius: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fillAlpha?: number;
  strokeAlpha?: number;
}

interface GameButtonTextureOptions {
  width: number;
  height: number;
  radius: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  disabled?: boolean;
  pressed?: boolean;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/** テクスチャキーに使えるよう、カラー文字列から記号を取り除きます。 */
function colorKey(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, '');
}

/** CSSカラー文字列を、Phaserの数値カラーへ変換します。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** 3桁/6桁のHEXカラーを6桁形式にそろえ、不正なら代替色を返します。 */
function normalizeHexColor(color: string, fallback: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  const shorthandMatch = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (!shorthandMatch) {
    return fallback;
  }

  return `#${shorthandMatch[1]}${shorthandMatch[1]}${shorthandMatch[2]}${shorthandMatch[2]}${shorthandMatch[3]}${shorthandMatch[3]}`;
}

/** HEXカラーをRGBの数値へ分解します。 */
function hexToRgb(color: string, fallback = '#ffd766'): RgbColor {
  const normalized = normalizeHexColor(color, fallback);
  const parsed = Phaser.Display.Color.HexStringToColor(normalized);
  return {
    red: parsed.red,
    green: parsed.green,
    blue: parsed.blue,
  };
}

/** RGBの数値を、6桁のHEXカラー文字列へ戻します。 */
function rgbToHex(color: RgbColor): string {
  const toHexPart = (value: number): string => Phaser.Math.Clamp(Math.round(value), 0, 255)
    .toString(16)
    .padStart(2, '0');
  return `#${toHexPart(color.red)}${toHexPart(color.green)}${toHexPart(color.blue)}`;
}

/** 2つの色を指定割合で混ぜ、グラデーションや影色を作ります。 */
function mixColor(color: string, target: string, amount: number): string {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  const ratio = Phaser.Math.Clamp(amount, 0, 1);
  return rgbToHex({
    red: sourceRgb.red + (targetRgb.red - sourceRgb.red) * ratio,
    green: sourceRgb.green + (targetRgb.green - sourceRgb.green) * ratio,
    blue: sourceRgb.blue + (targetRgb.blue - sourceRgb.blue) * ratio,
  });
}

/** HEXカラーと透明度から、Canvasで使うrgba文字列を作ります。 */
function rgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${Phaser.Math.Clamp(alpha, 0, 1)})`;
}

/** 明るすぎるボタン色を少し濃くし、立体感が出る基準色を決めます。 */
function getButtonBaseColor(fillColor: string): string {
  const normalized = normalizeHexColor(fillColor, '#ffd766');
  const rgb = hexToRgb(normalized);
  const brightness = (rgb.red + rgb.green + rgb.blue) / 3;
  return brightness > 244 ? '#ffc942' : normalized;
}

/** Canvas上で角丸矩形のパスを作ります。 */
function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

/** 角丸矩形パスを作って塗りつぶします。 */
function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.fill();
}

/** 角丸矩形パスを作って線だけ描きます。 */
function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}

/** 静的な角丸矩形をテクスチャ化し、同じ見た目のボタン背景を再利用します。 */
export function getRoundedRectTexture(
  scene: Phaser.Scene,
  options: RoundedRectTextureOptions,
): string {
  const key = [
    'roundedRect',
    options.width,
    options.height,
    options.radius,
    options.strokeWidth,
    colorKey(options.fillColor),
    colorKey(options.strokeColor),
    options.fillAlpha ?? 1,
    options.strokeAlpha ?? 1,
  ].join('-');

  if (scene.textures.exists(key)) {
    return key;
  }

  const graphics = scene.add.graphics();
  const inset = options.strokeWidth / 2;
  graphics.fillStyle(colorToNumber(options.fillColor), options.fillAlpha ?? 1);
  graphics.lineStyle(
    options.strokeWidth,
    colorToNumber(options.strokeColor),
    options.strokeAlpha ?? 1,
  );
  graphics.fillRoundedRect(
    inset,
    inset,
    options.width - options.strokeWidth,
    options.height - options.strokeWidth,
    options.radius,
  );
  graphics.strokeRoundedRect(
    inset,
    inset,
    options.width - options.strokeWidth,
    options.height - options.strokeWidth,
    options.radius,
  );
  graphics.generateTexture(key, options.width, options.height);
  graphics.destroy();

  return key;
}

/** 立体感のあるゲーム用ボタン背景をCanvasテクスチャとして作り、同じ条件なら再利用します。 */
export function getGameButtonTexture(scene: Phaser.Scene, options: GameButtonTextureOptions): string {
  const key = [
    'gameButton',
    options.width,
    options.height,
    options.radius,
    options.strokeWidth,
    colorKey(options.fillColor),
    colorKey(options.strokeColor),
    options.disabled ? 'disabled' : 'enabled',
    options.pressed ? 'pressed' : 'normal',
  ].join('-');

  if (scene.textures.exists(key)) {
    return key;
  }

  const texture = scene.textures.createCanvas(key, options.width, options.height);
  if (!texture) {
    return getRoundedRectTexture(scene, {
      width: options.width,
      height: options.height,
      radius: options.radius,
      fillColor: options.fillColor,
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      fillAlpha: options.disabled ? 0.5 : 1,
      strokeAlpha: options.disabled ? 0.35 : 1,
    });
  }

  const context = texture.getContext();
  const baseColor = getButtonBaseColor(options.fillColor);
  const strokeColor = normalizeHexColor(options.strokeColor, '#b52a24');
  const yOffset = options.pressed ? 2 : 0;
  const outerX = 2;
  const outerY = 1 + yOffset;
  const outerWidth = options.width - 4;
  const outerHeight = options.height - 6;
  const innerInset = Math.max(3, options.strokeWidth);
  const innerX = outerX + innerInset;
  const innerY = outerY + innerInset;
  const innerWidth = outerWidth - innerInset * 2;
  const innerHeight = outerHeight - innerInset * 2;
  const innerRadius = Math.max(4, options.radius - innerInset);
  const topColor = mixColor(baseColor, '#ffffff', options.pressed ? 0.3 : 0.48);
  const middleColor = mixColor(baseColor, '#fff3a1', options.pressed ? 0.12 : 0.22);
  const bottomColor = mixColor(baseColor, options.pressed ? '#a63a24' : '#f05b22', options.pressed ? 0.38 : 0.24);

  context.clearRect(0, 0, options.width, options.height);
  context.save();
  context.fillStyle = rgba(strokeColor, options.disabled ? 0.22 : 0.34);
  fillRoundedRect(context, outerX + 1, outerY + 4, outerWidth - 2, outerHeight, options.radius);

  context.fillStyle = rgba(strokeColor, options.disabled ? 0.44 : 1);
  fillRoundedRect(context, outerX, outerY, outerWidth, outerHeight, options.radius);

  const gradient = context.createLinearGradient(0, innerY, 0, innerY + innerHeight);
  gradient.addColorStop(0, options.disabled ? mixColor(baseColor, '#ffffff', 0.62) : topColor);
  gradient.addColorStop(0.48, options.disabled ? mixColor(baseColor, '#ffffff', 0.46) : middleColor);
  gradient.addColorStop(1, options.disabled ? mixColor(baseColor, '#88909a', 0.18) : bottomColor);
  context.fillStyle = gradient;
  fillRoundedRect(context, innerX, innerY, innerWidth, innerHeight, innerRadius);

  context.save();
  roundedRectPath(context, innerX, innerY, innerWidth, innerHeight, innerRadius);
  context.clip();
  context.fillStyle = rgba(mixColor(bottomColor, '#8a1f1c', 0.42), options.disabled ? 0.08 : 0.2);
  context.fillRect(innerX, innerY + innerHeight * 0.66, innerWidth, innerHeight * 0.36);
  context.fillStyle = rgba('#ffffff', options.disabled ? 0.24 : 0.58);
  fillRoundedRect(
    context,
    innerX + Math.max(6, innerWidth * 0.08),
    innerY + 4,
    innerWidth * 0.56,
    Math.max(5, innerHeight * 0.18),
    Math.max(3, innerRadius * 0.55),
  );
  context.restore();

  context.lineWidth = 2;
  context.strokeStyle = rgba('#ffffff', options.disabled ? 0.2 : 0.62);
  strokeRoundedRect(context, innerX + 2, innerY + 2, innerWidth - 4, innerHeight - 5, Math.max(3, innerRadius - 2));

  if (options.width >= 70 && options.height >= 36) {
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = rgba('#ffffff', options.disabled ? 0.22 : 0.72);
    context.beginPath();
    context.moveTo(innerX + 10, innerY + 9);
    context.lineTo(innerX + Math.min(34, innerWidth * 0.28), innerY + 9);
    context.stroke();
  }

  context.lineWidth = options.strokeWidth;
  context.strokeStyle = rgba(strokeColor, options.disabled ? 0.35 : 1);
  strokeRoundedRect(
    context,
    outerX + options.strokeWidth / 2,
    outerY + options.strokeWidth / 2,
    outerWidth - options.strokeWidth,
    outerHeight - options.strokeWidth,
    Math.max(4, options.radius - options.strokeWidth / 2),
  );

  context.restore();
  texture.refresh();

  return key;
}
