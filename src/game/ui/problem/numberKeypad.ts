import * as Phaser from 'phaser';
import { COLORS } from '../../constants';
import { createButton } from '../common/button';

export type NumberKeypadLabel =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'けす'
  | '小数点'
  | 'きめる';

interface NumberKeypadOptions {
  startX: number;
  startY: number;
  colGap: number;
  rowGap: number;
  keyWidth: number;
  keyHeight: number;
  digitFontSize: number;
  actionFontSize: number;
  allowDecimalPoint?: boolean;
  onKey: (label: NumberKeypadLabel) => void;
}

type NumberKeyInputResult =
  | { type: 'input'; value: string }
  | { type: 'submit' }
  | { type: 'none' };

const NUMBER_KEYPAD_ROWS: NumberKeypadLabel[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['けす', '0', 'きめる'],
];

/** 捕獲と対戦で共通利用する、0-9・けす・きめるの数字キーパッドを描画します。 */
export function drawNumberKeypad(scene: Phaser.Scene, options: NumberKeypadOptions): void {
  NUMBER_KEYPAD_ROWS.slice(0, 3).forEach((row, rowIndex) => {
    row.forEach((label, colIndex) => {
      createButton(scene, {
        x: options.startX + colIndex * options.colGap,
        y: options.startY + rowIndex * options.rowGap,
        width: options.keyWidth,
        height: options.keyHeight,
        label,
        fontSize: label.length > 1 ? options.actionFontSize : options.digitFontSize,
        fillColor: label === 'きめる' ? COLORS.yellow : COLORS.panel,
        onClick: () => options.onKey(label),
      });
    });
  });

  if (!options.allowDecimalPoint) {
    NUMBER_KEYPAD_ROWS[3].forEach((label, colIndex) => {
      createButton(scene, {
        x: options.startX + colIndex * options.colGap,
        y: options.startY + 3 * options.rowGap,
        width: options.keyWidth,
        height: options.keyHeight,
        label,
        fontSize: label.length > 1 ? options.actionFontSize : options.digitFontSize,
        fillColor: label === 'きめる' ? COLORS.yellow : COLORS.panel,
        onClick: () => options.onKey(label),
      });
    });
    return;
  }

  const bottomY = options.startY + 3 * options.rowGap;
  const centerX = options.startX + options.colGap;
  const bottomButtons: Array<{ label: NumberKeypadLabel; x: number; width: number }> = [
    { label: 'けす', x: centerX - 132, width: 76 },
    { label: '0', x: centerX - 44, width: 76 },
    { label: '小数点', x: centerX + 44, width: 76 },
    { label: 'きめる', x: centerX + 132, width: 76 },
  ];
  bottomButtons.forEach((button) => {
    createButton(scene, {
      x: button.x,
      y: bottomY,
      width: button.width,
      height: options.keyHeight,
      label: button.label,
      fontSize: button.label.length > 1 ? options.actionFontSize : options.digitFontSize,
      fillColor: button.label === 'きめる' ? COLORS.yellow : COLORS.panel,
      onClick: () => options.onKey(button.label),
    });
  });
}

/** 数字キーパッド入力を、消去・小数点・決定・最大桁数のルールに沿って処理します。 */
export function resolveNumberKeyInput(
  label: NumberKeypadLabel,
  currentInput: string,
  maxDigits = 2,
  options: { allowDecimalPoint?: boolean; decimalPlaces?: number } = {},
): NumberKeyInputResult {
  if (label === 'けす') {
    return { type: 'input', value: currentInput.slice(0, -1) };
  }

  if (label === '小数点') {
    if (!options.allowDecimalPoint || (options.decimalPlaces ?? 0) <= 0 || currentInput.includes('.')) {
      return { type: 'none' };
    }

    const nextValue = currentInput.length === 0 ? '0.' : `${currentInput}.`;
    return nextValue.length <= maxDigits ? { type: 'input', value: nextValue } : { type: 'none' };
  }

  if (label === 'きめる') {
    return { type: 'submit' };
  }

  const decimalIndex = currentInput.indexOf('.');
  if (decimalIndex >= 0) {
    const decimalLength = currentInput.length - decimalIndex - 1;
    if (decimalLength >= (options.decimalPlaces ?? 0)) {
      return { type: 'none' };
    }
  }

  if (currentInput === '0') {
    return { type: 'input', value: label };
  }

  if (currentInput.length < maxDigits) {
    return { type: 'input', value: currentInput + label };
  }

  return { type: 'none' };
}
