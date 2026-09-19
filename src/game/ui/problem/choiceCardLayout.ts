import * as Phaser from 'phaser';
import { FONT_FAMILY } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import type { ProblemAnswerMode } from '../../types';

export interface ChoiceCardLayout {
  width: number;
  height: number;
  fontSize: number;
  positions: Array<{ x: number; y: number }>;
}

/** Measures every choice at a shared font size before selecting rows and columns. */
export function getChoiceCardLayout(
  scene: Phaser.Scene,
  labels: readonly string[],
  mode: ProblemAnswerMode | undefined,
): ChoiceCardLayout {
  const region = APP_LAYOUT.captureGame.regions.choices;
  const preferredColumns = mode === 'choiceRow' ? 4 : mode === 'choiceColumn' ? 1 : 2;
  const candidates = [4, 2, 1].filter((columns) => columns <= preferredColumns);
  const measure = scene.add.text(0, 0, '', {
    fontFamily: FONT_FAMILY, fontStyle: '900', align: 'center', lineSpacing: 2,
  }).setVisible(false);

  try {
    for (const columns of candidates) {
      const rows = Math.max(1, Math.ceil(labels.length / columns));
      const gap = 12;
      const width = (region.width - gap * (columns - 1)) / columns;
      const height = Math.min(columns === 1 ? 56 : 80, (region.height - gap * (rows - 1)) / rows);
      for (const fontSize of [28, 26, 24, 22]) {
        measure.setFontSize(fontSize).setWordWrapWidth(null);
        // Prefer fewer columns over wrapping a short answer across narrow cards.
        if (columns > 1 && labels.some((label) => measure.setText(label).width > width - 24)) {
          continue;
        }
        measure.setWordWrapWidth(width - 24, true);
        if (!labels.every((label) => {
          measure.setText(label);
          return measure.width <= width - 24 && measure.height <= height - 10;
        })) {
          continue;
        }
        const top = region.y + (region.height - (rows * height + (rows - 1) * gap)) / 2;
        return {
          width, height, fontSize,
          positions: labels.map((_, index) => ({
            x: region.x + width / 2 + (index % columns) * (width + gap),
            y: top + height / 2 + Math.floor(index / columns) * (height + gap),
          })),
        };
      }
    }
  } finally {
    measure.destroy();
  }
  // Invalid content must be caught in the authoring preview, never silently omitted.
  throw new Error('Choice labels exceed the supported capture layout (minimum font size: 22).');
}
