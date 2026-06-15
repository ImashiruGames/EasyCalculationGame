import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import { storyCreatorActorChoices, StoryCreatorActorChoice } from '../../../data/storyCreatorActors';
import { getTrainerImageAsset } from '../../assets/trainerImageAssets';
import { COLORS, FONT_FAMILY } from '../../constants';
import { createMonsterVisual } from '../creatures/monsterVisual';
import { parseStoryMathExpression, StoryMathExpressionNode } from './mathExpression';

type RichTextAlign = 'left' | 'center' | 'right';
type RichTextMotion = 'none' | 'bounce' | 'sway' | 'twitch' | 'slide';
type RichTextEffect = 'none' | 'glow' | 'shrink' | 'grow' | 'silhouette';
type TweenableRichTextObject = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  setScale: (x: number, y?: number) => Phaser.GameObjects.GameObject;
  setAlpha: (value: number) => Phaser.GameObjects.GameObject;
};

interface RichTextOptions {
  width: number;
  fontSize: number;
  fontStyle?: string;
  color?: string;
  lineSpacing?: number;
  align?: RichTextAlign;
  depth?: number;
}

interface RichTextToken {
  object: Phaser.GameObjects.GameObject;
  width: number;
  height: number;
  contentTop?: number;
}

interface RichTextRow {
  tokens: RichTextToken[];
  width: number;
  height: number;
  contentTop: number;
  contentBottom: number;
}

interface RichTextStyleState {
  color: string;
  fontStyle: string;
  fontFamily: string;
  underline: boolean;
  motion: RichTextMotion;
  effect: RichTextEffect;
}

interface RichTextCommand {
  name: string;
  args: string[];
  rawArgs: string;
}

const RICH_TEXT_COLOR_NAMES: Record<string, string> = {
  red: '#b52a24',
  blue: '#2364aa',
  green: '#2f9f61',
  yellow: '#b8941e',
  black: COLORS.ink,
  white: '#ffffff',
  ink: COLORS.ink,
  muted: COLORS.muted,
  water: COLORS.water,
  panel: COLORS.panel,
  あか: '#b52a24',
  あお: '#2364aa',
  みどり: '#2f9f61',
  きいろ: '#b8941e',
  くろ: COLORS.ink,
  しろ: '#ffffff',
};

const RICH_TEXT_MOTION_NAMES: Record<string, RichTextMotion> = {
  none: 'none',
  bounce: 'bounce',
  jump: 'bounce',
  sway: 'sway',
  shake: 'sway',
  twitch: 'twitch',
  jerk: 'twitch',
  slide: 'slide',
  slip: 'slide',
  なし: 'none',
  はねる: 'bounce',
  ぴょん: 'bounce',
  ゆれる: 'sway',
  ゆら: 'sway',
  揺れる: 'sway',
  ビク: 'twitch',
  びく: 'twitch',
  びくっと: 'twitch',
  すべる: 'slide',
};

const RICH_TEXT_EFFECT_NAMES: Record<string, RichTextEffect> = {
  none: 'none',
  glow: 'glow',
  light: 'glow',
  shrink: 'shrink',
  small: 'shrink',
  vanish: 'shrink',
  grow: 'grow',
  big: 'grow',
  pop: 'grow',
  silhouette: 'silhouette',
  shadow: 'silhouette',
  なし: 'none',
  ひかる: 'glow',
  光: 'glow',
  しぼむ: 'shrink',
  消える: 'shrink',
  ふくらむ: 'grow',
  大きく: 'grow',
  かげ: 'silhouette',
  影: 'silhouette',
};

const MATH_FONT_FAMILY = '"Cambria Math", "STIX Two Math", "Latin Modern Math", "Times New Roman", serif';

/** タグつき文字列を、文字・ルート・時計・分数の部品へ分けて描きます。 */
export function createRichText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: RichTextOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(options.depth ?? 0);
  const rows = buildRichTextRows(scene, text || ' ', options);
  layoutRichTextRows(container, rows, options);
  const height = rows.reduce((sum, row, index) => sum + row.height + (index > 0 ? options.lineSpacing ?? 0 : 0), 0);
  container.setSize(options.width, height);
  return container;
}

/** タグつき文字列を横幅に合わせて行へ流し込みます。 */
function buildRichTextRows(
  scene: Phaser.Scene,
  text: string,
  options: RichTextOptions,
): RichTextRow[] {
  const rows: RichTextRow[] = [];
  let currentRow = createEmptyRow(options.fontSize);
  const colorStack = [options.color ?? COLORS.ink];
  const motionStack: RichTextMotion[] = ['none'];
  const effectStack: RichTextEffect[] = ['none'];
  let boldDepth = 0;
  let underlineDepth = 0;
  let mathDepth = 0;

  getRichTextPieces(text).forEach((piece) => {
    if (piece === '\n') {
      rows.push(currentRow);
      currentRow = createEmptyRow(options.fontSize);
      return;
    }

    const styleCommandResult = applyRichTextStyleCommand(
      piece,
      colorStack,
      motionStack,
      effectStack,
      boldDepth,
      underlineDepth,
      mathDepth,
      options,
    );
    if (styleCommandResult.wasApplied) {
      boldDepth = styleCommandResult.boldDepth;
      underlineDepth = styleCommandResult.underlineDepth;
      mathDepth = styleCommandResult.mathDepth;
      return;
    }

    const style = createCurrentStyle(options, colorStack, motionStack, effectStack, boldDepth, underlineDepth, mathDepth);
    const token = createRichTextToken(scene, piece, options, style);
    if (currentRow.tokens.length > 0 && currentRow.width + token.width > options.width) {
      rows.push(currentRow);
      currentRow = createEmptyRow(options.fontSize);
    }

    appendTokenToRow(currentRow, token);
  });

  rows.push(currentRow);
  return rows;
}

/** 行ごとの部品を、指定された左中右ぞろえでコンテナ内へ置きます。 */
function layoutRichTextRows(
  container: Phaser.GameObjects.Container,
  rows: RichTextRow[],
  options: RichTextOptions,
): void {
  let rowY = 0;
  rows.forEach((row) => {
    let cursorX = getRowStartX(row.width, options.width, options.align ?? 'left');
    row.tokens.forEach((token) => {
      const tokenY = row.contentTop > 0
        ? rowY + row.contentTop - (token.contentTop ?? 0)
        : rowY + (row.height - token.height) / 2;
      setTokenPosition(token.object, cursorX, tokenY);
      container.add(token.object);
      cursorX += token.width;
    });
    rowY += row.height + (options.lineSpacing ?? 0);
  });
}

