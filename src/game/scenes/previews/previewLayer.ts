import * as Phaser from 'phaser';

/** 描画中に追加された表示物を、あとでまとめて消せるレイヤーに入れます。 */
export function captureDrawLayer(scene: Phaser.Scene, draw: () => void): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0);
  const existingChildren = new Set(scene.children.getChildren());
  draw();
  const addedChildren = scene.children
    .getChildren()
    .filter((child) => child !== layer && !existingChildren.has(child));
  addedChildren.forEach((child) => layer.add(child));
  return layer;
}
