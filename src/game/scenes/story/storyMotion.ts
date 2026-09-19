import * as Phaser from 'phaser';
import type { StoryCreatorActorMotion, StoryCreatorMoveMotion } from '../../../state/storyCreator';

type StoryMotionTarget = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface StoryMotionStep {
  x?: number;
  y?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
  duration: number;
  delay?: number;
  ease: string;
  yoyo?: boolean;
  repeat?: number;
}

const APPEAR_DISTANCE = 86;
const DEFAULT_MOVE_SPEED = 160;

/** Adds a saved story motion preset to a Phaser target. */
export function applyStoryActorMotion(
  scene: Phaser.Scene,
  target: StoryMotionTarget,
  motion: StoryCreatorActorMotion,
  moveMotion?: StoryCreatorMoveMotion,
): void {
  if (motion === 'move') {
    applyMoveMotion(scene, target, moveMotion);
    return;
  }

  if (motion === 'bounce') {
    scene.tweens.add({
      targets: target,
      y: target.y - 10,
      duration: 460,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    return;
  }

  if (motion === 'sway') {
    scene.tweens.add({
      targets: target,
      x: target.x + 10,
      duration: 560,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    return;
  }

  if (motion === 'twitch') {
    applyTwitchMotion(scene, target);
    return;
  }

  if (motion === 'slide') {
    applySlideMotion(scene, target);
    return;
  }

  if (motion === 'spin') {
    scene.tweens.add({
      targets: target,
      angle: target.angle + 360,
      duration: 760,
      ease: 'Linear',
    });
    return;
  }

  if (motion === 'pulse') {
    scene.tweens.add({
      targets: target,
      scaleX: target.scaleX * 1.16,
      scaleY: target.scaleY * 1.16,
      duration: 300,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    return;
  }

  if (motion === 'blink') {
    scene.tweens.add({
      targets: target,
      alpha: 0.18,
      duration: 130,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });
    return;
  }

  if (motion === 'spinPulse') {
    applySpinPulseMotion(scene, target);
  }
}

/** Moves a target from a saved start offset to its saved spot. */
function applyMoveMotion(scene: Phaser.Scene, target: StoryMotionTarget, moveMotion?: StoryCreatorMoveMotion): void {
  const baseX = target.x;
  const baseY = target.y;
  const startX = moveMotion?.startX ?? -APPEAR_DISTANCE;
  const startY = moveMotion?.startY ?? 0;
  target.setPosition(baseX + startX, baseY + startY);
  scene.tweens.add({
    targets: target,
    x: baseX,
    y: baseY,
    duration: getMoveDuration(startX, startY, moveMotion?.speed ?? DEFAULT_MOVE_SPEED),
    ease: 'Linear',
  });
}

/** Converts move speed into a tween duration. */
function getMoveDuration(offsetX: number, offsetY: number, speed: number): number {
  const distance = Phaser.Math.Distance.Between(0, 0, offsetX, offsetY);
  if (distance <= 0) {
    return 1;
  }

  return Phaser.Math.Clamp(Math.round((distance / Math.max(1, speed)) * 1000), 80, 4000);
}

/** Plays a short angular shake around the saved spot. */
function applyTwitchMotion(scene: Phaser.Scene, target: StoryMotionTarget): void {
  const baseX = target.x;
  const baseY = target.y;
  const baseAngle = target.angle;
  playTweenSteps(scene, target, [
    {
      x: baseX + 8,
      y: baseY - 4,
      angle: baseAngle - 4,
      duration: 70,
      ease: 'Quad.easeOut',
    },
    {
      x: baseX - 6,
      y: baseY + 3,
      angle: baseAngle + 4,
      duration: 80,
      ease: 'Quad.easeInOut',
    },
    {
      x: baseX,
      y: baseY,
      angle: baseAngle,
      duration: 100,
      ease: 'Back.easeOut',
    },
  ]);
}

/** Slides a target sideways, then returns it to the saved spot. */
function applySlideMotion(scene: Phaser.Scene, target: StoryMotionTarget): void {
  const baseX = target.x;
  playTweenSteps(scene, target, [
    {
      x: baseX + 30,
      duration: 130,
      ease: 'Quad.easeOut',
    },
    {
      x: baseX,
      duration: 260,
      ease: 'Cubic.easeOut',
    },
  ]);
}

/** Spins a target once while it grows and returns to size. */
function applySpinPulseMotion(scene: Phaser.Scene, target: StoryMotionTarget): void {
  const baseAngle = target.angle;
  const baseScaleX = target.scaleX;
  const baseScaleY = target.scaleY;
  playTweenSteps(scene, target, [
    {
      angle: baseAngle + 180,
      scaleX: baseScaleX * 1.18,
      scaleY: baseScaleY * 1.18,
      duration: 320,
      ease: 'Sine.easeOut',
    },
    {
      angle: baseAngle + 360,
      scaleX: baseScaleX,
      scaleY: baseScaleY,
      duration: 360,
      ease: 'Sine.easeIn',
    },
  ]);
}

/** Plays tween steps in order for one story target. */
function playTweenSteps(
  scene: Phaser.Scene,
  target: StoryMotionTarget,
  steps: StoryMotionStep[],
  index = 0,
): void {
  const step = steps[index];
  if (!step) {
    return;
  }

  scene.tweens.add({
    targets: target,
    ...step,
    onComplete: () => playTweenSteps(scene, target, steps, index + 1),
  });
}
