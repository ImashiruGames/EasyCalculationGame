import * as Phaser from 'phaser';

/** Stops animations when a view is removed before the owning scene shuts down. */
export function stopTweensOnDestroy(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void {
  target.once('destroy', () => scene.tweens.killTweensOf(target));
  if (target instanceof Phaser.GameObjects.Container) {
    target.list.forEach((child) => stopTweensOnDestroy(scene, child));
  }
}
