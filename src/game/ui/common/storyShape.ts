import * as Phaser from 'phaser';
import type { StoryCreatorPlacement, StoryCreatorShape, StoryCreatorShapePoint } from '../../../state/storyCreator';
import { COLORS } from '../../constants';
import { createRichText } from './richText';

interface StoryShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StoryShapeDrawOptions {
  depth: number;
  showPoints?: boolean;
  selected?: boolean;
  selectedPointIndex?: number;
}

interface StoryShapeDrawResult {
  bounds: StoryShapeBounds;
  points: StoryCreatorShapePoint[];
  objects: Phaser.GameObjects.GameObject[];
}

const LABEL_WIDTH = 112;
const LABEL_HEIGHT = 30;
const MIN_HIT_SIZE = 48;

/** CSS色をPhaserで使う数にします。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/** ずけいの点を、はいち先のがめん上の点にします。 */
export function getStoryShapeScreenPoints(
  placement: StoryCreatorPlacement,
  shape: StoryCreatorShape,
): StoryCreatorShapePoint[] {
  const scale = placement.scale || 1;
  return shape.points.map((point) => ({
    x: placement.x + point.x * scale,
    y: placement.y + point.y * scale,
  }));
}

/** ずけいの点を、はいち内のローカルなはんいにします。 */
export function getStoryShapeLocalBounds(shape: StoryCreatorShape, scale: number): StoryShapeBounds {
  const points = shape.points.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));
  return getPointBounds(points);
}

/** ずけいのがめん上のはんいを出します。 */
export function getStoryShapeScreenBounds(
  placement: StoryCreatorPlacement,
  shape: StoryCreatorShape,
): StoryShapeBounds {
  return getPointBounds(getStoryShapeScreenPoints(placement, shape));
}

/** タップやドラッグ用に、せまいずけいのはんいを少し広げます。 */
export function getStoryShapeHitBounds(
  placement: StoryCreatorPlacement,
  shape: StoryCreatorShape,
): StoryShapeBounds {
  const bounds = getStoryShapeScreenBounds(placement, shape);
  const width = Math.max(bounds.width, MIN_HIT_SIZE);
  const height = Math.max(bounds.height, MIN_HIT_SIZE);
  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height,
  };
}

/** 点のならびから、外がわのはんいを作ります。 */
function getPointBounds(points: StoryCreatorShapePoint[]): StoryShapeBounds {
  if (!points.length) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/** ずけい本体、点、線ラベルをがめんにかきます。 */
export function drawStoryShape(
  scene: Phaser.Scene,
  placement: StoryCreatorPlacement,
  shape: StoryCreatorShape,
  options: StoryShapeDrawOptions,
): StoryShapeDrawResult {
  const points = getStoryShapeScreenPoints(placement, shape);
  const bounds = getStoryShapeScreenBounds(placement, shape);
  const graphics = scene.add.graphics().setDepth(options.depth);
  drawShapeBody(graphics, points, shape, placement.scale || 1);
  const objects: Phaser.GameObjects.GameObject[] = [graphics, ...drawShapeLabels(scene, points, shape, options.depth + 2)];

  if (options.selected) {
    drawShapeSelection(graphics, bounds);
  }

  if (options.showPoints) {
    drawShapePoints(graphics, points, options.selectedPointIndex ?? -1);
  }

  return { bounds, points, objects };
}

/** 点どうしをむすんで、ぬりと線をかきます。 */
function drawShapeBody(
  graphics: Phaser.GameObjects.Graphics,
  points: StoryCreatorShapePoint[],
  shape: StoryCreatorShape,
  scale: number,
): void {
  if (points.length < 2) {
    return;
  }

  graphics.lineStyle(Math.max(1, shape.strokeWidth * scale), colorToNumber(shape.strokeColor), 1);
  if (shape.closed && points.length >= 3) {
    graphics.fillStyle(colorToNumber(shape.fillColor), 0.54);
  }

  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
  if (shape.closed && points.length >= 3) {
    graphics.closePath();
    graphics.fillPath();
  }
  graphics.strokePath();
}

/** 線についたラベルを、線のまん中から少し外へずらしてかきます。 */
function drawShapeLabels(
  scene: Phaser.Scene,
  points: StoryCreatorShapePoint[],
  shape: StoryCreatorShape,
  depth: number,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  shape.labels.forEach((label) => {
    const from = points[label.from];
    const to = points[label.to];
    const text = label.text.trim();
    if (!from || !to || !text) {
      return;
    }

    const labelPoint = getShapeLabelPoint(from, to, label.offset);
    const background = scene.add.graphics().setDepth(depth - 1);
    background.fillStyle(colorToNumber('#ffffff'), 0.9);
    background.lineStyle(1, colorToNumber('#c7dbec'), 0.9);
    background.fillRoundedRect(labelPoint.x - LABEL_WIDTH / 2, labelPoint.y - LABEL_HEIGHT / 2, LABEL_WIDTH, LABEL_HEIGHT, 8);
    background.strokeRoundedRect(labelPoint.x - LABEL_WIDTH / 2, labelPoint.y - LABEL_HEIGHT / 2, LABEL_WIDTH, LABEL_HEIGHT, 8);
    objects.push(background);

    const labelObject = createRichText(scene, labelPoint.x - LABEL_WIDTH / 2, labelPoint.y - 11, text, {
      width: LABEL_WIDTH,
      fontSize: 16,
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
      depth,
    });
    objects.push(labelObject);
  });
  return objects;
}

/** 線ラベルのがめん上の点を計算します。 */
function getShapeLabelPoint(
  from: StoryCreatorShapePoint,
  to: StoryCreatorShapePoint,
  offset: number,
): StoryCreatorShapePoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: (from.x + to.x) / 2 + (-dy / length) * offset,
    y: (from.y + to.y) / 2 + (dx / length) * offset,
  };
}

/** えらんだずけいの外わくをかきます。 */
function drawShapeSelection(graphics: Phaser.GameObjects.Graphics, bounds: StoryShapeBounds): void {
  graphics.lineStyle(2, colorToNumber('#2364aa'), 0.9);
  graphics.strokeRoundedRect(bounds.x - 8, bounds.y - 8, bounds.width + 16, bounds.height + 16, 8);
}

/** ずけいの点を丸でかき、えらんだ点だけ強く見せます。 */
function drawShapePoints(
  graphics: Phaser.GameObjects.Graphics,
  points: StoryCreatorShapePoint[],
  selectedPointIndex: number,
): void {
  points.forEach((point, index) => {
    const selected = index === selectedPointIndex;
    graphics.fillStyle(colorToNumber(selected ? '#fff1a8' : '#ffffff'), 1);
    graphics.lineStyle(selected ? 3 : 2, colorToNumber(selected ? '#b8941e' : '#2364aa'), 1);
    graphics.fillCircle(point.x, point.y, selected ? 7 : 5);
    graphics.strokeCircle(point.x, point.y, selected ? 7 : 5);
  });
}