/** 現在のタグ状態から、文字部品へ渡す見た目の設定を作ります。 */
function createCurrentStyle(
  options: RichTextOptions,
  colorStack: string[],
  motionStack: RichTextMotion[],
  effectStack: RichTextEffect[],
  boldDepth: number,
  underlineDepth: number,
  mathDepth: number,
): RichTextStyleState {
  const effect = effectStack[effectStack.length - 1] ?? 'none';
  return {
    color: effect === 'silhouette' ? '#263143' : colorStack[colorStack.length - 1] ?? options.color ?? COLORS.ink,
    fontStyle: boldDepth > 0 ? '900' : options.fontStyle ?? '700',
    fontFamily: mathDepth > 0 ? MATH_FONT_FAMILY : FONT_FAMILY,
    underline: underlineDepth > 0,
    motion: motionStack[motionStack.length - 1] ?? 'none',
    effect,
  };
}

/** 色・太字・下線のタグなら状態を更新し、通常文字なら何もしません。 */
function applyRichTextStyleCommand(
  piece: string,
  colorStack: string[],
  motionStack: RichTextMotion[],
  effectStack: RichTextEffect[],
  boldDepth: number,
  underlineDepth: number,
  mathDepth: number,
  options: RichTextOptions,
): { wasApplied: boolean; boldDepth: number; underlineDepth: number; mathDepth: number } {
  const command = parseRichTextCommand(piece);
  if (!command) {
    return { wasApplied: false, boldDepth, underlineDepth, mathDepth };
  }

  if (command.name === 'color') {
    if (command.args[0]) {
      colorStack.push(resolveRichTextColor(command.args[0], colorStack[colorStack.length - 1] ?? options.color ?? COLORS.ink));
    } else if (colorStack.length > 1) {
      colorStack.pop();
    }
    return { wasApplied: true, boldDepth, underlineDepth, mathDepth };
  }

  if (command.name === 'motion' || command.name === 'move') {
    if (command.args[0]) {
      motionStack.push(resolveRichTextMotion(command.args[0]));
    } else if (motionStack.length > 1) {
      motionStack.pop();
    }
    return { wasApplied: true, boldDepth, underlineDepth, mathDepth };
  }

  if (command.name === 'effect') {
    if (command.args[0]) {
      effectStack.push(resolveRichTextEffect(command.args[0]));
    } else if (effectStack.length > 1) {
      effectStack.pop();
    }
    return { wasApplied: true, boldDepth, underlineDepth, mathDepth };
  }

  if (command.name === 'bold' || command.name === 'b') {
    return { wasApplied: true, boldDepth: boldDepth > 0 ? 0 : 1, underlineDepth, mathDepth };
  }

  if (command.name === 'underline' || command.name === 'u') {
    return { wasApplied: true, boldDepth, underlineDepth: underlineDepth > 0 ? 0 : 1, mathDepth };
  }

  if ((command.name === 'math' || command.name === 'm') && !command.rawArgs) {
    return { wasApplied: true, boldDepth, underlineDepth, mathDepth: mathDepth > 0 ? 0 : 1 };
  }

  return { wasApplied: false, boldDepth, underlineDepth, mathDepth };
}

/** 色タグの指定を、実際に描画で使うCSSカラーへ変えます。 */
function resolveRichTextColor(colorName: string, fallbackColor: string): string {
  const normalizedName = colorName.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/i.test(normalizedName)) {
    return normalizedName;
  }

  return RICH_TEXT_COLOR_NAMES[normalizedName] ?? fallbackColor;
}

/** 動きタグの指定を、文字用の動きIDへ変えます。 */
function resolveRichTextMotion(motionName: string): RichTextMotion {
  return RICH_TEXT_MOTION_NAMES[motionName.trim().toLowerCase()] ?? 'none';
}

/** エフェクトタグの指定を、文字用のエフェクトIDへ変えます。 */
function resolveRichTextEffect(effectName: string): RichTextEffect {
  return RICH_TEXT_EFFECT_NAMES[effectName.trim().toLowerCase()] ?? 'none';
}

/** 文字列を、通常文字と [root:] や [ruby:] などのタグ文字へ分けます。 */
function getRichTextPieces(text: string): string[] {
  const pieces: string[] = [];
  let index = 0;

  while (index < text.length) {
    const rubyPiece = readRubyPiece(text, index);
    if (rubyPiece) {
      pieces.push(rubyPiece);
      index += rubyPiece.length;
      continue;
    }

    const command = readCommandPiece(text, index);
    if (command) {
      pieces.push(command);
      index += command.length;
      continue;
    }

    const char = text[index];
    if (char === '\r') {
      index += 1;
      continue;
    }
    pieces.push(char);
    index += 1;
  }

  return pieces;
}

/** 今の位置から始まるルビタグがあれば、閉じタグまでをまとめて返します。 */
function readRubyPiece(text: string, index: number): string | null {
  if (!text.slice(index).toLowerCase().startsWith('[ruby:')) {
    return null;
  }

  const openEndIndex = text.indexOf(']', index + 1);
  if (openEndIndex < 0) {
    return null;
  }

  const closeIndex = text.toLowerCase().indexOf('[ruby]', openEndIndex + 1);
  if (closeIndex < 0) {
    return null;
  }

  return text.slice(index, closeIndex + '[ruby]'.length);
}

/** 今の位置から始まるタグがあれば、閉じかっこまでを返します。 */
function readCommandPiece(text: string, index: number): string | null {
  if (text[index] !== '[') {
    return null;
  }

  const endIndex = text.indexOf(']', index + 1);
  if (endIndex < 0) {
    return null;
  }

  const piece = text.slice(index, endIndex + 1);
  return /^\[(root|sqrt|clock|frac|fraction|name|log|yen|\^|_):[^\]]+\]$/i.test(piece)
    || /^\[(color|motion|move|effect|bold|b|underline|u|math|m)(?::[^\]]+)?\]$/i.test(piece)
    ? piece
    : null;
}

