import * as Phaser from 'phaser';
import { ALLOWED_DISPLAY_KANJI } from '../../textPolicy';
import { COLORS, FONT_FAMILY } from '../../constants';

interface RubyTextOptions {
  width: number;
  baseFontSize?: number;
  rubyFontSize?: number;
  color?: string;
  rubyColor?: string;
  fontStyle?: string;
  lineGap?: number;
}

const KANJI_PATTERN = /[一-龯]/;

const RUBY_BY_KANJI: Record<string, string> = {
  葉: 'は',
  受: 'う',
  進: 'すす',
  枚: 'まい',
  仲: 'なか',
  背: 'せ',
  育: 'そだ',
  種: 'たね',
  抱: 'だ',
  寝: 'ね',
  旅: 'たび',
  混: 'ま',
  転: 'ころ',
  痛: 'いた',
  向: 'む',
  抜: 'ぬ',
  集: 'あつ',
  冠: 'かんむり',
  照: 'て',
  者: 'もの',
  坂: 'さか',
  苦: 'にが',
  緑: 'みどり',
  残: 'のこ',
  跳: 'は',
  舞: 'ま',
  冷: 'つめ',
  床: 'ゆか',
  安: 'あん',
  全: 'ぜん',
  氷: 'こおり',
  結: 'けっ',
  晶: 'しょう',
  負: 'お',
  洞: 'どう',
  窟: 'くつ',
  映: 'うつ',
  迷: 'まよ',
  路: 'ろ',
  息: 'いき',
  吐: 'は',
  粒: 'つぶ',
  浮: 'う',
  腹: 'なか',
  曲: 'ま',
  真: 'しん',
  剣: 'けん',
  静: 'しず',
  所: 'ところ',
  眠: 'ねむ',
  胸: 'むね',
  消: 'け',
  炎: 'ほのお',
  輪: 'わ',
  守: 'まも',
  頼: 'たよ',
  取: 'と',
  軽: 'かる',
  熱: 'あつ',
  面: 'めん',
  屋: 'や',
  吸: 'す',
  込: 'こ',
  整: 'ととの',
  姿: 'すがた',
  瞬: 'しゅん',
  溶: 'と',
  雷: 'かみなり',
  送: 'おく',
  乗: 'の',
  移: 'い',
  動: 'どう',
  降: 'ふ',
  速: 'はや',
  着: 'ちゃく',
  緒: 'しょ',
  泡: 'あわ',
  橋: 'はし',
  渡: 'わた',
  響: 'ひび',
  辺: 'べ',
  呼: 'よ',
  波: 'なみ',
  揺: 'ゆ',
  滴: 'しずく',
  遊: 'あそ',
  落: 'お',
  描: 'か',
  案: 'あん',
  踊: 'おど',
  飛: 'と',
  笑: 'わら',
  影: 'かげ',
  伸: 'の',
  遺: 'い',
  跡: 'あと',
  笠: 'かさ',
  粉: 'こな',
  暗: 'くら',
  夢: 'ゆめ',
  秘: 'ひ',
  密: 'みつ',
  扉: 'とびら',
  畳: 'だたみ',
  流: 'なが',
  現: 'あらわ',
  塔: 'とう',
  指: 'さ',
  鐘: 'かね',
  個: 'こ',
  箱: 'はこ',
  窓: 'まど',
  飾: 'かざ',
  覚: 'おぼ',
  問: 'もん',
  続: 'つづ',
  戻: 'もど',
  確: 'たし',
  倒: 'たお',
  減: 'へ',
  位: 'くらい',
  借: 'か',
  支: 'ささ',
  実: 'み',
  得: 'とく',
  示: 'しめ',
  硬: 'かた',
  砂: 'すな',
  吹: 'ふ',
  差: 'さ',
};

/** 許可外の漢字にだけ小さなルビを付けて、折り返し可能なテキストを作ります。 */
export function createRubyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: RubyTextOptions,
): Phaser.GameObjects.Container {
  const baseFontSize = options.baseFontSize ?? 17;
  const rubyFontSize = options.rubyFontSize ?? 9;
  const lineGap = options.lineGap ?? 8;
  const lineHeight = baseFontSize + rubyFontSize + lineGap;
  const container = scene.add.container(x, y);
  let cursorX = 0;
  let cursorY = 0;

  Array.from(text).forEach((char) => {
    if (char === '\n') {
      cursorX = 0;
      cursorY += lineHeight;
      return;
    }

    const ruby = getRuby(char);
    const charWidth = measureText(scene, char, baseFontSize, options.fontStyle);
    const rubyWidth = ruby ? measureText(scene, ruby, rubyFontSize, options.fontStyle) : 0;
    const tokenWidth = Math.max(charWidth, rubyWidth);
    if (cursorX > 0 && cursorX + tokenWidth > options.width) {
      cursorX = 0;
      cursorY += lineHeight;
    }

    const centerX = cursorX + tokenWidth / 2;
    if (ruby) {
      const rubyText = scene.add
        .text(centerX, cursorY, ruby, {
          fontFamily: FONT_FAMILY,
          fontSize: `${rubyFontSize}px`,
          fontStyle: options.fontStyle ?? '700',
          color: options.rubyColor ?? COLORS.muted,
          align: 'center',
        })
        .setOrigin(0.5, 0);
      container.add(rubyText);
    }

    const glyph = scene.add
      .text(centerX, cursorY + rubyFontSize + 2, char, {
        fontFamily: FONT_FAMILY,
        fontSize: `${baseFontSize}px`,
        fontStyle: options.fontStyle ?? '700',
        color: options.color ?? COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(glyph);
    cursorX += tokenWidth;
  });

  container.setSize(options.width, cursorY + lineHeight);
  return container;
}

/** 1文字がルビ対象かを見て、対応する読みがあれば返します。 */
function getRuby(char: string): string | null {
  if (!KANJI_PATTERN.test(char) || ALLOWED_DISPLAY_KANJI.has(char)) {
    return null;
  }

  return RUBY_BY_KANJI[char] ?? null;
}

/** 折り返し計算用に、同じフォント設定で文字幅だけを測ります。 */
function measureText(
  scene: Phaser.Scene,
  text: string,
  fontSize: number,
  fontStyle = '700',
): number {
  const temporaryText = scene.add.text(-1000, -1000, text, {
    fontFamily: FONT_FAMILY,
    fontSize: `${fontSize}px`,
    fontStyle,
  });
  const width = temporaryText.width;
  temporaryText.destroy();
  return width;
}
