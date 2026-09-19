import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import type {
  GridExpressionGroupDefinition,
  GridExpressionObjectDefinition,
  GridExpressionProblemDefinition,
} from '../../types';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';

const EDITOR_GRID_X = 31;
const EDITOR_GRID_Y = 212;
const EDITOR_GRID_WIDTH = 328;
const EDITOR_GRID_HEIGHT = 328;

type GridEditorMode = 'object' | 'rectGroup' | 'paintGroup' | 'groupErase';

interface GridCellPosition {
  col: number;
  row: number;
}

type GridEditorInputKind = 'text' | 'number';

interface GridEditorInputRequest {
  label: string;
  value: string;
  kind: GridEditorInputKind;
  min?: number;
  maxLength?: number;
  validate?: (value: string) => boolean;
  onSubmit: (value: string) => void;
}

export class GridProblemEditorScene extends Phaser.Scene {
  private stageId = 'stage4_1';
  private problemNo = 1;
  private cols = 8;
  private rows = 5;
  private expression = '3 × □ = 12';
  private answer = 4;
  private selectedChar = 0;
  private editMode: GridEditorMode = 'object';
  private readonly chars = ['picoleaf', 'mokotane'];
  private objects: GridExpressionObjectDefinition[] = [
    { char: 0, col: 0, row: 0 },
    { char: 0, col: 1, row: 0 },
    { char: 0, col: 2, row: 0 },
    { char: 0, col: 5, row: 0 },
    { char: 0, col: 6, row: 0 },
    { char: 0, col: 7, row: 0 },
    { char: 0, col: 0, row: 3 },
    { char: 0, col: 1, row: 3 },
    { char: 0, col: 2, row: 3 },
    { char: 0, col: 5, row: 3 },
    { char: 0, col: 6, row: 3 },
    { char: 0, col: 7, row: 3 },
  ];
  private groups: GridExpressionGroupDefinition[] = [
    { col: 0, row: 0, cols: 3, rows: 1, label: '3こ' },
    { col: 5, row: 0, cols: 3, rows: 1, label: '3こ' },
    { col: 0, row: 3, cols: 3, rows: 1, label: '3こ' },
    { col: 5, row: 3, cols: 3, rows: 1, label: '3こ' },
  ];
  private gridLayer?: Phaser.GameObjects.Container;
  private paletteLayer?: Phaser.GameObjects.Container;
  private infoText?: Phaser.GameObjects.Text;
  private expressionText?: Phaser.GameObjects.Text;
  private groupDragStart?: GridCellPosition;
  private groupDragEnd?: GridCellPosition;
  private paintGroupCells: GridCellPosition[] = [];
  private isPaintingGroup = false;
  private inputLayer?: Phaser.GameObjects.Container;
  private editorInput?: HTMLInputElement;
  private inputRequest?: GridEditorInputRequest;

  /** Repositions the native input when the canvas changes size. */
  private readonly handleWindowResize = (): void => {
    this.positionEditorInput();
  };

  /** Registers the grid problem editor scene. */
  constructor() {
    super(SceneKeys.GridProblemEditor);
  }

  /** Queues the fixed monster assets used by the editor palette. */
  preload(): void {
    preloadMonsterImageAssetsByIds(this, this.chars);
  }

  /** Draws the editor controls and editable grid. */
  create(): void {
    this.cameras.main.setBackgroundColor('#f6fbff');
    this.drawBackground();
    createSmallButton(this, 42, 48, '←', () => this.scene.start(SceneKeys.MainMenu));

    this.add
      .text(GAME_WIDTH / 2, 54, 'ますしき', {
        fontFamily: FONT_FAMILY,
        fontSize: '31px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.infoText = this.add
      .text(GAME_WIDTH / 2, 94, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    this.drawTopControls();
    this.drawPalette();
    this.drawGrid();
    this.drawExpressionControls();
    this.updateLabels();

    this.input.on('pointermove', this.handleGroupPointerMove, this);
    this.input.on('pointerup', this.handleGroupPointerUp, this);
    window.addEventListener('resize', this.handleWindowResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', this.handleGroupPointerMove, this);
      this.input.off('pointerup', this.handleGroupPointerUp, this);
      window.removeEventListener('resize', this.handleWindowResize);
      this.closeEditorInput();
    });
  }

  /** Draws the soft page background. */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#f6fbff').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff2d8').color, 1);
    graphics.fillRoundedRect(18, 132, 354, 538, 24);
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor('#d9c39f').color, 0.86);
    graphics.strokeRoundedRect(18, 132, 354, 538, 24);
  }