/** 1つの文字またはタグを、描画できる部品に変えます。 */
function createRichTextToken(
  scene: Phaser.Scene,
  piece: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const rubyPiece = parseRubyPiece(piece);
  const command = parseRichTextCommand(piece);
  let token: RichTextToken;
  if (rubyPiece) {
    token = createRubyToken(scene, rubyPiece.baseText, rubyPiece.rubyTexts, rubyPiece.useCharacterRuby, options, style);
  } else if ((command?.name === 'math' || command?.name === 'm') && command.rawArgs) {
    token = createMathExpressionToken(scene, command.rawArgs, options, style);
  } else if (command?.name === 'root' || command?.name === 'sqrt') {
    token = createRootToken(scene, command.args.join(','), options, style);
  } else if (command?.name === 'log') {
    token = createLogToken(scene, command.args.join(','), options, style);
  } else if (command?.name === '^') {
    token = createScriptToken(scene, command.args.join(','), options, style, 'super');
  } else if (command?.name === '_') {
    token = createScriptToken(scene, command.args.join(','), options, style, 'sub');
  } else if (command?.name === 'clock') {
    token = createClockToken(scene, command.args, options, style);
  } else if (command?.name === 'yen') {
    token = createYenToken(scene, command.args, piece, options, style);
  } else if (command?.name === 'frac' || command?.name === 'fraction') {
    token = createFractionToken(scene, command.args, options, style);
  } else if (command?.name === 'name') {
    token = createNamedActorToken(scene, command.args.join(','), piece, options, style);
  } else {
    token = createTextToken(scene, piece, options, style);
  }

  if (style.underline) {
    token = addUnderlineToToken(scene, token, style.color);
  }
  if (style.effect === 'glow') {
    token = addGlowToToken(scene, token);
  } else if (style.effect === 'silhouette') {
    applySilhouetteToToken(token.object);
  }

  applyRichTextMotion(scene, token.object, style.motion);
  applyRichTextEffect(scene, token.object, style.effect);
  return token;
}

/** ルビタグから、本文とルビ指定を取り出します。 */
function parseRubyPiece(piece: string): { baseText: string; rubyTexts: string[]; useCharacterRuby: boolean } | null {
  const match = piece.match(/^\[ruby:([^\]]+)\]([\s\S]*?)\[ruby\]$/i);
  if (!match) {
    return null;
  }

  const rawRubyText = match[1].trim();
  const useCharacterRuby = /[,\uFF0C]/.test(rawRubyText);
  const rubyTexts = useCharacterRuby
    ? rawRubyText.split(/[,\uFF0C]/).map((rubyText) => rubyText.trim()).filter(Boolean)
    : [rawRubyText];
  return {
    baseText: match[2] || ' ',
    rubyTexts,
    useCharacterRuby,
  };
}

/** タグ文字からコマンド名と引数を取り出します。 */
function parseRichTextCommand(piece: string): RichTextCommand | null {
  const match = piece.match(/^\[([a-z]+|\^|_)(?::([^\]]+))?\]$/i);
  if (!match) {
    return null;
  }

  const name = match[1].toLowerCase();
  const rawArgs = match[2] ?? '';
  const args = splitRichTextCommandArgs(rawArgs);
  return { name, args, rawArgs };
}

/** タグ引数を、かっこの中のカンマを守りながら分割します。 */
function splitRichTextCommandArgs(rawArgs: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < rawArgs.length; index += 1) {
    const char = rawArgs[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if ((char === ',' || char === '\uFF0C' || char === '/') && depth === 0) {
      const arg = rawArgs.slice(start, index).trim();
      if (arg) {
        args.push(arg);
      }
      start = index + 1;
    }
  }

  const lastArg = rawArgs.slice(start).trim();
  if (lastArg) {
    args.push(lastArg);
  }
  return args;
}

/** 通常の1文字をテキスト部品として作ります。 */
function createTextToken(
  scene: Phaser.Scene,
  text: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const label = scene.add.text(0, 0, text, {
    fontFamily: style.fontFamily,
    fontSize: `${options.fontSize}px`,
    fontStyle: style.fontStyle,
    color: style.color,
  }).setOrigin(0, 0);
  return { object: label, width: Math.max(1, label.width), height: label.height };
}

/** ルビタグを、小さな読みがなつきの文字部品として作ります。 */
function createRubyToken(
  scene: Phaser.Scene,
  baseText: string,
  rubyTexts: string[],
  useCharacterRuby: boolean,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  return useCharacterRuby
    ? createCharacterRubyToken(scene, baseText, rubyTexts, options, style)
    : createGroupedRubyToken(scene, baseText, rubyTexts[0] ?? '', options, style);
}

/** カンマ区切りのルビを、本文1文字ずつの上へ配置します。 */
function createCharacterRubyToken(
  scene: Phaser.Scene,
  baseText: string,
  rubyTexts: string[],
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const container = scene.add.container(0, 0);
  const rubyFontSize = getRubyFontSize(options.fontSize);
  const baseY = rubyFontSize + 2;
  let cursorX = 0;
  let maxHeight = 0;

  Array.from(baseText || ' ').forEach((char, index) => {
    const rubyText = rubyTexts[index] ?? '';
    const baseLabel = createRubyBaseLabel(scene, char, options, style).setOrigin(0.5, 0);
    const rubyLabel = createRubyReadingLabel(scene, rubyText, rubyFontSize, style).setOrigin(0.5, 0);
    const tokenWidth = Math.max(baseLabel.width, rubyLabel.width, 1);
    const centerX = cursorX + tokenWidth / 2;
    rubyLabel.setPosition(centerX, 0);
    baseLabel.setPosition(centerX, baseY);
    container.add([rubyLabel, baseLabel]);
    cursorX += tokenWidth;
    maxHeight = Math.max(maxHeight, baseY + baseLabel.height);
  });

  const width = Math.max(1, cursorX);
  const height = Math.max(maxHeight, options.fontSize + rubyFontSize + 2);
  container.setSize(width, height);
  return { object: container, width, height, contentTop: baseY };
}

/** カンマなしのルビを、本文全体の中央へ配置します。 */
function createGroupedRubyToken(
  scene: Phaser.Scene,
  baseText: string,
  rubyText: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const rubyFontSize = getRubyFontSize(options.fontSize);
  const baseY = rubyFontSize + 2;
  const container = scene.add.container(0, 0);
  const baseLabel = createRubyBaseLabel(scene, baseText || ' ', options, style).setOrigin(0.5, 0);
  const rubyLabel = createRubyReadingLabel(scene, rubyText, rubyFontSize, style).setOrigin(0.5, 0);
  const width = Math.max(baseLabel.width, rubyLabel.width, 1);
  const centerX = width / 2;
  rubyLabel.setPosition(centerX, 0);
  baseLabel.setPosition(centerX, baseY);
  container.add([rubyLabel, baseLabel]);
  const height = baseY + baseLabel.height;
  container.setSize(width, height);
  return { object: container, width, height, contentTop: baseY };
}

