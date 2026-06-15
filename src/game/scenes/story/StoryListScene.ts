import * as Phaser from 'phaser';
import {
  cloneStoryCreatorPlacement,
  createNextStoryCreatorDraft,
  deleteStoryCreatorDraft,
  exportStoryCreatorDraftToJsonText,
  importStoryCreatorDraftFromJsonText,
  loadStoryCreatorDrafts,
  saveStoryCreatorDraft,
  StoryCreatorDraft,
} from '../../../state/storyCreator';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';

const LIST_TOP = 132;
const DRAFTS_PER_LIST_PAGE = 6;

/** CSSカラー文字列を、Phaserの描画用数値へ変えます。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class StoryListScene extends Phaser.Scene {
  private drafts: StoryCreatorDraft[] = [];
  private listPage = 0;
  private deleteTarget?: StoryCreatorDraft;
  private jsonFileInput?: HTMLInputElement;
  private noticeText = '';

  /** Phaserに保存済みストーリー一覧画面を登録します。 */
  constructor() {
    super(SceneKeys.StoryList);
  }

  /** 保存済みのお話を読み、一覧画面を描きます。 */
  create(): void {
    startBgm('home');
    this.drafts = loadStoryCreatorDrafts();
    this.cameras.main.setBackgroundColor('#eef8f3');
    this.drawBackground();
    this.drawHeader();
    this.drawDraftList();
    if (this.deleteTarget) {
      this.drawDeleteModal(this.deleteTarget);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyJsonFileInput());
  }

  /** 一覧画面の背景を描きます。 */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#eef8f3'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.94);
    graphics.fillRect(0, 0, GAME_WIDTH, 104);

    graphics.lineStyle(2, colorToNumber('#d6eadf'), 0.62);
    for (let y = 132; y < GAME_HEIGHT; y += 46) {
      graphics.lineBetween(22, y, GAME_WIDTH - 22, y);
    }
  }

  /** 上部の戻るボタンと新規作成ボタンを描きます。 */
  private drawHeader(): void {
    createSmallButton(this, 42, 44, '←', () => this.scene.start(SceneKeys.MainMenu));

    this.add
      .text(GAME_WIDTH / 2, 36, 'ストーリー', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 68, 'お話を えらぶよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 206,
      y: 74,
      width: 74,
      height: 42,
      label: 'JSON',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 15,
      onClick: () => this.openJsonFilePicker(),
    });

    createButton(this, {
      x: 326,
      y: 74,
      width: 96,
      height: 42,
      label: '新しく作る',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 15,
      onClick: () => this.openNewDraft(),
    });

    if (this.noticeText) {
      this.add
        .text(GAME_WIDTH / 2, 108, this.noticeText, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: '900',
          color: '#2f9f61',
        })
        .setOrigin(0.5);
    }
  }

  /** 保存済みのお話カードを縦に並べます。 */
  private drawDraftList(): void {
    if (!this.drafts.length) {
      this.add
        .text(GAME_WIDTH / 2, 250, 'まだないよ', {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          fontStyle: '900',
          color: COLORS.muted,
        })
        .setOrigin(0.5);
      return;
    }

    this.clampListPage();
    const startIndex = this.listPage * DRAFTS_PER_LIST_PAGE;
    this.drafts.slice(startIndex, startIndex + DRAFTS_PER_LIST_PAGE).forEach((draft, index) => {
      this.drawDraftCard(draft, LIST_TOP + index * 104);
    });
    this.drawDraftPageControls();
  }

  /** 保存済みストーリー一覧のページ送りボタンを描きます。 */
  private drawDraftPageControls(): void {
    const pageCount = this.getDraftPageCount();
    if (pageCount <= 1) {
      return;
    }

    createButton(this, {
      x: 108,
      y: 770,
      width: 86,
      height: 38,
      label: 'まえ',
      fillColor: this.listPage > 0 ? COLORS.panel : '#eef3f7',
      strokeColor: this.listPage > 0 ? '#47647d' : '#9cb5c7',
      fontSize: 16,
      disabled: this.listPage <= 0,
      onClick: () => this.changeDraftListPage(-1),
    });

    this.add
      .text(GAME_WIDTH / 2, 770, `${this.listPage + 1}/${pageCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 292,
      y: 770,
      width: 86,
      height: 38,
      label: 'つぎ',
      fillColor: this.listPage < pageCount - 1 ? COLORS.panel : '#eef3f7',
      strokeColor: this.listPage < pageCount - 1 ? '#47647d' : '#9cb5c7',
      fontSize: 16,
      disabled: this.listPage >= pageCount - 1,
      onClick: () => this.changeDraftListPage(1),
    });
  }

  /** ひとつの保存済みお話カードを描きます。 */
  private drawDraftCard(draft: StoryCreatorDraft, y: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.96);
    graphics.lineStyle(3, colorToNumber('#9cb5c7'), 1);
    graphics.fillRoundedRect(24, y, GAME_WIDTH - 48, 88, 18);
    graphics.strokeRoundedRect(24, y, GAME_WIDTH - 48, 88, 18);

    this.add
      .text(44, y + 20, draft.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '900',
        color: COLORS.ink,
        wordWrap: { width: 160, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.add
      .text(44, y + 50, this.getDraftSnippet(draft), {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '800',
        color: COLORS.muted,
        wordWrap: { width: 168, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.add
      .text(44, y + 72, `${draft.pages.length}ページ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 206,
      y: y + 30,
      width: 44,
      height: 38,
      label: 'みる',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 15,
      onClick: () => this.openPreview(draft),
    });

    createButton(this, {
      x: 256,
      y: y + 30,
      width: 50,
      height: 38,
      label: 'なおす',
      fillColor: '#c8f0da',
      strokeColor: '#2f9f61',
      fontSize: 14,
      onClick: () => this.openEditor(draft),
    });

    createButton(this, {
      x: 306,
      y: y + 30,
      width: 48,
      height: 38,
      label: 'だす',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 14,
      onClick: () => this.exportDraft(draft),
    });

    createButton(this, {
      x: 356,
      y: y + 30,
      width: 44,
      height: 38,
      label: 'けす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 14,
      onClick: () => this.openDeleteModal(draft),
    });
  }

  /** 新しい下書きを作って編集画面へ進みます。 */
  private openNewDraft(): void {
    this.scene.start(SceneKeys.StoryCreator, {
      draft: createNextStoryCreatorDraft(),
      pageIndex: 0,
    });
  }

  /** 選んだお話を確認画面で再生します。 */
  /** JSONファイルを選ぶ入力欄を開きます。 */
  private openJsonFilePicker(): void {
    const input = this.getJsonFileInput();
    input.value = '';
    input.click();
  }

  /** JSONファイル選択用のHTML入力欄を用意します。 */
  private getJsonFileInput(): HTMLInputElement {
    if (this.jsonFileInput) {
      return this.jsonFileInput;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      void this.readSelectedJsonFile(input.files?.[0]);
    });

    document.body.appendChild(input);
    this.jsonFileInput = input;
    return input;
  }

  /** 選ばれたJSONファイルを読み、下書きとして保存します。 */
  private async readSelectedJsonFile(file?: File): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const draft = importStoryCreatorDraftFromJsonText(await file.text(), this.getJsonFallbackName(file.name));
      if (!draft) {
        this.showImportNotice('よめないJSON');
        return;
      }

      saveStoryCreatorDraft(draft);
      this.drafts = loadStoryCreatorDrafts();
      this.listPage = 0;
      this.deleteTarget = undefined;
      this.showImportNotice('JSONをよんだ');
    } catch {
      this.showImportNotice('よめないJSON');
    }
  }

  /** JSONファイル名から仮の下書き名を作ります。 */
  private getJsonFallbackName(fileName: string): string {
    const name = fileName.replace(/\.[^/.]+$/, '').trim();
    return name ? name.slice(0, 10) : '';
  }

  /** JSON読み込みの結果を一覧画面へ表示します。 */
  /** JSON読み込みと書き出しの結果を一覧画面へ表示します。 */
  private showImportNotice(noticeText: string): void {
    this.noticeText = noticeText;
    this.redraw();
  }

  /** 選んだお話を確認画面で再生します。 */
  /** 選んだストーリー下書きをJSONファイルとして保存します。 */
  private exportDraft(draft: StoryCreatorDraft): void {
    try {
      const draftToExport = draft.id ? this.cloneDraft(draft) : saveStoryCreatorDraft(this.cloneDraft(draft));
      const jsonText = exportStoryCreatorDraftToJsonText(draftToExport);
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.getJsonExportFileName(draftToExport)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      this.drafts = loadStoryCreatorDrafts();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      this.showImportNotice('JSONをだした');
    } catch {
      this.showImportNotice('JSONをだせない');
    }
  }

  /** JSON書き出し用のファイル名を作ります。 */
  private getJsonExportFileName(draft: StoryCreatorDraft): string {
    const baseName = (draft.id ?? draft.name).trim() || 'story';
    const safeName = baseName.replace(/[\\/:*?"<>|]+/g, '-').trim();
    return safeName ? safeName.slice(0, 60) : 'story';
  }

  /** 選んだお話を確認画面で再生します。 */
  private openPreview(draft: StoryCreatorDraft): void {
    this.scene.start(SceneKeys.StoryPreview, {
      draft: this.cloneDraft(draft),
      returnScene: 'list',
    });
  }

  /** 選んだお話を編集画面で開きます。 */
  private openEditor(draft: StoryCreatorDraft): void {
    this.scene.start(SceneKeys.StoryCreator, {
      draft: this.cloneDraft(draft),
      pageIndex: 0,
      savedName: draft.name,
    });
  }

  /** 削除の確認モーダルを開きます。 */
  private openDeleteModal(draft: StoryCreatorDraft): void {
    this.deleteTarget = draft;
    this.redraw();
  }

  /** 削除の確認モーダルを閉じます。 */
  private closeDeleteModal(): void {
    this.deleteTarget = undefined;
    this.redraw();
  }

  /** 選んだお話を削除して一覧を更新します。 */
  private deleteDraft(draft: StoryCreatorDraft): void {
    this.drafts = deleteStoryCreatorDraft(draft.name);
    this.deleteTarget = undefined;
    this.clampListPage();
    this.redraw();
  }

  /** 削除前の確認モーダルを描きます。 */
  private drawDeleteModal(draft: StoryCreatorDraft): void {
    const layer = this.add.container(0, 0).setDepth(120);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    layer.add(overlay);

    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(34, 270, GAME_WIDTH - 68, 210, 22);
    graphics.strokeRoundedRect(34, 270, GAME_WIDTH - 68, 210, 22);
    layer.add(graphics);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 314, 'このお話を けす？', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    layer.add(this.add
      .text(GAME_WIDTH / 2, 354, draft.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
        wordWrap: { width: 250, useAdvancedWrap: true },
      })
      .setOrigin(0.5));

    const cancelButton = createButton(this, {
      x: 116,
      y: 424,
      width: 112,
      height: 44,
      label: 'やめる',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 17,
      onClick: () => this.closeDeleteModal(),
    });
    layer.add(cancelButton);

    const deleteButton = createButton(this, {
      x: 274,
      y: 424,
      width: 112,
      height: 44,
      label: 'けす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 17,
      onClick: () => this.deleteDraft(draft),
    });
    layer.add(deleteButton);
  }

  /** 一覧画面を再描画します。 */
  private redraw(): void {
    this.children.removeAll(true);
    this.clampListPage();
    this.drawBackground();
    this.drawHeader();
    this.drawDraftList();
    if (this.deleteTarget) {
      this.drawDeleteModal(this.deleteTarget);
    }
  }

  /** 一覧に表示するセリフの先頭を返します。 */
  /** JSONファイル選択用のHTML入力欄を片付けます。 */
  private destroyJsonFileInput(): void {
    this.jsonFileInput?.remove();
    this.jsonFileInput = undefined;
  }

  /** 一覧に表示するセリフの先頭を返します。 */
  private getDraftSnippet(draft: StoryCreatorDraft): string {
    const firstText = draft.pages.find((page) => page.text.trim())?.text.trim() ?? '';
    const firstTextBoxLine = draft.pages
      .flatMap((page) => page.placements)
      .find((placement) => placement.kind === 'textBox')
      ?.textBox
      ?.lines
      .find((line) => line.text.trim())
      ?.text
      .trim() ?? '';
    const snippet = firstText || firstTextBoxLine;
    return snippet ? snippet.slice(0, 34) : 'セリフなし';
  }

  /** 保存済みストーリー一覧を前後のページへ移動します。 */
  private changeDraftListPage(delta: number): void {
    this.listPage = Phaser.Math.Clamp(this.listPage + delta, 0, this.getDraftPageCount() - 1);
    this.redraw();
  }

  /** 保存済みストーリー一覧の総ページ数を返します。 */
  private getDraftPageCount(): number {
    return Math.max(1, Math.ceil(this.drafts.length / DRAFTS_PER_LIST_PAGE));
  }

  /** 保存済みストーリー一覧のページ番号が、今の保存数に収まるよう整えます。 */
  private clampListPage(): void {
    this.listPage = Phaser.Math.Clamp(this.listPage, 0, this.getDraftPageCount() - 1);
  }

  /** 下書きデータを画面間で安全に渡せるよう複製します。 */
  private cloneDraft(draft: StoryCreatorDraft): StoryCreatorDraft {
    return {
      id: draft.id,
      name: draft.name,
      updatedAt: draft.updatedAt,
      pages: draft.pages.map((page) => ({
        text: page.text,
        speaker: { ...(page.speaker ?? { kind: 'narration' }) },
        placements: page.placements.map((placement) => cloneStoryCreatorPlacement(placement)),
        soundEffectId: page.soundEffectId,
      })),
    };
  }
}