  /** Draws buttons that edit stage id, problem number, and grid size. */
  private drawTopControls(): void {
    createButton(this, {
      x: 76,
      y: 146,
      width: 96,
      height: 38,
      label: 'ID',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 16,
      onClick: () => this.promptStageId(),
    });
    createButton(this, {
      x: 178,
      y: 146,
      width: 86,
      height: 38,
      label: 'pNo',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 16,
      onClick: () => this.promptProblemNo(),
    });
    createButton(this, {
      x: 272,
      y: 146,
      width: 86,
      height: 38,
      label: 'JSON',
      fillColor: COLORS.yellow,
      strokeColor: '#b52a24',
      fontSize: 16,
      onClick: () => this.downloadCurrentProblem(),
    });

    createButton(this, {
      x: 72,
      y: 184,
      width: 72,
      height: 32,
      label: 'よこ-',
      fillColor: '#d7f0ff',
      strokeColor: '#276b9e',
      fontSize: 14,
      onClick: () => this.resizeGrid(this.cols - 1, this.rows),
    });
    createButton(this, {
      x: 148,
      y: 184,
      width: 72,
      height: 32,
      label: 'よこ+',
      fillColor: '#d7f0ff',
      strokeColor: '#276b9e',
      fontSize: 14,
      onClick: () => this.resizeGrid(this.cols + 1, this.rows),
    });
    createButton(this, {
      x: 244,
      y: 184,
      width: 72,
      height: 32,
      label: 'たて-',
      fillColor: '#e0f8e9',
      strokeColor: '#2f9f61',
      fontSize: 14,
      onClick: () => this.resizeGrid(this.cols, this.rows - 1),
    });
    createButton(this, {
      x: 320,
      y: 184,
      width: 72,
      height: 32,
      label: 'たて+',
      fillColor: '#e0f8e9',
      strokeColor: '#2f9f61',
      fontSize: 14,
      onClick: () => this.resizeGrid(this.cols, this.rows + 1),
    });
  }

  /** Draws the fixed character palette used by placed grid cells. */
  private drawPalette(): void {
    this.paletteLayer?.destroy(true);
    const layer = this.add.container(0, 0);
    this.paletteLayer = layer;

    layer.add(createButton(this, {
      x: 52,
      y: 534,
      width: 66,
      height: 32,
      label: 'キャラ',
      fillColor: this.editMode === 'object' ? COLORS.yellow : COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 14,
      onClick: () => this.selectEditMode('object'),
    }));
    layer.add(createButton(this, {
      x: 126,
      y: 534,
      width: 66,
      height: 32,
      label: 'しかく',
      fillColor: this.editMode === 'rectGroup' ? COLORS.yellow : COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 13,
      onClick: () => this.selectEditMode('rectGroup'),
    }));
    layer.add(createButton(this, {
      x: 200,
      y: 534,
      width: 66,
      height: 32,
      label: 'ぬる',
      fillColor: this.editMode === 'paintGroup' ? COLORS.yellow : COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 14,
      onClick: () => this.selectEditMode('paintGroup'),
    }));
    layer.add(createButton(this, {
      x: 296,
      y: 534,
      width: 104,
      height: 32,
      label: 'わくけす',
      fillColor: this.editMode === 'groupErase' ? '#ffd7d7' : COLORS.panel,
      strokeColor: '#b52a24',
      textColor: COLORS.ink,
      fontSize: 13,
      onClick: () => this.selectEditMode('groupErase'),
    }));

    this.chars.forEach((monsterId, index) => {
      const x = 86 + index * 120;
      const monster = getMonsterById(monsterId);
      layer.add(createButton(this, {
        x,
        y: 610,
        width: 102,
        height: 52,
        label: `chara[${index}]`,
        fillColor: this.editMode === 'object' && index === this.selectedChar ? COLORS.yellow : COLORS.panel,
        textColor: COLORS.ink,
        fontSize: 13,
        onClick: () => this.selectChar(index),
      }));
      layer.add(createMonsterVisual(this, monster, x, 576, 40));
    });

    layer.add(createButton(this, {
      x: 314,
      y: 610,
      width: 82,
      height: 52,
      label: 'けす',
      fillColor: this.editMode === 'object' && this.selectedChar < 0 ? '#ffd7d7' : COLORS.panel,
      strokeColor: '#b52a24',
      textColor: COLORS.ink,
      fontSize: 16,
      onClick: () => this.selectChar(-1),
    }));
  }