/** ルビ付き文字の本文ラベルを作ります。 */
function createRubyBaseLabel(
  scene: Phaser.Scene,
  text: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, text, {
    fontFamily: style.fontFamily,
    fontSize: `${options.fontSize}px`,
    fontStyle: style.fontStyle,
    color: style.color,
  });
}

/** ルビの読みがなラベルを作ります。 */
function createRubyReadingLabel(
  scene: Phaser.Scene,
  text: string,
  fontSize: number,
  style: RichTextStyleState,
): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, text || ' ', {
    fontFamily: style.fontFamily,
    fontSize: `${fontSize}px`,
    fontStyle: '800',
    color: style.color,
  }).setAlpha(0.82);
}

/** 本文サイズに合わせて、ルビの文字サイズを決めます。 */
function getRubyFontSize(baseFontSize: number): number {
  return Math.max(8, Math.round(baseFontSize * 0.48));
}

/** logタグを、必要なら底つきの数学部品として作ります。 */
function createLogToken(
  scene: Phaser.Scene,
  base: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const container = scene.add.container(0, 0);
  const label = scene.add.text(0, 0, 'log', {
    fontFamily: MATH_FONT_FAMILY,
    fontSize: `${options.fontSize}px`,
    fontStyle: style.fontStyle,
    color: style.color,
  }).setOrigin(0, 0);
  container.add(label);

  if (!base) {
    container.setSize(label.width, label.height);
    return { object: container, width: label.width, height: label.height };
  }

  const script = createScriptToken(scene, base, options, { ...style, fontFamily: MATH_FONT_FAMILY }, 'sub');
  setTokenPosition(script.object, label.width + 1, Math.round(options.fontSize * 0.42));
  container.add(script.object);
  const width = label.width + script.width + 1;
  const height = Math.max(label.height, Math.round(options.fontSize * 0.42) + script.height);
  container.setSize(width, height);
  return { object: container, width, height };
}

/** 上付き・下付きタグを、小さな数学文字として作ります。 */
function createScriptToken(
  scene: Phaser.Scene,
  text: string,
  options: RichTextOptions,
  style: RichTextStyleState,
  kind: 'super' | 'sub',
): RichTextToken {
  const fontSize = getScriptFontSize(options.fontSize);
  const yOffset = kind === 'super' ? 0 : Math.round(options.fontSize * 0.48);
  const label = scene.add.text(0, yOffset, text || ' ', {
    fontFamily: style.fontFamily === FONT_FAMILY ? MATH_FONT_FAMILY : style.fontFamily,
    fontSize: `${fontSize}px`,
    fontStyle: style.fontStyle,
    color: style.color,
  }).setOrigin(0, 0);
  const height = yOffset + label.height;
  const container = scene.add.container(0, 0);
  container.add(label);
  container.setSize(Math.max(1, label.width), height);
  return {
    object: container,
    width: Math.max(1, label.width),
    height,
    contentTop: kind === 'super' ? yOffset + label.height - options.fontSize : 0,
  };
}

/** 本文サイズに合わせて、上付き・下付きの文字サイズを決めます。 */
function getScriptFontSize(baseFontSize: number): number {
  return Math.max(8, Math.round(baseFontSize * 0.62));
}

/** [math:...] の中の式を、ルートや分数を含む数学部品として作ります。 */
function createMathExpressionToken(
  scene: Phaser.Scene,
  expression: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const node = parseStoryMathExpression(expression);
  return createMathNodeToken(scene, node, options, { ...style, fontFamily: MATH_FONT_FAMILY });
}

/** 数式の木構造を、Phaserで配置できる1つの部品へ変えます。 */
function createMathNodeToken(
  scene: Phaser.Scene,
  node: StoryMathExpressionNode,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  if (node.kind === 'text') {
    return createMathTextToken(scene, node.value || ' ', options, style);
  }

  if (node.kind === 'sequence') {
    return createMathInlineToken(scene, node.parts.map((part) => createMathNodeToken(scene, part, options, style)));
  }

  if (node.kind === 'group') {
    return createMathInlineToken(scene, [
      createMathTextToken(scene, '(', options, style),
      createMathNodeToken(scene, node.value, options, style),
      createMathTextToken(scene, ')', options, style),
    ]);
  }

  return createMathCallToken(scene, node, options, style);
}

/** 数式内の通常文字を、数学用フォントの文字部品として作ります。 */
function createMathTextToken(
  scene: Phaser.Scene,
  text: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  return createTextToken(scene, text, options, { ...style, fontFamily: MATH_FONT_FAMILY });
}

/** 数式関数名ごとに、対応する見た目の部品へ分岐します。 */
function createMathCallToken(
  scene: Phaser.Scene,
  node: Extract<StoryMathExpressionNode, { kind: 'call' }>,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  if (node.name === 'sqrt' || node.name === 'root') {
    return createMathRootToken(scene, node.args[0] ?? { kind: 'text', value: '' }, options, style);
  }

  if (node.name === 'frac' || node.name === 'fraction') {
    return createMathFractionToken(
      scene,
      node.args[0] ?? { kind: 'text', value: '' },
      node.args[1] ?? { kind: 'text', value: '' },
      options,
      style,
    );
  }

  if (node.name === 'pow' || node.name === 'sup') {
    return createMathScriptExpressionToken(
      scene,
      node.args[0] ?? { kind: 'text', value: '' },
      node.args[1] ?? { kind: 'text', value: '' },
      options,
      style,
      'super',
    );
  }

  if (node.name === 'sub') {
    return createMathScriptExpressionToken(
      scene,
      node.args[0] ?? { kind: 'text', value: '' },
      node.args[1] ?? { kind: 'text', value: '' },
      options,
      style,
      'sub',
    );
  }

  if (node.name === 'log') {
    return createMathLogExpressionToken(scene, node.args, options, style);
  }

  return createMathTextToken(scene, formatStoryMathExpression(node), options, style);
}

/** 横に並ぶ数式部品を、高さの中央をそろえて1つの部品へまとめます。 */
function createMathInlineToken(scene: Phaser.Scene, tokens: RichTextToken[]): RichTextToken {
  const container = scene.add.container(0, 0);
  const width = tokens.reduce((sum, token) => sum + token.width, 0);
  const height = Math.max(1, ...tokens.map((token) => token.height));
  let cursorX = 0;
  tokens.forEach((token) => {
    setTokenPosition(token.object, cursorX, (height - token.height) / 2);
    container.add(token.object);
    cursorX += token.width;
  });
  container.setSize(width, height);
  return { object: container, width, height };
}

