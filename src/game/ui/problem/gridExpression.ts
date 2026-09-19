import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import { FONT_FAMILY, GAME_WIDTH } from '../../constants';
import {
  getGridExpressionGroupBounds,
  getGridExpressionGroupCells,
  isGridExpressionRectGroup,
} from '../../problem/gridGeometry';
import type { GridExpressionGroupDefinition, GridExpressionProblemDefinition } from '../../types';
import { createMonsterVisual } from '../creatures/monsterVisual';

interface GridCellLayout {
  x: number;
  y: number;
  cellSize: number;
  width: number;
  height: number;
}

interface GridExpressionRenderOptions {
  top: number;
  maxHeight: number;
  monsterSize: number;
  labelFontSize: number;
}

/** Draws the authored grid content without editor cell lines. */
export function drawGridExpressionGrid(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  definition: GridExpressionProblemDefinition,
  options: GridExpressionRenderOptions,
): void {
  const layout = getGridExpressionCellLayout(definition.grid.cols, definition.grid.rows, options);
  const graphics = scene.add.graphics();

  graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fffaf0').color, 0.68);
  graphics.fillRoundedRect(layout.x - 10, layout.y - 10, layout.width + 20, layout.height + 20, 16);
  drawGridExpressionGroups(scene, layer, graphics, definition, layout, options);
  layer.add(graphics);
  drawGridExpressionObjects(scene, layer, definition, layout, options);
}

/** Draws grouping outlines that show each set in the authored picture. */
function drawGridExpressionGroups(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  graphics: Phaser.GameObjects.Graphics,
  definition: GridExpressionProblemDefinition,
  layout: GridCellLayout,
  options: GridExpressionRenderOptions,
): void {
  const groups = definition.groups ?? [];
  groups.forEach((group) => drawGridExpressionGroupOutline(graphics, group, layout));

  groups
    .filter((group) => group.label)
    .forEach((group) => {
      const bounds = getGridExpressionGroupBounds(group);
      if (!bounds) {
        return;
      }

      const label = scene.add
        .text(
          layout.x + (bounds.minCol + (bounds.maxCol - bounds.minCol + 1) / 2) * layout.cellSize,
          layout.y + bounds.minRow * layout.cellSize - 8,
          group.label ?? '',
          {
            fontFamily: FONT_FAMILY,
            fontSize: `${options.labelFontSize}px`,
            fontStyle: '900',
            color: '#b24e24',
            align: 'center',
          },
        )
        .setOrigin(0.5);
      layer.add(label);
    });
}

/** Draws one group outline, supporting both rectangles and painted cell groups. */
function drawGridExpressionGroupOutline(
  graphics: Phaser.GameObjects.Graphics,
  group: GridExpressionGroupDefinition,
  layout: GridCellLayout,
): void {
  graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor('#ef8354').color, 0.86);
  if (!group.cells?.length && isGridExpressionRectGroup(group)) {
    const x = layout.x + group.col * layout.cellSize + 3;
    const y = layout.y + group.row * layout.cellSize + 3;
    const width = group.cols * layout.cellSize - 6;
    const height = group.rows * layout.cellSize - 6;
    graphics.strokeRoundedRect(x, y, width, height, 12);
    return;
  }

  strokeGridExpressionCellGroup(graphics, getGridExpressionGroupCells(group), layout);
}

/** Draws the outside edges for a group made from arbitrary cells. */
function strokeGridExpressionCellGroup(
  graphics: Phaser.GameObjects.Graphics,
  cells: Array<{ col: number; row: number }>,
  layout: GridCellLayout,
): void {
  const cellKeys = new Set(cells.map((cell) => `${cell.col}:${cell.row}`));
  const inset = 3;
  cells.forEach((cell) => {
    const x = layout.x + cell.col * layout.cellSize;
    const y = layout.y + cell.row * layout.cellSize;
    const left = !cellKeys.has(`${cell.col - 1}:${cell.row}`);
    const right = !cellKeys.has(`${cell.col + 1}:${cell.row}`);
    const top = !cellKeys.has(`${cell.col}:${cell.row - 1}`);
    const bottom = !cellKeys.has(`${cell.col}:${cell.row + 1}`);
    if (top) {
      graphics.lineBetween(x + inset, y + inset, x + layout.cellSize - inset, y + inset);
    }
    if (right) {
      graphics.lineBetween(x + layout.cellSize - inset, y + inset, x + layout.cellSize - inset, y + layout.cellSize - inset);
    }
    if (bottom) {
      graphics.lineBetween(x + inset, y + layout.cellSize - inset, x + layout.cellSize - inset, y + layout.cellSize - inset);
    }
    if (left) {
      graphics.lineBetween(x + inset, y + inset, x + inset, y + layout.cellSize - inset);
    }
  });
}

/** Places each monster from the authored grid into its display cell. */
function drawGridExpressionObjects(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  definition: GridExpressionProblemDefinition,
  layout: GridCellLayout,
  options: GridExpressionRenderOptions,
): void {
  definition.objects.forEach((object) => {
    const monsterId = definition.chars[object.char] ?? definition.chars[0];
    if (!monsterId) {
      return;
    }

    const monster = getMonsterById(monsterId);
    const visual = createMonsterVisual(
      scene,
      monster,
      layout.x + (object.col + 0.5) * layout.cellSize,
      layout.y + (object.row + 0.5) * layout.cellSize,
      Math.min(options.monsterSize, layout.cellSize * 0.74),
    );
    layer.add(visual);
  });
}

/** Calculates a centered grid rectangle that fits inside the capture problem card. */
function getGridExpressionCellLayout(cols: number, rows: number, options: GridExpressionRenderOptions): GridCellLayout {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  const maxWidth = 284;
  const maxHeight = options.maxHeight;
  const cellSize = Math.floor(Math.min(maxWidth / safeCols, maxHeight / safeRows));
  const width = cellSize * safeCols;
  const height = cellSize * safeRows;
  return {
    x: Math.round((GAME_WIDTH - width) / 2),
    y: options.top,
    cellSize,
    width,
    height,
  };
}
