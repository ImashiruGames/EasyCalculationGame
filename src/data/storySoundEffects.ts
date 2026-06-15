export interface StorySoundEffectDefinition {
  id: string;
  label: string;
  key: string;
  fileName: string;
  path: string;
}

const STORY_SOUND_EFFECT_BASE_PATH = 'assets/story';

/** ストーリー用の効果音ファイル定義を、Phaserで読みやすい形にまとめます。 */
function createStorySoundEffect(id: string, label: string, fileName: string): StorySoundEffectDefinition {
  return {
    id,
    label,
    key: `story-se-${id}`,
    fileName,
    path: `${STORY_SOUND_EFFECT_BASE_PATH}/${fileName}`,
  };
}

export const storySoundEffects: StorySoundEffectDefinition[] = [
  createStorySoundEffect('wadaiko-don', 'たいこ ドン', 'story-se-wadaiko-don.mp3'),
  createStorySoundEffect('wadaiko-dodon', 'たいこ ドドン', 'story-se-wadaiko-dodon.mp3'),
  createStorySoundEffect('wadaiko-kakatsu', 'たいこ カカッ', 'story-se-wadaiko-kakatsu.mp3'),
  createStorySoundEffect('trumpet-fanfare', 'ラッパ', 'story-se-trumpet-fanfare.mp3'),
  createStorySoundEffect('level-up', 'レベルアップ', 'story-se-level-up.mp3'),
  createStorySoundEffect('curse-melody', 'こわいメロディ', 'story-se-curse-melody.mp3'),
  createStorySoundEffect('drum-roll', 'ドラムロール', 'story-se-drum-roll.mp3'),
  createStorySoundEffect('timpani-roll', 'ティンパニロール', 'story-se-timpani-roll.mp3'),
  createStorySoundEffect('roll-close', 'ロールしめ', 'story-se-roll-close.mp3'),
  createStorySoundEffect('jan', 'ジャン', 'story-se-jan.mp3'),
  createStorySoundEffect('jajaan', 'ジャジャーン', 'story-se-jajaan.mp3'),
  createStorySoundEffect('chan-chan-1', 'ちゃんちゃん1', 'story-se-chan-chan-1.mp3'),
  createStorySoundEffect('chan-chan-2', 'ちゃんちゃん2', 'story-se-chan-chan-2.mp3'),
  createStorySoundEffect('chan-chan-3', 'ちゃんちゃん3', 'story-se-chan-chan-3.mp3'),
  createStorySoundEffect('doon', 'ドーン', 'story-se-doon.mp3'),
  createStorySoundEffect('men-ou', '男 オウ', 'story-se-men-ou.mp3'),
  createStorySoundEffect('women-ou', '女 おう', 'story-se-women-ou.mp3'),
  createStorySoundEffect('transition-1', 'きりかえ1', 'story-se-transition-1.mp3'),
  createStorySoundEffect('money', 'お金', 'story-se-money.mp3'),
  createStorySoundEffect('hyoshigi-1', 'ひょうしぎ1', 'story-se-hyoshigi-1.mp3'),
  createStorySoundEffect('nyutsu-2', 'ニュッ2', 'story-se-nyutsu-2.mp3'),
  createStorySoundEffect('puyon', 'ぷよん', 'story-se-puyon.mp3'),
  createStorySoundEffect('slip', 'すべる', 'story-se-slip.mp3'),
  createStorySoundEffect('jump', 'ジャンプ', 'story-se-jump.mp3'),
  createStorySoundEffect('switch-press', 'スイッチ', 'story-se-switch-press.mp3'),
  createStorySoundEffect('supo', 'スポッ', 'story-se-supo.mp3'),
  createStorySoundEffect('dondon-pafupafu', 'ドンパフ', 'story-se-dondon-pafupafu.mp3'),
  createStorySoundEffect('piko', 'ピコッ', 'story-se-piko.mp3'),
  createStorySoundEffect('cute-footstep', '足音', 'story-se-cute-footstep.mp3'),
  createStorySoundEffect('cute-move', 'うごく', 'story-se-cute-move.mp3'),
  createStorySoundEffect('cute-sit', 'すわる', 'story-se-cute-sit.mp3'),
  createStorySoundEffect('flashback', '思い出', 'story-se-flashback.mp3'),
  createStorySoundEffect('shoe-brake', 'ブレーキ', 'story-se-shoe-brake.mp3'),
  createStorySoundEffect('beep', 'ピー音', 'story-se-beep.mp3'),
  createStorySoundEffect('bite', 'パクッ', 'story-se-bite.mp3'),
  createStorySoundEffect('battle-card-1', 'カード1', 'story-se-battle-card-1.mp3'),
  createStorySoundEffect('battle-card-2', 'カード2', 'story-se-battle-card-2.mp3'),
  createStorySoundEffect('fast-dash', 'ダッシュ', 'story-se-fast-dash.mp3'),
  createStorySoundEffect('stunned', '目が点', 'story-se-stunned.mp3'),
  createStorySoundEffect('tear-drop', 'しずく', 'story-se-tear-drop.mp3'),
  createStorySoundEffect('chalk-write', 'チョーク', 'story-se-chalk-write.mp3'),
  createStorySoundEffect('question-1', 'しゅつだい1', 'story-se-question-1.mp3'),
  createStorySoundEffect('bonfire', 'たき火', 'story-se-bonfire.mp3'),
  createStorySoundEffect('quiz-correct-1', 'クイズ正かい1', 'story-se-quiz-correct-1.mp3'),
  createStorySoundEffect('gauge-heal-1', 'ゲージかいふく1', 'story-se-gauge-heal-1.mp3'),
];

const storySoundEffectById = new Map(storySoundEffects.map((effect) => [effect.id, effect]));

/** 効果音IDから、ストーリー用の効果音定義を探します。 */
export function getStorySoundEffectById(id: string | null | undefined): StorySoundEffectDefinition | undefined {
  return id ? storySoundEffectById.get(id) : undefined;
}
