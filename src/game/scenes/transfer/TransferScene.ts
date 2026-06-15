import * as Phaser from 'phaser';
import {
  createTransferCode,
  getTransferSummary,
  importTransferCode,
  loadSaveState,
} from '../../../state/save';
import type { TransferImportResult } from '../../../state/save';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { createQrMatrix, QrMatrix } from '../../qrCode';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';

interface TransferSceneData {
  message?: string;
  tone?: 'ok' | 'error';
}

export class TransferScene extends Phaser.Scene {
  private message = '';
  private tone: 'ok' | 'error' = 'ok';
  private inputOverlay: HTMLDivElement | null = null;

  constructor() {
    super(SceneKeys.Transfer);
  }

  init(data?: TransferSceneData): void {
    this.message = data?.message ?? '';
    this.tone = data?.tone ?? 'ok';
  }

  create(): void {
    startBgm('home');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeInputOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.removeInputOverlay());
    const saveState = loadSaveState();
    const transferCode = createTransferCode(saveState);
    const summary = getTransferSummary(saveState);

    this.cameras.main.setBackgroundColor('#eef8ff');
    this.drawBackground();
    createSmallButton(this, 42, 52, '<', () => this.scene.start(SceneKeys.MainMenu));

    this.add
      .text(GAME_WIDTH / 2, 54, 'ひきつぎ', {
        fontFamily: FONT_FAMILY,
        fontSize: '31px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 94, 'QRをよむか コードをいれてね', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    this.drawSummary(summary.captureKinds, summary.titleBackgrounds, summary.stages);
    this.drawQrPanel(transferCode);
    this.drawActions(transferCode);
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#eef8ff').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff4bd').color, 0.72);
    graphics.fillRoundedRect(230, 104, 178, 74, 24);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#dff9e8').color, 0.86);
    graphics.fillRoundedRect(-32, 642, 214, 92, 28);
    graphics.lineStyle(1, Phaser.Display.Color.HexStringToColor('#cfeafa').color, 0.62);
    for (let y = 132; y < GAME_HEIGHT; y += 32) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  private drawSummary(captureKinds: number, titleBackgrounds: number, stages: number): void {
    const labels = [
      ['キャラ', captureKinds, COLORS.grass],
      ['はいけい', titleBackgrounds, COLORS.water],
      ['ステージ', stages, COLORS.yellow],
    ] as const;

    labels.forEach(([label, count, color], index) => {
      const x = 72 + index * 123;
      const graphics = this.add.graphics();
      graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.96);
      graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(color).color, 1);
      graphics.fillRoundedRect(x - 50, 122, 100, 64, 16);
      graphics.strokeRoundedRect(x - 50, 122, 100, 64, 16);
      this.add
        .text(x, 142, label, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: '900',
          color: COLORS.muted,
        })
        .setOrigin(0.5);
      this.add
        .text(x, 168, `${count}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5);
    });
  }

  private drawQrPanel(transferCode: string): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.98);
    graphics.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 0.9);
    graphics.fillRoundedRect(28, 212, 334, 360, 22);
    graphics.strokeRoundedRect(28, 212, 334, 360, 22);

    let qrMatrix: QrMatrix | null = null;
    try {
      qrMatrix = createQrMatrix(transferCode);
    } catch {
      qrMatrix = null;
    }

    if (qrMatrix) {
      this.drawQrMatrix(qrMatrix, GAME_WIDTH / 2, 386, 292);
    } else {
      this.add
        .text(GAME_WIDTH / 2, 374, 'QRが ながいよ', {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          fontStyle: '900',
          color: COLORS.red,
          align: 'center',
        })
        .setOrigin(0.5);
    }

    this.add
      .text(GAME_WIDTH / 2, 544, `コード ${transferCode.length}もじ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    if (!this.message) {
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 596, this.message, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: this.tone === 'ok' ? COLORS.grassDark : COLORS.red,
        align: 'center',
        wordWrap: { width: 324, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private drawQrMatrix(qrMatrix: QrMatrix, centerX: number, centerY: number, size: number): void {
    const quietZone = 4;
    const moduleCount = qrMatrix.size + quietZone * 2;
    const moduleSize = size / moduleCount;
    const drawSize = moduleSize * moduleCount;
    const left = centerX - drawSize / 2;
    const top = centerY - drawSize / 2;
    const graphics = this.add.graphics();

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 1);
    graphics.fillRect(left, top, drawSize, drawSize);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#111827').color, 1);
    qrMatrix.modules.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (!dark) {
          return;
        }

        graphics.fillRect(
          left + (x + quietZone) * moduleSize,
          top + (y + quietZone) * moduleSize,
          moduleSize + 0.12,
          moduleSize + 0.12,
        );
      });
    });
  }

