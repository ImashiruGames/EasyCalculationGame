import * as Phaser from 'phaser';
import { getStorySoundEffectById, storySoundEffects } from '../../data/storySoundEffects';

const DEFAULT_STORY_SOUND_EFFECT_VOLUME = 0.72;

/** ストーリー用の効果音を、まだ読み込まれていないものだけPhaserの読み込みキューに入れます。 */
export function preloadStorySoundEffects(scene: Phaser.Scene): void {
  storySoundEffects.forEach((effect) => {
    if (!scene.cache.audio.exists(effect.key)) {
      scene.load.audio(effect.key, effect.path);
    }
  });
}

/** 指定されたストーリー効果音IDを、読み込み済みなら一度だけ再生して、停止用の音オブジェクトを返します。 */
export function playStorySoundEffect(
  scene: Phaser.Scene,
  soundEffectId: string | null | undefined,
  volume = DEFAULT_STORY_SOUND_EFFECT_VOLUME,
): Phaser.Sound.BaseSound | null {
  const effect = getStorySoundEffectById(soundEffectId);
  if (!effect || !scene.cache.audio.exists(effect.key)) {
    return null;
  }

  const sound = scene.sound.add(effect.key, { volume });
  sound.once('complete', () => sound.destroy());
  if (!sound.play()) {
    sound.destroy();
    return null;
  }

  return sound;
}