  /** Draws the editable grid and all placed monsters. */
  private drawGrid(): void {
    this.gridLayer?.destroy(true);
    const layer = this.add.container(0, 0);
    this.gridLayer = layer;

    const layout = this.getGridLayout();
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fffaf0').color, 1);
    graphics.fillRoundedRect(layout.x - 6, layout.y - 6, layout.width + 12, layout.height + 12, 14);
    graphics.lineStyle(1, Phaser.Display.Color.HexStringToColor('#bfa985').color, 0.92);

    for (let col = 0; col <= this.cols; col += 1) {
      const x = layout.x + col * layout.cellSize;
      graphics.lineBetween(x, layout.y, x, layout.y + layout.height);
    }
    for (let row = 0; row <= this.rows; row += 1) {
      const y = layout.y + row * layout.cellSize;
      graphics.lineBetween(layout.x, y, layout.x + layout.width, y);
    }

    layer.add(graphics);
    this.drawGridGroups(layer, layout);
    this.objects.forEach((object) => this.drawGridObject(layer, object, layout));
    this.addGridHitZones(layer, layout);
  }

  /** Draws saved group boxes and the current drag preview. */
  private drawGridGroups(
    layer: Phaser.GameObjects.Container,
    layout: { x: number; y: number; cellSize: number; width: number; height: number },
  ): void {
    const graphics = this.add.graphics();
    this.groups.forEach((group) => this.strokeGroupOutline(graphics, layout, group, '#ef8354', 0.9));

    const preview = this.getDraggingGroup();
    if (preview) {
      this.strokeGroupOutline(graphics, layout, preview, '#4e9ff8', 0.92);
    }
    const paintPreview = this.getPaintGroupPreview();
    if (paintPreview) {
      this.strokeGroupOutline(graphics, layout, paintPreview, '#4e9ff8', 0.92);
    }

    layer.add(graphics);
    this.groups
      .filter((group) => group.label)
      .forEach((group) => {
        const bounds = this.getGroupBounds(group);
        if (!bounds) {
          return;
        }

        const label = this.add
          .text(
            layout.x + (bounds.minCol + (bounds.maxCol - bounds.minCol + 1) / 2) * layout.cellSize,
            layout.y + bounds.minRow * layout.cellSize - 8,
            group.label ?? '',
            {
              fontFamily: FONT_FAMILY,
              fontSize: '13px',
              fontStyle: '900',
              color: '#b24e24',
              align: 'center',
            },
          )
          .setOrigin(0.5);
        layer.add(label);
      });
  }

  /** Strokes one group in grid cell coordinates. */
  private strokeGroupOutline(
    graphics: Phaser.GameObjects.Graphics,
    layout: { x: number; y: number; cellSize: number; width: number; height: number },
    group: GridExpressionGroupDefinition,
    color: string,
    alpha: number,
  ): void {
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(color).color, alpha);
    if (!group.cells?.length && this.isRectGroup(group)) {
      const x = layout.x + group.col * layout.cellSize + 3;
      const y = layout.y + group.row * layout.cellSize + 3;
      const width = group.cols * layout.cellSize - 6;
      const height = group.rows * layout.cellSize - 6;
      graphics.strokeRoundedRect(x, y, width, height, 12);
      return;
    }