/** 数式用のルートを、根号と上線、入れ子の中身で作ります。 */
function createMathRootToken(
  scene: Phaser.Scene,
  radicandNode: StoryMathExpressionNode,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const container = scene.add.container(0, 0);
  const radicand = createMathNodeToken(scene, radicandNode, options, style);
  const rootText = scene.add.text(0, 2, '√', {
    fontFamily: MATH_FONT_FAMILY,
    fontSize: `${Math.round(options.fontSize * 1.14)}px`,
    fontStyle: style.fontStyle,
    color: style.color,
  }).setOrigin(0, 0);
  const childX = rootText.width - 1;
  const childY = 6;
  const width = childX + radicand.width + 6;
  const height = Math.max(rootText.height + 2, childY + radicand.height);
  const graphics = scene.add.graphics();
  graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(style.color).color, 1);
  graphics.lineBetween(rootText.width + 1, 4, childX + radicand.width + 4, 4);
  setTokenPosition(radicand.object, childX, childY);
  container.add([graphics, rootText, radicand.object]);
  container.setSize(width, height);
  return { object: container, width, height };
}

/** 数式用の分数を、分子と分母も数式として描ける形で作ります。 */
function createMathFractionToken(
  scene: Phaser.Scene,
  numeratorNode: StoryMathExpressionNode,
  denominatorNode: StoryMathExpressionNode,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const childOptions = { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.76)) };
  const numerator = createMathNodeToken(scene, numeratorNode, childOptions, style);
  const denominator = createMathNodeToken(scene, denominatorNode, childOptions, style);
  const width = Math.max(numerator.width, denominator.width, 20) + 12;
  const lineY = numerator.height + 5;
  const denominatorY = lineY + 5;
  const height = denominatorY + denominator.height;
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(style.color).color, 1);
  graphics.lineBetween(2, lineY, width - 2, lineY);
  setTokenPosition(numerator.object, (width - numerator.width) / 2, 0);
  setTokenPosition(denominator.object, (width - denominator.width) / 2, denominatorY);
  container.add([graphics, numerator.object, denominator.object]);
  container.setSize(width, height);
  return { object: container, width, height };
}

/** powやsubのような、上付き・下付きの数式部品を作ります。 */
function createMathScriptExpressionToken(
  scene: Phaser.Scene,
  baseNode: StoryMathExpressionNode,
  scriptNode: StoryMathExpressionNode,
  options: RichTextOptions,
  style: RichTextStyleState,
  kind: 'super' | 'sub',
): RichTextToken {
  const base = createMathNodeToken(scene, baseNode, options, style);
  const scriptOptions = { ...options, fontSize: getScriptFontSize(options.fontSize) };
  const script = createMathNodeToken(scene, scriptNode, scriptOptions, style);
  const baseY = kind === 'super' ? Math.round(script.height * 0.42) : 0;
  const scriptY = kind === 'super' ? 0 : Math.round(base.height * 0.58);
  const container = scene.add.container(0, 0);
  setTokenPosition(base.object, 0, baseY);
  setTokenPosition(script.object, base.width + 1, scriptY);
  container.add([base.object, script.object]);
  const width = base.width + script.width + 1;
  const height = Math.max(baseY + base.height, scriptY + script.height);
  container.setSize(width, height);
  return { object: container, width, height };
}

/** log(base,value) を、底つきlogと右側の値として描きます。 */
function createMathLogExpressionToken(
  scene: Phaser.Scene,
  args: StoryMathExpressionNode[],
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const label = createMathTextToken(scene, 'log', options, style);
  if (args.length <= 1) {
    return args[0]
      ? createMathInlineToken(scene, [label, createMathNodeToken(scene, args[0], options, style)])
      : label;
  }

  const baseOptions = { ...options, fontSize: getScriptFontSize(options.fontSize) };
  const base = createMathNodeToken(scene, args[0], baseOptions, style);
  const value = createMathNodeToken(scene, args[1], options, style);
  const container = scene.add.container(0, 0);
  const baseY = Math.round(options.fontSize * 0.48);
  const valueX = label.width + base.width + 4;
  setTokenPosition(label.object, 0, 0);
  setTokenPosition(base.object, label.width + 1, baseY);
  setTokenPosition(value.object, valueX, 0);
  container.add([label.object, base.object, value.object]);
  const width = valueX + value.width;
  const height = Math.max(label.height, baseY + base.height, value.height);
  container.setSize(width, height);
  return { object: container, width, height };
}

/** 未対応の数式関数を、入力文字列に近い形へ戻します。 */
function formatStoryMathExpression(node: StoryMathExpressionNode): string {
  if (node.kind === 'text') {
    return node.value;
  }
  if (node.kind === 'sequence') {
    return node.parts.map((part) => formatStoryMathExpression(part)).join('');
  }
  if (node.kind === 'group') {
    return `(${formatStoryMathExpression(node.value)})`;
  }
  return `${node.name}(${node.args.map((arg) => formatStoryMathExpression(arg)).join(',')})`;
}

/** ルートのタグを、根号と上線つきの部品として作ります。 */
function createRootToken(
  scene: Phaser.Scene,
  radicand: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const color = style.color;
  const container = scene.add.container(0, 0);
  const rootText = scene.add.text(0, 2, '√', {
    fontFamily: style.fontFamily === FONT_FAMILY ? MATH_FONT_FAMILY : style.fontFamily,
    fontSize: `${Math.round(options.fontSize * 1.12)}px`,
    fontStyle: style.fontStyle,
    color,
  }).setOrigin(0, 0);
  const valueText = scene.add.text(rootText.width - 1, 4, radicand || ' ', {
    fontFamily: style.fontFamily === FONT_FAMILY ? MATH_FONT_FAMILY : style.fontFamily,
    fontSize: `${options.fontSize}px`,
    fontStyle: style.fontStyle,
    color,
  }).setOrigin(0, 0);
  const graphics = scene.add.graphics();
  graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 1);
  graphics.lineBetween(rootText.width + 1, 4, rootText.width + valueText.width + 4, 4);
  container.add([graphics, rootText, valueText]);
  const width = rootText.width + valueText.width + 6;
  const height = Math.max(rootText.height + 2, valueText.height + 8);
  container.setSize(width, height);
  return { object: container, width, height };
}

