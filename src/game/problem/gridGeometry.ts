import type { GridExpressionGroupDefinition } from '../types';

/** Expands either rectangle groups or cell groups into individual cells. */
export function getGridExpressionGroupCells(
  group: GridExpressionGroupDefinition,
): Array<{ col: number; row: number }> {
  if (group.cells?.length) {
    return group.cells.map((cell) => ({ ...cell }));
  }

  if (!isGridExpressionRectGroup(group)) {
    return [];
  }

  const cells: Array<{ col: number; row: number }> = [];
  for (let row = group.row; row < group.row + group.rows; row += 1) {
    for (let col = group.col; col < group.col + group.cols; col += 1) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** Gets group bounds for label placement. */
export function getGridExpressionGroupBounds(
  group: GridExpressionGroupDefinition,
): { minCol: number; minRow: number; maxCol: number; maxRow: number } | undefined {
  const cells = getGridExpressionGroupCells(group);
  if (cells.length === 0) {
    return undefined;
  }

  return cells.reduce((bounds, cell) => ({
    minCol: Math.min(bounds.minCol, cell.col),
    minRow: Math.min(bounds.minRow, cell.row),
    maxCol: Math.max(bounds.maxCol, cell.col),
    maxRow: Math.max(bounds.maxRow, cell.row),
  }), {
    minCol: cells[0].col,
    minRow: cells[0].row,
    maxCol: cells[0].col,
    maxRow: cells[0].row,
  });
}

/** Checks whether a group has the old rectangle fields. */
export function isGridExpressionRectGroup(
  group: GridExpressionGroupDefinition,
): group is { col: number; row: number; cols: number; rows: number; label?: string } {
  return Number.isInteger(group.col)
    && Number.isInteger(group.row)
    && Number.isInteger(group.cols)
    && Number.isInteger(group.rows);
}