    this.strokeCellGroupOutline(graphics, layout, this.getGroupCells(group));
  }

  /** Draws only the outside edges of an arbitrary cell group. */
  private strokeCellGroupOutline(
    graphics: Phaser.GameObjects.Graphics,
    layout: { x: number; y: number; cellSize: number; width: number; height: number },
    cells: GridCellPosition[],
  ): void {
    const cellKeys = new Set(cells.map((cell) => this.getCellKey(cell)));
    const inset = 3;
    cells.forEach((cell) => {
      const x = layout.x + cell.col * layout.cellSize;
      const y = layout.y + cell.row * layout.cellSize;
      const left = !cellKeys.has(this.getCellKey({ col: cell.col - 1, row: cell.row }));
      const right = !cellKeys.has(this.getCellKey({ col: cell.col + 1, row: cell.row }));
      const top = !cellKeys.has(this.getCellKey({ col: cell.col, row: cell.row - 1 }));
      const bottom = !cellKeys.has(this.getCellKey({ col: cell.col, row: cell.row + 1 }));
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

  /** Draws one monster object on the editor grid. */
  private drawGridObject(
    layer: Phaser.GameObjects.Container,
    object: GridExpressionObjectDefinition,
    layout: { x: number; y: number; cellSize: number; width: number; height: number },
  ): void {
    const monsterId = this.chars[object.char];
    if (!monsterId) {
      return;
    }

    const monster = getMonsterById(monsterId);
    layer.add(createMonsterVisual(
      this,
      monster,
      layout.x + (object.col + 0.5) * layout.cellSize,
      layout.y + (object.row + 0.5) * layout.cellSize,
      Math.min(46, layout.cellSize * 0.72),
    ));
  }

  /** Adds transparent hit zones so each cell can be edited by tapping. */
  private addGridHitZones(
    layer: Phaser.GameObjects.Container,
    layout: { x: number; y: number; cellSize: number; width: number; height: number },
  ): void {
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const zone = this.add
          .zone(
            layout.x + (col + 0.5) * layout.cellSize,
            layout.y + (row + 0.5) * layout.cellSize,
            layout.cellSize,
            layout.cellSize,
          )
          .setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.handleCellPointerDown(col, row));
        layer.add(zone);
      }
    }
  }

  /** Draws controls that edit the expression and answer. */
  private drawExpressionControls(): void {
    this.expressionText = this.add
      .text(GAME_WIDTH / 2, 688, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: 330, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 84,
      y: 746,
      width: 110,
      height: 48,
      label: 'しき',
      fillColor: '#d7f0ff',
      strokeColor: '#276b9e',
      fontSize: 18,
      onClick: () => this.promptExpression(),
    });
    createButton(this, {
      x: 196,
      y: 746,
      width: 110,
      height: 48,
      label: 'こたえ',
      fillColor: '#e0f8e9',
      strokeColor: '#2f9f61',
      fontSize: 18,
      onClick: () => this.promptAnswer(),
    });
    createButton(this, {
      x: 308,
      y: 746,
      width: 110,
      height: 48,
      label: 'リセット',
      fillColor: '#ffd7d7',
      strokeColor: '#b52a24',
      fontSize: 16,
      onClick: () => this.resetObjects(),
    });
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 810,
      width: 180,
      height: 48,
      label: 'テスト',
      fillColor: COLORS.yellow,
      strokeColor: '#b52a24',
      fontSize: 18,
      onClick: () => this.startBattleTest(),
    });
  }

  /** Updates text labels that describe the current editor state. */
  private updateLabels(): void {
    const problemId = `${this.stageId}-p${this.getProblemNoLabel()}`;
    this.infoText?.setText(`${problemId} / ${this.cols}×${this.rows} / わく${this.groups.length}`);
    this.expressionText?.setText(`${this.expression}   こたえ ${this.answer}`);
  }

  /** Selects the current editor mode and redraws mode buttons. */
  private selectEditMode(mode: GridEditorMode): void {
    this.editMode = mode;
    this.clearGroupDraft();
    this.drawPalette();
    this.drawGrid();
  }

  /** Selects which fixed character index will be placed next. */
  private selectChar(index: number): void {
    this.editMode = 'object';
    this.selectedChar = index;
    this.clearGroupDraft();
    this.drawPalette();
    this.drawGrid();
  }

  /** Routes a cell press to the active editor tool. */
  private handleCellPointerDown(col: number, row: number): void {
    if (this.editMode === 'rectGroup') {
      this.startRectGroupDrag(col, row);
      return;
    }

    if (this.editMode === 'paintGroup') {
      this.startPaintGroupDrag(col, row);
      return;
    }

    if (this.editMode === 'groupErase') {
      this.removeGroupAtCell(col, row);
      return;
    }

    this.setCellObject(col, row);
  }

  /** Places or removes one monster cell object and redraws the grid. */
  private setCellObject(col: number, row: number): void {
    this.objects = this.objects.filter((object) => object.col !== col || object.row !== row);
    if (this.selectedChar >= 0) {
      this.objects.push({ char: this.selectedChar, col, row });
    }
    this.drawGrid();
  }

  /** Starts dragging a new rectangle group from one cell. */
  private startRectGroupDrag(col: number, row: number): void {
    this.paintGroupCells = [];
    this.isPaintingGroup = false;
    this.groupDragStart = { col, row };
    this.groupDragEnd = { col, row };
    this.drawGrid();
  }

  /** Starts painting a free-form group by collecting dragged cells. */
  private startPaintGroupDrag(col: number, row: number): void {
    this.groupDragStart = undefined;
    this.groupDragEnd = undefined;
    this.paintGroupCells = [];
    this.isPaintingGroup = true;
    this.addPaintGroupPath({ col, row });
    this.drawGrid();
  }

  /** Updates the group preview while the pointer moves. */
  private handleGroupPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPaintingGroup) {
      const cell = this.getGridCellAt(pointer.x, pointer.y);
      if (cell && this.addPaintGroupPath(cell)) {
        this.drawGrid();
      }
      return;
    }

    if (!this.groupDragStart) {
      return;
    }

    const cell = this.getGridCellAt(pointer.x, pointer.y);
    if (!cell || (this.groupDragEnd?.col === cell.col && this.groupDragEnd?.row === cell.row)) {
      return;
    }

    this.groupDragEnd = cell;
    this.drawGrid();
  }

  /** Finishes group dragging and asks for an optional label. */
  private handleGroupPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.isPaintingGroup) {
      this.finishPaintGroupDrag();
      return;
    }

    if (!this.groupDragStart) {
      return;
    }

    const start = this.groupDragStart;
    const end = this.getGridCellAt(pointer.x, pointer.y) ?? this.groupDragEnd;
    this.groupDragStart = undefined;
    this.groupDragEnd = undefined;
    if (!end) {
      this.drawGrid();
      return;
    }

    const group = this.buildGroupFromCells(start, end);
    const defaultLabel = `${this.getGroupCells(group).length}こ`;
    this.drawGrid();
    this.openEditorInput({
      label: 'ラベル',
      value: defaultLabel,
      kind: 'text',
      maxLength: 16,
      onSubmit: (value) => {
        this.groups.push(value ? { ...group, label: value } : group);
        this.drawGrid();
        this.updateLabels();
      },
    });
  }

  /** Adds one painted cell if it is not already part of the draft. */
  private addPaintGroupCell(cell: GridCellPosition): boolean {
    if (this.paintGroupCells.some((entry) => this.isSameCell(entry, cell))) {
      return false;
    }

    this.paintGroupCells.push(cell);
    return true;
  }

  /** Adds one painted cell and fills skipped cells on straight drags. */
  private addPaintGroupPath(cell: GridCellPosition): boolean {
    const previous = this.paintGroupCells[this.paintGroupCells.length - 1];
    if (!previous) {
      return this.addPaintGroupCell(cell);
    }

    let changed = false;
    if (previous.col === cell.col) {
      const start = Math.min(previous.row, cell.row);
      const end = Math.max(previous.row, cell.row);
      for (let row = start; row <= end; row += 1) {
        changed = this.addPaintGroupCell({ col: cell.col, row }) || changed;
      }
      return changed;
    }

    if (previous.row === cell.row) {
      const start = Math.min(previous.col, cell.col);
      const end = Math.max(previous.col, cell.col);
      for (let col = start; col <= end; col += 1) {
        changed = this.addPaintGroupCell({ col, row: cell.row }) || changed;
      }
      return changed;
    }

    return this.addPaintGroupCell(cell);
  }

  /** Finishes a painted cell group and asks for its label. */
  private finishPaintGroupDrag(): void {
    this.isPaintingGroup = false;
    const cells = this.sortCells(this.paintGroupCells);
    this.paintGroupCells = [];
    if (cells.length === 0) {
      this.drawGrid();
      return;
    }

    const group: GridExpressionGroupDefinition = { cells };
    this.drawGrid();
    this.openEditorInput({
      label: 'ラベル',
      value: `${cells.length}こ`,
      kind: 'text',
      maxLength: 16,
      onSubmit: (value) => {
        this.groups.push(value ? { ...group, label: value } : group);
        this.drawGrid();
        this.updateLabels();
      },
    });
  }

  /** Builds normalized group bounds from drag endpoints. */
  private buildGroupFromCells(
    start: GridCellPosition,
    end: GridCellPosition,
  ): GridExpressionGroupDefinition {
    const left = Math.min(start.col, end.col);
    const top = Math.min(start.row, end.row);
    const right = Math.max(start.col, end.col);
    const bottom = Math.max(start.row, end.row);
    return {
      col: left,
      row: top,
      cols: right - left + 1,
      rows: bottom - top + 1,
    };
  }

  /** Returns the in-progress group bounds while dragging. */
  private getDraggingGroup(): GridExpressionGroupDefinition | undefined {
    if (!this.groupDragStart || !this.groupDragEnd) {
      return undefined;
    }

    return this.buildGroupFromCells(this.groupDragStart, this.groupDragEnd);
  }

  /** Returns the in-progress painted group while dragging. */
  private getPaintGroupPreview(): GridExpressionGroupDefinition | undefined {
    if (this.paintGroupCells.length === 0) {
      return undefined;
    }

    return { cells: this.sortCells(this.paintGroupCells) };
  }

  /** Clears any group currently being drawn. */
  private clearGroupDraft(): void {
    this.groupDragStart = undefined;
    this.groupDragEnd = undefined;
    this.paintGroupCells = [];
    this.isPaintingGroup = false;
  }

  /** Builds a stable key for comparing grid cells. */
  private getCellKey(cell: GridCellPosition): string {
    return `${cell.col}:${cell.row}`;
  }

  /** Checks whether two cell positions are the same. */
  private isSameCell(left: GridCellPosition, right: GridCellPosition): boolean {
    return left.col === right.col && left.row === right.row;
  }

  /** Sorts cells so exported JSON is stable. */
  private sortCells(cells: GridCellPosition[]): GridCellPosition[] {
    return [...cells]
      .sort((left, right) => left.row - right.row || left.col - right.col)
      .map((cell) => ({ ...cell }));
  }

  /** Checks whether a group has rectangle fields. */
  private isRectGroup(
    group: GridExpressionGroupDefinition,
  ): group is { col: number; row: number; cols: number; rows: number; label?: string } {
    return Number.isInteger(group.col)
      && Number.isInteger(group.row)
      && Number.isInteger(group.cols)
      && Number.isInteger(group.rows);
  }

  /** Expands either rectangle groups or painted groups into individual cells. */
  private getGroupCells(group: GridExpressionGroupDefinition): GridCellPosition[] {
    if (group.cells?.length) {
      return this.sortCells(group.cells);
    }

    if (!this.isRectGroup(group)) {
      return [];
    }

    const cells: GridCellPosition[] = [];
    for (let row = group.row; row < group.row + group.rows; row += 1) {
      for (let col = group.col; col < group.col + group.cols; col += 1) {
        cells.push({ col, row });
      }
    }
    return cells;
  }

  /** Gets the bounds used for labels and sorting. */
  private getGroupBounds(
    group: GridExpressionGroupDefinition,
  ): { minCol: number; minRow: number; maxCol: number; maxRow: number } | undefined {
    const cells = this.getGroupCells(group);
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

  /** Finds the grid cell under a scene coordinate. */
  private getGridCellAt(x: number, y: number): GridCellPosition | undefined {
    const layout = this.getGridLayout();
    if (x < layout.x || x >= layout.x + layout.width || y < layout.y || y >= layout.y + layout.height) {
      return undefined;
    }

    return {
      col: Phaser.Math.Clamp(Math.floor((x - layout.x) / layout.cellSize), 0, this.cols - 1),
      row: Phaser.Math.Clamp(Math.floor((y - layout.y) / layout.cellSize), 0, this.rows - 1),
    };
  }

  /** Removes the newest group box that contains the selected cell. */
  private removeGroupAtCell(col: number, row: number): void {
    for (let index = this.groups.length - 1; index >= 0; index -= 1) {
      const group = this.groups[index];
      if (this.getGroupCells(group).some((cell) => cell.col === col && cell.row === row)) {
        this.groups.splice(index, 1);
        this.drawGrid();
        this.updateLabels();
        return;
      }
    }
  }

  /** Resizes the grid while keeping objects that still fit inside it. */
  private resizeGrid(cols: number, rows: number): void {
    this.cols = Phaser.Math.Clamp(cols, 2, 12);
    this.rows = Phaser.Math.Clamp(rows, 2, 8);
    this.objects = this.objects.filter((object) => object.col < this.cols && object.row < this.rows);
    this.groups = this.groups.filter((group) => this.getGroupCells(group)
      .every((cell) => cell.col < this.cols && cell.row < this.rows));
    this.clearGroupDraft();
    this.drawGrid();
    this.updateLabels();
  }

  /** Resets placed objects and group boxes to an empty grid. */
  private resetObjects(): void {
    this.objects = [];
    this.groups = [];
    this.clearGroupDraft();
    this.drawGrid();
    this.updateLabels();
  }

  /** Starts a debug battle that uses the bundled sample grid problem. */
  private startBattleTest(): void {
    this.scene.start(SceneKeys.BattleGame, {
      trainerId: 'trainer-grid-editor',
      partyMonsterIds: ['picoleaf'],
    });
  }

  /** Opens a native input field styled as part of the editor. */
  private openEditorInput(request: GridEditorInputRequest): void {
    this.closeEditorInput();
    this.inputRequest = request;

    const layer = this.add.container(0, 0).setDepth(80);
    this.inputLayer = layer;

    const shade = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x243044, 0.32)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor('#fff8e8').color, 1);
    panel.fillRoundedRect(38, 292, 314, 214, 18);
    panel.lineStyle(3, Phaser.Display.Color.HexStringToColor('#d9a34d').color, 0.92);
    panel.strokeRoundedRect(38, 292, 314, 214, 18);

    const labelText = this.add
      .text(GAME_WIDTH / 2, 330, request.label, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    layer.add([shade, panel, labelText]);
    layer.add(createButton(this, {
      x: 124,
      y: 466,
      width: 104,
      height: 42,
      label: 'OK',
      fillColor: COLORS.yellow,
      strokeColor: '#b52a24',
      fontSize: 17,
      onClick: () => this.submitEditorInput(),
    }));
    layer.add(createButton(this, {
      x: 266,
      y: 466,
      width: 104,
      height: 42,
      label: 'とじる',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 15,
      onClick: () => this.closeEditorInput(),
    }));

    const input = document.createElement('input');
    input.type = request.kind;
    input.value = request.value;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', request.label);
    if (request.kind === 'number') {
      input.inputMode = 'numeric';
      input.step = '1';
      if (request.min !== undefined) {
        input.min = String(request.min);
      }
    }
    if (request.maxLength !== undefined) {
      input.maxLength = request.maxLength;
    }

    input.style.position = 'fixed';
    input.style.zIndex = '10000';
    input.style.boxSizing = 'border-box';
    input.style.border = '3px solid #b52a24';
    input.style.borderRadius = '12px';
    input.style.background = '#fffaf0';
    input.style.color = COLORS.ink;
    input.style.fontFamily = FONT_FAMILY;
    input.style.fontWeight = '900';
    input.style.textAlign = 'center';
    input.style.outline = 'none';
    input.style.padding = '0 12px';

    input.addEventListener('keydown', (event) => {
      if (event.isComposing) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submitEditorInput();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeEditorInput();
      }
    });

    document.body.appendChild(input);
    this.editorInput = input;
    this.positionEditorInput();
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  /** Places the native input on top of the Phaser canvas. */
  private positionEditorInput(): void {
    if (!this.editorInput) {
      return;
    }

    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    this.editorInput.style.left = `${rect.left + 64 * scaleX}px`;
    this.editorInput.style.top = `${rect.top + 368 * scaleY}px`;
    this.editorInput.style.width = `${262 * scaleX}px`;
    this.editorInput.style.height = `${52 * scaleY}px`;
    this.editorInput.style.fontSize = `${Math.max(16, 21 * scale)}px`;
  }

  /** Submits the active editor input if its value is valid. */
  private submitEditorInput(): void {
    if (!this.editorInput || !this.inputRequest) {
      return;
    }

    const request = this.inputRequest;
    const value = this.editorInput.value.trim();
    if (request.validate && !request.validate(value)) {
      this.editorInput.style.borderColor = '#d7263d';
      this.editorInput.focus();
      this.editorInput.select();
      return;
    }

    this.closeEditorInput();
    request.onSubmit(value);
  }

  /** Closes the active editor input and removes its DOM node. */
  private closeEditorInput(): void {
    this.inputLayer?.destroy(true);
    this.inputLayer = undefined;
    this.editorInput?.remove();
    this.editorInput = undefined;
    this.inputRequest = undefined;
  }

  /** Opens editor input for the stage id used by the downloaded JSON. */
  private promptStageId(): void {
    this.openEditorInput({
      label: 'stageId',
      value: this.stageId,
      kind: 'text',
      maxLength: 48,
      validate: (value) => value.length > 0,
      onSubmit: (value) => {
        this.stageId = value;
        this.updateLabels();
      },
    });
  }

  /** Opens editor input for the problem number used by the downloaded JSON. */
  private promptProblemNo(): void {
    this.openEditorInput({
      label: 'problemNo',
      value: String(this.problemNo),
      kind: 'number',
      min: 1,
      maxLength: 4,
      validate: (value) => {
        const nextValue = Number(value);
        return Number.isInteger(nextValue) && nextValue >= 1;
      },
      onSubmit: (value) => {
        this.problemNo = Number(value);
        this.updateLabels();
      },
    });
  }

  /** Opens editor input for the visible expression text. */
  private promptExpression(): void {
    this.openEditorInput({
      label: 'しき',
      value: this.expression,
      kind: 'text',
      maxLength: 40,
      validate: (value) => value.length > 0,
      onSubmit: (value) => {
        this.expression = value;
        this.updateLabels();
      },
    });
  }

  /** Opens editor input for the single blank answer. */
  private promptAnswer(): void {
    this.openEditorInput({
      label: 'こたえ',
      value: String(this.answer),
      kind: 'number',
      min: 0,
      maxLength: 3,
      validate: (value) => {
        const nextValue = Number(value);
        return Number.isInteger(nextValue) && nextValue >= 0;
      },
      onSubmit: (value) => {
        this.answer = Number(value);
        this.updateLabels();
      },
    });
  }

  /** Builds the JSON problem from the current editor state. */
  private buildProblemDefinition(): { problem: GridExpressionProblemDefinition } {
    const problemNoLabel = this.getProblemNoLabel();
    const groups = this.groups
      .map((group) => this.normalizeGroupForJson(group))
      .sort((left, right) => {
        const leftBounds = this.getGroupBounds(left);
        const rightBounds = this.getGroupBounds(right);
        return (leftBounds?.minRow ?? 0) - (rightBounds?.minRow ?? 0)
          || (leftBounds?.minCol ?? 0) - (rightBounds?.minCol ?? 0);
      });
    return {
      problem: {
        id: `${this.stageId}-p${problemNoLabel}`,
        stageId: this.stageId,
        problemNo: this.problemNo,
        kind: 'gridExpression',
        title: '絵を見て しきをつくろう',
        grid: {
          cols: this.cols,
          rows: this.rows,
        },
        chars: [...this.chars],
        objects: [...this.objects].sort((left, right) => left.row - right.row || left.col - right.col),
        ...(groups.length > 0 ? { groups } : {}),
        expression: this.expression,
        answer: this.answer,
      },
    };
  }

  /** Copies one group into the compact JSON shape used by exported problems. */
  private normalizeGroupForJson(group: GridExpressionGroupDefinition): GridExpressionGroupDefinition {
    if (group.cells?.length) {
      return {
        cells: this.sortCells(group.cells),
        ...(group.label ? { label: group.label } : {}),
      };
    }

    return { ...group };
  }

  /** Downloads the current problem JSON through the browser. */
  private downloadCurrentProblem(): void {
    const json = JSON.stringify(this.buildProblemDefinition(), null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `p${this.getProblemNoLabel()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Returns the current problem number padded for file names and ids. */
  private getProblemNoLabel(): string {
    return String(this.problemNo).padStart(3, '0');
  }

  /** Calculates the visible editor grid rectangle. */
  private getGridLayout(): { x: number; y: number; cellSize: number; width: number; height: number } {
    const cellSize = Math.floor(Math.min(EDITOR_GRID_WIDTH / this.cols, EDITOR_GRID_HEIGHT / this.rows));
    const width = cellSize * this.cols;
    const height = cellSize * this.rows;
    return {
      x: Math.round(EDITOR_GRID_X + (EDITOR_GRID_WIDTH - width) / 2),
      y: Math.round(EDITOR_GRID_Y + (EDITOR_GRID_HEIGHT - height) / 2),
      cellSize,
      width,
      height,
    };
  }
}