/** 時計タグを、小さなアナログ時計の部品として作ります。 */
function createClockToken(
  scene: Phaser.Scene,
  args: string[],
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const hour = parseClockValue(args[0]);
  const minute = parseClockValue(args[1]);
  const endHour = args.length >= 4 ? parseClockValue(args[2]) : null;
  const endMinute = args.length >= 4 ? parseClockValue(args[3]) : null;
  const size = Math.round(options.fontSize * 1.55);
  const radius = size / 2;
  const center = radius;
  const color = Phaser.Display.Color.HexStringToColor(style.color).color;
  const container = scene.add.container(0, 0);
  const face = scene.add.graphics();
  const hands = scene.add.graphics();
  drawClockFace(face, center, radius, color);
  drawClockHands(hands, center, radius, hour, minute, color);
  container.add([face, hands]);

  if (endHour !== null && endMinute !== null) {
    animateClockHands(scene, hands, center, radius, color, hour, minute, endHour, endMinute);
  }

  container.setSize(size, size);
  return { object: container, width: size, height: size };
}

/** 時計タグの数値指定を、描画に使える数へ整えます。 */
function parseClockValue(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 時計の外わくと目もりを描きます。 */
function drawClockFace(
  graphics: Phaser.GameObjects.Graphics,
  center: number,
  radius: number,
  color: number,
): void {
  graphics.fillStyle(0xffffff, 1);
  graphics.lineStyle(2, color, 1);
  graphics.fillCircle(center, center, radius - 1);
  graphics.strokeCircle(center, center, radius - 1);
  graphics.lineStyle(2, color, 0.9);
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
    const inner = radius - 5;
    const outer = radius - 2;
    graphics.lineBetween(
      center + Math.cos(angle) * inner,
      center + Math.sin(angle) * inner,
      center + Math.cos(angle) * outer,
      center + Math.sin(angle) * outer,
    );
  }
}

/** 指定した時こくの長い針と短い針を描きます。 */
function drawClockHands(
  graphics: Phaser.GameObjects.Graphics,
  center: number,
  radius: number,
  hour: number,
  minute: number,
  color: number,
): void {
  graphics.clear();
  drawClockHand(graphics, center, radius * 0.42, ((hour % 12) + minute / 60) * 30, color, 3);
  drawClockHand(graphics, center, radius * 0.68, minute * 6, color, 2);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(center, center, 2.5);
}

/** 4つ指定された時計タグで、開始時こくから終了時こくへ針を動かします。 */
function animateClockHands(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  center: number,
  radius: number,
  color: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): void {
  const startTotalMinute = getClockTotalMinute(startHour, startMinute);
  let endTotalMinute = getClockTotalMinute(endHour, endMinute);
  while (endTotalMinute < startTotalMinute) {
    endTotalMinute += 12 * 60;
  }

  if (endTotalMinute === startTotalMinute) {
    return;
  }

  const clockValue = { totalMinute: startTotalMinute };
  scene.tweens.add({
    targets: clockValue,
    totalMinute: endTotalMinute,
    duration: Phaser.Math.Clamp((endTotalMinute - startTotalMinute) * 9, 900, 2400),
    ease: 'Sine.easeInOut',
    onUpdate: () => drawClockHandsByTotalMinute(graphics, center, radius, clockValue.totalMinute, color),
    onComplete: () => drawClockHandsByTotalMinute(graphics, center, radius, endTotalMinute, color),
  });
}

/** 時と分を、12時間時計の0時からの分数へ変えます。 */
function getClockTotalMinute(hour: number, minute: number): number {
  const normalizedHour = ((Math.floor(hour) % 12) + 12) % 12;
  return normalizedHour * 60 + Math.floor(minute);
}

/** 分数で表した時こくから、時計の針を描き直します。 */
function drawClockHandsByTotalMinute(
  graphics: Phaser.GameObjects.Graphics,
  center: number,
  radius: number,
  totalMinute: number,
  color: number,
): void {
  const normalizedTotalMinute = ((totalMinute % (12 * 60)) + 12 * 60) % (12 * 60);
  const hour = Math.floor(normalizedTotalMinute / 60);
  const minute = normalizedTotalMinute % 60;
  drawClockHands(graphics, center, radius, hour, minute, color);
}

/** 分数タグを、上下の数字と横線の部品として作ります。 */
/** yenタグから、円玉かおさつのパーツを作ります。 */
function createYenToken(
  scene: Phaser.Scene,
  args: string[],
  fallbackText: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const value = parseYenValue(args[0]);
  if (!value) {
    return createTextToken(scene, fallbackText, options, style);
  }

  return value >= 1000
    ? createYenBillToken(scene, value, options, style)
    : createYenCoinToken(scene, value, options, style);
}

/** yenタグの数を、つかえる円の数にします。 */
function parseYenValue(value: string | undefined): number | null {
  const parsed = Number(value ?? 0);
  const allowedValues = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000];
  return allowedValues.includes(parsed) ? parsed : null;
}

/** 円玉の色をかえします。 */
function getYenCoinColor(value: number): number {
  switch (value) {
    case 1:
      return 0xf5f1de;
    case 5:
      return 0xf2d37a;
    case 10:
      return 0xe4b065;
    case 50:
      return 0xd8dde2;
    case 100:
      return 0xc9d4dc;
    case 500:
      return 0xd7c06b;
    default:
      return 0xf5f1de;
  }
}

/** 円玉のリッチテキストパーツを作ります。 */
function createYenCoinToken(
  scene: Phaser.Scene,
  value: number,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const size = Math.round(options.fontSize * 1.7);
  const radius = size / 2;
  const center = radius;
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  const coinColor = getYenCoinColor(value);
  graphics.fillStyle(coinColor, 1);
  graphics.lineStyle(2, 0x8f7c51, 0.92);
  graphics.fillCircle(center, center, radius - 1);
  graphics.strokeCircle(center, center, radius - 1);
  graphics.lineStyle(1, 0xffffff, 0.8);
  graphics.strokeCircle(center, center, radius - 5);

  if (value === 5 || value === 50) {
    graphics.fillStyle(0xffffff, 1);
    graphics.lineStyle(1, 0x8f7c51, 0.62);
    graphics.fillCircle(center, center, radius * 0.2);
    graphics.strokeCircle(center, center, radius * 0.2);
  }

  const numberFontSize = value >= 100 ? Math.round(options.fontSize * 0.6) : Math.round(options.fontSize * 0.72);
  const numberLabel = scene.add.text(center, center - radius * 0.28, String(value), {
    fontFamily: style.fontFamily,
    fontSize: `${numberFontSize}px`,
    fontStyle: '900',
    color: '#423724',
  }).setOrigin(0.5);
  const yenLabel = scene.add.text(center, center + radius * 0.28, '円', {
    fontFamily: style.fontFamily,
    fontSize: `${Math.round(options.fontSize * 0.48)}px`,
    fontStyle: '900',
    color: '#423724',
  }).setOrigin(0.5);

  container.add([graphics, numberLabel, yenLabel]);
  container.setSize(size, size);
  return { object: container, width: size, height: size };
}