  private drawActions(transferCode: string): void {
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 662,
      width: 302,
      height: 72,
      label: 'コードをコピー',
      fillColor: COLORS.yellow,
      fontSize: 23,
      onClick: () => {
        void this.copyTransferCode(transferCode);
      },
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 750,
      width: 302,
      height: 72,
      label: 'コードをいれる',
      fillColor: COLORS.water,
      strokeColor: '#276b9e',
      fontSize: 23,
      onClick: () => this.askImportCode(),
    });
  }

  private async copyTransferCode(transferCode: string): Promise<void> {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(transferCode);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      window.prompt('コードをコピーしてね', transferCode);
    }

    this.scene.restart({
      message: copied ? 'コピーしたよ' : 'コードをコピーしてね',
      tone: 'ok',
    });
  }

  private askImportCode(): void {
    if (typeof document === 'undefined') {
      const code = window.prompt('コードをいれてね');
      if (!code) {
        return;
      }
      this.importCodeText(code);
      return;
    }

    this.showImportOverlay();
  }

  private importCodeText(code: string): void {
    const result = importTransferCode(code);
    this.removeInputOverlay();
    this.scene.restart({
      message: this.getImportMessage(result),
      tone: result.status === 'ok' ? 'ok' : 'error',
    });
  }

  private showImportOverlay(): void {
    this.removeInputOverlay();

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'ひきつぎコード');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'grid';
    overlay.style.placeItems = 'center';
    overlay.style.padding = '18px';
    overlay.style.background = 'rgba(38, 49, 67, 0.42)';

    const panel = document.createElement('div');
    panel.style.width = 'min(360px, 100%)';
    panel.style.border = '4px solid #243044';
    panel.style.borderRadius = '18px';
    panel.style.background = '#ffffff';
    panel.style.boxShadow = '0 18px 42px rgba(38, 49, 67, 0.22)';
    panel.style.padding = '18px';
    panel.style.fontFamily = FONT_FAMILY;
    panel.addEventListener('click', (event) => event.stopPropagation());

    const title = document.createElement('div');
    title.textContent = 'コードをはる';
    title.style.fontSize = '22px';
    title.style.fontWeight = '900';
    title.style.color = COLORS.ink;
    title.style.textAlign = 'center';

    const help = document.createElement('div');
    help.textContent = 'QRででたコードを はってね';
    help.style.marginTop = '8px';
    help.style.fontSize = '14px';
    help.style.fontWeight = '800';
    help.style.color = COLORS.muted;
    help.style.textAlign = 'center';

    const input = document.createElement('textarea');
    input.setAttribute('aria-label', 'コード');
    input.placeholder = 'ここにコードをはってね';
    input.autocapitalize = 'off';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.rows = 6;
    input.style.width = '100%';
    input.style.marginTop = '14px';
    input.style.padding = '12px';
    input.style.border = '3px solid #70c7ff';
    input.style.borderRadius = '12px';
    input.style.fontSize = '16px';
    input.style.fontWeight = '700';
    input.style.color = COLORS.ink;
    input.style.resize = 'vertical';
    input.style.minHeight = '130px';
    input.style.outline = 'none';

    const message = document.createElement('div');
    message.textContent = '';
    message.style.minHeight = '22px';
    message.style.marginTop = '8px';
    message.style.fontSize = '14px';
    message.style.fontWeight = '900';
    message.style.color = COLORS.red;
    message.style.textAlign = 'center';

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'grid';
    buttonRow.style.gridTemplateColumns = '1fr 1fr';
    buttonRow.style.gap = '10px';
    buttonRow.style.marginTop = '10px';

    const closeButton = this.createOverlayButton('とじる', COLORS.panel, COLORS.ink);
    const importButton = this.createOverlayButton('よみこむ', COLORS.yellow, '#7d2a22');

    closeButton.addEventListener('click', () => this.removeInputOverlay());
    importButton.addEventListener('click', () => {
      if (!input.value.trim()) {
        message.textContent = 'コードをいれてね';
        input.focus();
        return;
      }

      this.importCodeText(input.value);
    });
    overlay.addEventListener('click', () => this.removeInputOverlay());

    buttonRow.append(closeButton, importButton);
    panel.append(title, help, input, message, buttonRow);
    overlay.append(panel);
    document.body.append(overlay);
    this.inputOverlay = overlay;
    window.setTimeout(() => input.focus(), 0);
  }

  private createOverlayButton(label: string, background: string, color: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.height = '52px';
    button.style.border = '3px solid #243044';
    button.style.borderRadius = '14px';
    button.style.background = background;
    button.style.color = color;
    button.style.fontFamily = FONT_FAMILY;
    button.style.fontSize = '18px';
    button.style.fontWeight = '900';
    button.style.cursor = 'pointer';
    return button;
  }

  private removeInputOverlay(): void {
    this.inputOverlay?.remove();
    this.inputOverlay = null;
  }

  private getImportMessage(result: TransferImportResult): string {
    switch (result.status) {
      case 'ok':
        return 'ひきつぎできたよ';
      case 'saveFailed':
        return 'ほぞんできないよ';
      case 'badChecksum':
      case 'badCode':
      case 'badData':
        return 'コードをみてね';
      default:
        return 'コードをみてね';
    }
  }
}
