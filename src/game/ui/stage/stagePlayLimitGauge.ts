import * as Phaser from 'phaser';
import {
  STAGE_PLAY_LIMIT,
  STAGE_PLAY_WINDOW_MS,
  StagePlayLimitStatus,
} from '../../../state/save';
import { COLORS, FONT_FAMILY } from '../../constants';

interface StagePlayLimitGaugeOptions {
  squareSize?: number;
  gap?: number;
  fontSize?: number;
  fillColor?: string;
  xOffset?: number;
}

/** 残り時間のミリ秒を、分:秒の短い表示に変換します。 */
export function formatStagePlayLimitTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** ステージ入場回数の残りと回復時間を、小さなゲージとして描画します。 */
export function drawStagePlayLimitGauge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  getStatus: () => StagePlayLimitStatus,
  options: StagePlayLimitGaugeOptions = {},
): Phaser.GameObjects.Container {
  const squareSize = options.squareSize ?? 10;
  const gap = options.gap ?? 3;
  const fontSize = options.fontSize ?? 14;
  const fillColor = options.fillColor ?? COLORS.yellow;
  const xOffset = options.xOffset ?? -36;
  const container = scene.add.container(x, y);
  const timeText = scene.add
    .text(xOffset - 52, 0, formatStagePlayLimitTime(STAGE_PLAY_WINDOW_MS), {
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: '900',
      color: COLORS.ink,
      align: 'right',
    })
    .setOrigin(0, 0.5);
  const squares = Array.from({ length: STAGE_PLAY_LIMIT }, (_, index) => scene.add
    .rectangle(
      xOffset + index * (squareSize + gap),
      0,
      squareSize,
      squareSize,
      Phaser.Display.Color.HexStringToColor(fillColor).color,
      1,
    )
    .setStrokeStyle(1.5, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.85));

  container.add([timeText, ...squares]);

  let isDestroyed = false;

  /** 現在の制限状態を読み直し、時間表示と残りマスを更新します。 */
  const updateGauge = (): void => {
    if (isDestroyed || !timeText.active) {
      return;
    }

    const status = getStatus();
    timeText.setText(formatStagePlayLimitTime(status.remainingMs));
    squares.forEach((square, index) => {
      const isRemaining = index < status.remainingPlays;
      const color = status.isLimited ? COLORS.muted : fillColor;
      square.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, isRemaining ? 1 : 0.12);
      square.setStrokeStyle(1.5, Phaser.Display.Color.HexStringToColor(COLORS.line).color, isRemaining ? 0.9 : 0.35);
    });
  };

  updateGauge();
  const timer = scene.time.addEvent({ delay: 1000, loop: true, callback: updateGauge });
  container.once('destroy', () => {
    isDestroyed = true;
    timer.remove(false);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove(false));
  return container;
}

/** 制限が切れるタイミングを待ち、解除されたら画面更新用コールバックを呼びます。 */
export function scheduleStagePlayLimitRefresh(
  scene: Phaser.Scene,
  getStatus: () => StagePlayLimitStatus,
  onUnlocked: () => void,
): void {
  /** 残り時間に合わせて次の確認タイマーを張り直します。 */
  const scheduleNextCheck = (): void => {
    const status = getStatus();
    if (!status.isLimited) {
      onUnlocked();
      return;
    }

    const delay = Math.min(Math.max(status.remainingMs + 100, 1000), 5000);
    const timer = scene.time.delayedCall(delay, scheduleNextCheck);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove(false));
  };

  scheduleNextCheck();
}