/** おさつのリッチテキストパーツを作ります。 */
function createYenBillToken(
  scene: Phaser.Scene,
  value: number,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const width = Math.round(options.fontSize * 3.5);
  const height = Math.round(options.fontSize * 1.55);
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  const fillColor = value === 1000 ? 0xdbeaf8 : value === 5000 ? 0xe8ddf3 : 0xf3dfbd;
  const lineColor = value === 1000 ? 0x447aa8 : value === 5000 ? 0x7a5aa2 : 0x9b6d33;
  graphics.fillStyle(fillColor, 1);
  graphics.lineStyle(2, lineColor, 0.95);
  graphics.fillRoundedRect(0, 0, width, height, 5);
  graphics.strokeRoundedRect(0, 0, width, height, 5);
  graphics.lineStyle(1, lineColor, 0.45);
  graphics.strokeRoundedRect(5, 5, width - 10, height - 10, 4);
  graphics.fillStyle(0xffffff, 0.36);
  graphics.fillCircle(width * 0.22, height / 2, height * 0.24);
  graphics.lineStyle(1, lineColor, 0.5);
  graphics.strokeCircle(width * 0.22, height / 2, height * 0.24);

  const valueLabel = scene.add.text(width * 0.62, height * 0.42, String(value), {
    fontFamily: style.fontFamily,
    fontSize: `${Math.round(options.fontSize * 0.72)}px`,
    fontStyle: '900',
    color: '#2f2b25',
  }).setOrigin(0.5);
  const yenLabel = scene.add.text(width * 0.62, height * 0.72, '円', {
    fontFamily: style.fontFamily,
    fontSize: `${Math.round(options.fontSize * 0.45)}px`,
    fontStyle: '900',
    color: '#2f2b25',
  }).setOrigin(0.5);

  container.add([graphics, valueLabel, yenLabel]);
  container.setSize(width, height);
  return { object: container, width, height };
}

function createFractionToken(
  scene: Phaser.Scene,
  args: string[],
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  return createMathFractionToken(
    scene,
    parseStoryMathExpression(args[0] ?? ''),
    parseStoryMathExpression(args[1] ?? ''),
    options,
    { ...style, fontFamily: MATH_FONT_FAMILY },
  );
}

/** 名前タグを、登録済みキャラやモンスターの小さな画像部品として作ります。 */
function createNamedActorToken(
  scene: Phaser.Scene,
  actorName: string,
  fallbackText: string,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const actor = findStoryActorByName(actorName);
  if (!actor) {
    return createTextToken(scene, fallbackText, options, style);
  }

  if (actor.kind === 'monster' && actor.monsterId) {
    return createMonsterImageToken(scene, actor, options);
  }

  if (actor.trainerId) {
    return createTrainerImageToken(scene, actor, options, style);
  }

  return createTextToken(scene, actor.name, options, style);
}

/** 名前またはIDから、ストーリーで使えるキャラ定義を探します。 */
function findStoryActorByName(actorName: string): StoryCreatorActorChoice | undefined {
  const normalizedName = normalizeActorSearchText(actorName);
  return storyCreatorActorChoices.find((actor) => (
    normalizeActorSearchText(actor.name) === normalizedName
    || normalizeActorSearchText(actor.id) === normalizedName
    || normalizeActorSearchText(actor.monsterId ?? '') === normalizedName
    || normalizeActorSearchText(actor.trainerId ?? '') === normalizedName
  ));
}

/** キャラ検索用に、前後の空白と大文字小文字の差をならします。 */
function normalizeActorSearchText(text: string): string {
  return text.trim().toLowerCase();
}

/** モンスター定義から、文章中に置ける小さな画像部品を作ります。 */
function createMonsterImageToken(
  scene: Phaser.Scene,
  actor: StoryCreatorActorChoice,
  options: RichTextOptions,
): RichTextToken {
  const tokenSize = getNamedActorTokenSize(options.fontSize);
  const container = scene.add.container(0, 0);
  const image = createMonsterVisual(scene, getMonsterById(actor.monsterId ?? actor.id), tokenSize / 2, tokenSize / 2, tokenSize);
  image.setDisplaySize(tokenSize, tokenSize);
  container.add(image);
  container.setSize(tokenSize, tokenSize);
  return { object: container, width: tokenSize, height: tokenSize };
}

/** トレーナー定義から、文章中に置ける小さな画像部品を作ります。 */
function createTrainerImageToken(
  scene: Phaser.Scene,
  actor: StoryCreatorActorChoice,
  options: RichTextOptions,
  style: RichTextStyleState,
): RichTextToken {
  const asset = getTrainerImageAsset(actor.trainerId ?? '');
  if (!asset || !scene.textures.exists(asset.key)) {
    return createTextToken(scene, actor.name, options, style);
  }

  const tokenSize = getNamedActorTokenSize(options.fontSize);
  const container = scene.add.container(0, 0);
  const image = scene.add.image(tokenSize / 2, tokenSize / 2, asset.key).setDisplaySize(tokenSize, tokenSize);
  container.add(image);
  container.setSize(tokenSize, tokenSize);
  return { object: container, width: tokenSize, height: tokenSize };
}

/** 文章の文字サイズから、名前タグ画像の一辺の長さを決めます。 */
function getNamedActorTokenSize(fontSize: number): number {
  return Math.max(24, Math.round(fontSize * 1.7));
}

/** 下線タグが有効な部品の下に、同じ色の線を足します。 */
function addUnderlineToToken(
  scene: Phaser.Scene,
  token: RichTextToken,
  color: string,
): RichTextToken {
  const underlineGap = 2;
  const underlineHeight = 2;
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  graphics.lineStyle(underlineHeight, Phaser.Display.Color.HexStringToColor(color).color, 1);
  graphics.lineBetween(0, token.height + underlineGap, token.width, token.height + underlineGap);
  container.add([token.object, graphics]);
  const height = token.height + underlineGap + underlineHeight;
  container.setSize(token.width, height);
  return { object: container, width: token.width, height, contentTop: token.contentTop };
}

