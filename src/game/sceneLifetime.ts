import type * as Phaser from 'phaser';

/** Runs cleanup once on shutdown or destroy; calling the result also cleans up early. */
export function onSceneExit(scene: Phaser.Scene, cleanup: () => void): () => void {
  let finished = false;
  /** Removes both listeners before cleanup so restarts cannot retain old closures. */
  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    scene.events.off('shutdown', finish);
    scene.events.off('destroy', finish);
    cleanup();
  };
  scene.events.once('shutdown', finish);
  scene.events.once('destroy', finish);
  return finish;
}

/** Creates a per-visit signal that prevents async results from reaching a later visit. */
export function createSceneLifetime(scene: Phaser.Scene): AbortSignal {
  const controller = new AbortController();
  onSceneExit(scene, () => controller.abort());
  return controller.signal;
}

/** Accepts one tap, Enter, or Space and removes the other competing listeners. */
export function onceSceneAdvance(scene: Phaser.Scene, callback: () => void): () => void {
  /** Cancels the remaining inputs before advancing to the next interaction. */
  const advance = (): void => {
    cancel();
    callback();
  };
  const cancel = onSceneExit(scene, () => {
    scene.input.off('pointerdown', advance);
    scene.input.keyboard?.off('keydown-ENTER', advance);
    scene.input.keyboard?.off('keydown-SPACE', advance);
  });
  scene.input.once('pointerdown', advance);
  scene.input.keyboard?.once('keydown-ENTER', advance);
  scene.input.keyboard?.once('keydown-SPACE', advance);
  return cancel;
}