/** 光エフェクト用に、文字部品の後ろへ淡い光を足します。 */
function addGlowToToken(scene: Phaser.Scene, token: RichTextToken): RichTextToken {
  const padding = 5;
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff3a6').color, 0.38);
  graphics.fillRoundedRect(0, 0, token.width + padding * 2, token.height + padding * 2, 8);
  graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor('#ffd45a').color, 0.56);
  graphics.strokeRoundedRect(1, 1, token.width + padding * 2 - 2, token.height + padding * 2 - 2, 8);
  setTokenPosition(token.object, padding, padding);
  container.add([graphics, token.object]);
  scene.tweens.add({
    targets: graphics,
    alpha: 0.52,
    duration: 420,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  const width = token.width + padding * 2;
  const height = token.height + padding * 2;
  container.setSize(width, height);
  return { object: container, width, height, contentTop: token.contentTop === undefined ? undefined : token.contentTop + padding };
}

/** かげエフェクト用に、文字や画像を暗い色へ寄せます。 */
function applySilhouetteToToken(object: Phaser.GameObjects.GameObject): void {
  const color = Phaser.Display.Color.HexStringToColor('#263143').color;
  if (object instanceof Phaser.GameObjects.Container) {
    object.list.forEach((child) => applySilhouetteToToken(child));
    return;
  }

  if (object instanceof Phaser.GameObjects.Text) {
    object.setColor('#263143');
    return;
  }

  if ('setTint' in object && typeof object.setTint === 'function') {
    object.setTint(color);
  }
}

/** 文字部品に、二回分のはねる/ゆれる動きを付けます。 */
function applyRichTextMotion(
  scene: Phaser.Scene,
  object: Phaser.GameObjects.GameObject,
  motion: RichTextMotion,
): void {
  if (motion === 'bounce') {
    scene.tweens.add({
      targets: object,
      y: '-=6',
      duration: 360,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    return;
  }

  if (motion === 'twitch') {
    applyRichTextTwitchMotion(scene, object);
    return;
  }

  if (motion === 'slide') {
    applyRichTextSlideMotion(scene, object);
    return;
  }

  if (motion === 'sway') {
    scene.tweens.add({
      targets: object,
      x: '+=6',
      duration: 420,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** 文字部品を、びくっと角ばった動きで短く動かします。 */
function applyRichTextTwitchMotion(scene: Phaser.Scene, object: Phaser.GameObjects.GameObject): void {
  const target = object as TweenableRichTextObject;
  const baseX = target.x;
  const baseY = target.y;
  const baseAngle = target.angle;
  scene.tweens.add({
    targets: target,
    x: baseX + 5,
    y: baseY - 3,
    angle: baseAngle - 3,
    duration: 60,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: target,
        x: baseX - 4,
        y: baseY + 2,
        angle: baseAngle + 3,
        duration: 70,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          scene.tweens.add({
            targets: target,
            x: baseX,
            y: baseY,
            angle: baseAngle,
            duration: 90,
            ease: 'Back.easeOut',
          });
        },
      });
    },
  });
}

/** 文字部品を、横へすべらせてから元の位置へ戻します。 */
function applyRichTextSlideMotion(scene: Phaser.Scene, object: Phaser.GameObjects.GameObject): void {
  const target = object as TweenableRichTextObject;
  const baseX = target.x;
  scene.tweens.add({
    targets: target,
    x: baseX + 16,
    duration: 110,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: target,
        x: baseX,
        duration: 220,
        ease: 'Cubic.easeOut',
      });
    },
  });
}

/** 文字部品に、しぼむなどの時間変化エフェクトを付けます。 */
function applyRichTextEffect(
  scene: Phaser.Scene,
  object: Phaser.GameObjects.GameObject,
  effect: RichTextEffect,
): void {
  if (effect === 'grow') {
    applyRichTextGrowEffect(scene, object);
    return;
  }

  if (effect !== 'shrink') {
    return;
  }

  scene.tweens.add({
    targets: object,
    scaleX: 0.12,
    scaleY: 0.12,
    alpha: 0,
    y: '+=10',
    duration: 620,
    delay: 120,
    ease: 'Back.easeIn',
  });
}

/** 文字部品を、小さい状態からふくらませます。 */
function applyRichTextGrowEffect(scene: Phaser.Scene, object: Phaser.GameObjects.GameObject): void {
  const target = object as TweenableRichTextObject;
  const baseScaleX = target.scaleX;
  const baseScaleY = target.scaleY;
  target.setScale(baseScaleX * 0.12, baseScaleY * 0.12);
  target.setAlpha(0);
  scene.tweens.add({
    targets: target,
    scaleX: baseScaleX,
    scaleY: baseScaleY,
    alpha: 1,
    duration: 540,
    delay: 80,
    ease: 'Back.easeOut',
  });
}

/** 時計の針を角度に合わせて描きます。 */
function drawClockHand(
  graphics: Phaser.GameObjects.Graphics,
  center: number,
  length: number,
  degrees: number,
  color: number,
  width: number,
): void {
  const angle = Phaser.Math.DegToRad(degrees - 90);
  graphics.lineStyle(width, color, 1);
  graphics.lineBetween(center, center, center + Math.cos(angle) * length, center + Math.sin(angle) * length);
}

/** 空行用の初期行データを作ります。 */
function createEmptyRow(fontSize: number): RichTextRow {
  return {
    tokens: [],
    width: 0,
    height: Math.round(fontSize * 1.2),
    contentTop: 0,
    contentBottom: Math.round(fontSize * 1.2),
  };
}

/** 行に部品を足し、ルビ付き文字の本文位置も含めて行の高さを更新します。 */
function appendTokenToRow(row: RichTextRow, token: RichTextToken): void {
  const contentTop = token.contentTop ?? 0;
  row.tokens.push(token);
  row.width += token.width;
  row.contentTop = Math.max(row.contentTop, contentTop);
  row.contentBottom = Math.max(row.contentBottom, token.height - contentTop);
  row.height = Math.max(row.height, token.height, row.contentTop + row.contentBottom);
}

/** 行の幅とそろえ方から、描き始めるx座標を返します。 */
function getRowStartX(rowWidth: number, maxWidth: number, align: RichTextAlign): number {
  if (align === 'center') {
    return (maxWidth - rowWidth) / 2;
  }
  if (align === 'right') {
    return maxWidth - rowWidth;
  }
  return 0;
}

/** Phaserの部品種別に合わせて、行内の位置を設定します。 */
function setTokenPosition(object: Phaser.GameObjects.GameObject, x: number, y: number): void {
  if ('setPosition' in object && typeof object.setPosition === 'function') {
    object.setPosition(x, y);
  }
}
