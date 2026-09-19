import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import { debugTalkStoryScript } from '../../../data/storyScripts';
import type { StoryActorDefinition, StoryActorPlacement, StoryActorSlot, StoryMessageDefinition } from '../../../data/storyScripts';
import { getTrainerById } from '../../../data/trainers';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { preloadTrainerImageAssetsByIds } from '../../assets/trainerImageAssets';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createRichText } from '../../ui/common/richText';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { createTrainerIntroVisual } from '../../ui/creatures/trainerVisual';

type StoryMode = 'teacher' | 'talk';

interface StorySceneData {
  mode?: StoryMode;
  talkPageIndex?: number;
}

const STORY_TRAINER_ID = 'trainer-haru';
const DIALOG_Y = 626;
// Leave the log heading and close button outside the scrollable text area.
const LOG_VIEWPORT = { x: 62, y: 274, width: 266, height: 244 } as const;
const STORY_SLOT_X: Record<StoryActorSlot, number> = {
  farLeft: 58,
  left: 102,
  center: GAME_WIDTH / 2,
  right: 292,
  farRight: 334,
};

function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

function isStoryMode(value: unknown): value is StoryMode {
  return value === 'teacher' || value === 'talk';
}

export class StoryScene extends Phaser.Scene {
  private mode: StoryMode = 'teacher';
  private talkPageIndex = 0;
  private logLayer?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.Story);
  }

  init(data?: StorySceneData): void {
    this.mode = isStoryMode(data?.mode) ? data.mode : 'teacher';
    this.talkPageIndex = Phaser.Math.Clamp(
      Math.floor(data?.talkPageIndex ?? 0),
      0,
      debugTalkStoryScript.messages.length - 1,
    );
  }

  preload(): void {
    preloadMonsterImageAssetsByIds(
      this,
      debugTalkStoryScript.actors.map((actor) => actor.monsterId),
    );
    preloadTrainerImageAssetsByIds(this, [
      STORY_TRAINER_ID,
      ...debugTalkStoryScript.actors.map((actor) => actor.trainerId),
    ]);
    debugTalkStoryScript.actors.forEach((actor) => {
      if (actor.portraitKey && actor.portraitPath && !this.textures.exists(actor.portraitKey)) {
        this.load.image(actor.portraitKey, actor.portraitPath);
      }
    });
  }

  create(): void {
    startBgm('home');
    this.cameras.main.setBackgroundColor('#eef8f3');
    this.drawBackground();
    this.drawHeader();
    this.drawModeTabs();

    if (this.mode === 'teacher') {
      this.drawTeacherMode();
    } else {
      this.drawTalkMode();
    }

    this.drawDialogueWindow();
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#eef8f3'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    graphics.fillStyle(colorToNumber('#ffffff'), 0.92);
    graphics.fillRect(0, 0, GAME_WIDTH, 142);
    graphics.fillStyle(colorToNumber('#e6f0ff'), 1);
    graphics.fillRect(0, 584, GAME_WIDTH, GAME_HEIGHT - 584);

    graphics.lineStyle(2, colorToNumber('#d6eadf'), 0.62);
    for (let x = 30; x < GAME_WIDTH; x += 54) {
      graphics.lineBetween(x, 154, x, 584);
    }

    graphics.lineStyle(3, colorToNumber('#c7dbec'), 0.82);
    graphics.lineBetween(0, 584, GAME_WIDTH, 584);
  }

  private drawHeader(): void {
    createSmallButton(this, 42, 44, '←', () => this.scene.start(SceneKeys.MainMenu));

    this.add
      .text(174, 38, 'ストーリー', {
        fontFamily: FONT_FAMILY,
        fontSize: '25px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 266,
      y: 44,
      width: 58,
      height: 42,
      label: 'ログ',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 17,
      onClick: () => this.openLog(),
    });

    createButton(this, {
      x: 334,
      y: 44,
      width: 64,
      height: 42,
      label: '中止',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 17,
      onClick: () => this.scene.start(SceneKeys.MainMenu),
    });
  }

  private drawModeTabs(): void {
    const teacherActive = this.mode === 'teacher';
    const talkActive = this.mode === 'talk';

    createButton(this, {
      x: 112,
      y: 108,
      width: 148,
      height: 44,
      label: '先生モード',
      fillColor: teacherActive ? '#fff1a8' : COLORS.panel,
      strokeColor: teacherActive ? '#b8941e' : '#9cb5c7',
      fontSize: 16,
      onClick: () => this.switchMode('teacher'),
    });

    createButton(this, {
      x: 278,
      y: 108,
      width: 148,
      height: 44,
      label: '会話モード',
      fillColor: talkActive ? '#dff6ed' : COLORS.panel,
      strokeColor: talkActive ? '#2f9f61' : '#9cb5c7',
      fontSize: 16,
      onClick: () => this.switchMode('talk'),
    });
  }

  private switchMode(mode: StoryMode): void {
    if (this.mode === mode) {
      return;
    }

    this.scene.restart({ mode, talkPageIndex: 0 });
  }

  private drawTeacherMode(): void {
    const teacher = getTrainerById(STORY_TRAINER_ID);
    this.drawCharacterShadow(86, 550, 128, 24);
    const visual = createTrainerIntroVisual(this, teacher, 86, 444, 184);
    visual.setDepth(6);
    this.drawNameTag(86, 572, `${teacher.name}先生`, '#fff1a8');
    this.drawTeacherBoard();
  }

  private drawTeacherBoard(): void {
    const graphics = this.add.graphics();
    const x = 152;
    const y = 158;
    const width = 214;
    const height = 408;

    graphics.fillStyle(colorToNumber('#fefdf7'), 1);
    graphics.lineStyle(4, colorToNumber('#47647d'), 1);
    graphics.fillRoundedRect(x, y, width, height, 18);
    graphics.strokeRoundedRect(x, y, width, height, 18);
    graphics.fillStyle(colorToNumber('#dff6ed'), 1);
    graphics.fillRoundedRect(x + 12, y + 12, width - 24, 54, 14);

    this.add
      .text(x + width / 2, y + 39, '先生メモ', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(x + width / 2, y + 104, '3 + 4 = 7', {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.drawCounterRow(x + 28, y + 146);

    this.add
      .text(x + 24, y + 228, '三と四を\nあわせると\n七になるよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
        lineSpacing: 8,
        wordWrap: { width: width - 48, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);

    this.add
      .text(x + width / 2, y + height - 44, '答えは 七', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: '#b52a24',
      })
      .setOrigin(0.5);
  }

  private drawCounterRow(x: number, y: number): void {
    const graphics = this.add.graphics();
    const radius = 12;

    for (let index = 0; index < 7; index += 1) {
      const isLeftGroup = index < 3;
      const cx = x + index * 23 + (isLeftGroup ? 0 : 14);
      graphics.fillStyle(colorToNumber(isLeftGroup ? COLORS.water : COLORS.yellow), 1);
      graphics.lineStyle(3, colorToNumber(COLORS.line), 0.88);
      graphics.fillCircle(cx, y, radius);
      graphics.strokeCircle(cx, y, radius);
    }

    this.add
      .text(x + 72, y + 38, '三  +  四', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawTalkMode(): void {
    const message = this.getTalkMessage();
    this.getTalkPlacements(message).forEach((placement, index) => {
      const actor = this.getTalkActor(placement.actorId);
      if (actor) {
        this.drawStoryActor(actor, placement, index);
      }
    });

    this.drawTalkCenterPanel();
  }

  private drawTalkCenterPanel(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.94);
    graphics.lineStyle(3, colorToNumber('#9cb5c7'), 1);
    graphics.fillRoundedRect(84, 160, 222, 92, 16);
    graphics.strokeRoundedRect(84, 160, 222, 92, 16);

    this.add
      .text(GAME_WIDTH / 2, 190, '会話モード', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 224, 'なん人でも おけるよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 244, `${this.talkPageIndex + 1}/${debugTalkStoryScript.messages.length}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawDialogueWindow(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.97);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(18, DIALOG_Y, GAME_WIDTH - 36, 188, 20);
    graphics.strokeRoundedRect(18, DIALOG_Y, GAME_WIDTH - 36, 188, 20);
    graphics.fillStyle(colorToNumber('#e6f0ff'), 1);
    graphics.fillRoundedRect(34, DIALOG_Y + 16, 126, 38, 13);

    const text = this.getDialogueText();
    this.add
      .text(96, DIALOG_Y + 35, text.speaker, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const bodyFontSize = this.mode === 'talk' ? '20px' : '23px';
    const bodyLineSpacing = this.mode === 'talk' ? 6 : 9;
    const bodyY = this.mode === 'talk' ? DIALOG_Y + 68 : DIALOG_Y + 76;

    createRichText(this, 40, bodyY, text.body, {
      width: GAME_WIDTH - 80,
      fontSize: Number.parseInt(bodyFontSize, 10),
      fontStyle: '900',
      color: COLORS.ink,
      lineSpacing: bodyLineSpacing,
    });

    this.add
      .text(GAME_WIDTH - 48, DIALOG_Y + 158, '▽', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: '#b52a24',
      })
      .setOrigin(0.5);

    if (this.mode === 'talk') {
      this.add
        .zone(GAME_WIDTH / 2, DIALOG_Y + 94, GAME_WIDTH - 36, 188)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.advanceTalkPage());
    }
  }

  private getDialogueText(): { speaker: string; body: string } {
    if (this.mode === 'teacher') {
      const teacher = getTrainerById(STORY_TRAINER_ID);
      return {
        speaker: `${teacher.name}先生`,
        body: '三と四を あわせると\n七になるよ。',
      };
    }

    const message = this.getTalkMessage();
    const speaker = this.getTalkActor(message.speakerId);
    return {
      speaker: speaker?.name ?? '???',
      body: message.text,
    };
  }

  private drawStoryActor(actor: StoryActorDefinition, placement: StoryActorPlacement, index: number): void {
    const slot = placement.slot ?? actor.slot;
    const scale = placement.scale ?? 1;
    const x = (placement.x ?? STORY_SLOT_X[slot]) + (actor.portraitOffsetX ?? 0) + (placement.offsetX ?? 0);
    const y = (placement.y ?? 430) + (actor.portraitOffsetY ?? 0) + (placement.offsetY ?? 0);
    const shouldFlip = placement.flipX ?? (slot === 'right' || slot === 'farRight');
    const depth = placement.depth ?? (6 + index);

    if (actor.portraitKey && this.textures.exists(actor.portraitKey)) {
      const portraitSize = (actor.portraitSize ?? 220) * scale;
      this.drawCharacterShadow(x, 552, Math.min(156, portraitSize * 0.62), 25);
      this.add
        .image(x, y, actor.portraitKey)
        .setDisplaySize(portraitSize, portraitSize)
        .setFlipX(shouldFlip)
        .setDepth(depth);
    } else if (actor.kind === 'monster' && actor.monsterId) {
      const monsterSize = 154 * scale;
      this.drawCharacterShadow(x, 552, 132, 23);
      const monsterVisual = createMonsterVisual(this, getMonsterById(actor.monsterId), x, y + 14, monsterSize);
      monsterVisual.setDepth(depth);
      monsterVisual.setFlipX(shouldFlip);
    } else if (actor.trainerId) {
      const trainerSize = 178 * scale;
      this.drawCharacterShadow(x, 552, 142, 25);
      const trainerVisual = createTrainerIntroVisual(
        this,
        getTrainerById(actor.trainerId),
        x,
        y,
        trainerSize,
      );
      trainerVisual.setDepth(depth);
      trainerVisual.setFlipX(shouldFlip);
    }

    this.drawNameTag(x, 572, actor.name, actor.tagColor, depth + 2);
  }

  private getTalkMessage() {
    return debugTalkStoryScript.messages[this.talkPageIndex] ?? debugTalkStoryScript.messages[0];
  }

  private getTalkActor(actorId: string): StoryActorDefinition | undefined {
    return debugTalkStoryScript.actors.find((actor) => actor.id === actorId);
  }

  private getTalkPlacements(message: StoryMessageDefinition): StoryActorPlacement[] {
    if (message.placements?.length) {
      return message.placements;
    }

    return (message.visibleActorIds ?? []).map((actorId) => ({ actorId }));
  }

  private advanceTalkPage(): void {
    const nextPageIndex = this.talkPageIndex + 1;
    if (nextPageIndex >= debugTalkStoryScript.messages.length) {
      this.scene.start(SceneKeys.MainMenu);
      return;
    }

    this.scene.restart({ mode: 'talk', talkPageIndex: nextPageIndex });
  }

  private drawNameTag(x: number, y: number, label: string, fillColor: string, depth = 8): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber(fillColor), 1);
    graphics.lineStyle(3, colorToNumber(COLORS.line), 0.88);
    graphics.fillRoundedRect(x - 60, y - 19, 120, 38, 14);
    graphics.strokeRoundedRect(x - 60, y - 19, 120, 38, 14);
    graphics.setDepth(depth);

    this.add
      .text(x, y, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: 104, useAdvancedWrap: true },
      })
      .setDepth(depth + 1)
      .setOrigin(0.5);
  }

  private drawCharacterShadow(x: number, y: number, width: number, height: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#8090a3'), 0.22);
    graphics.fillEllipse(x, y, width, height);
  }

  /** Opens a modal log with a clipped body and fixed heading and close button. */
  private openLog(): void {
    this.closeLog();

    const layer = this.add.container(0, 0).setDepth(100);
    this.logLayer = layer;

    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(34, 184, GAME_WIDTH - 68, 438, 22);
    graphics.strokeRoundedRect(34, 184, GAME_WIDTH - 68, 438, 22);
    layer.add([overlay, graphics]);

    const title = this.add
      .text(GAME_WIDTH / 2, 226, 'ログ', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    layer.add(title);

    const logText = this.add
      .text(LOG_VIEWPORT.x, LOG_VIEWPORT.y, this.getLogLines().join('\n'), {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '800',
        color: COLORS.ink,
        lineSpacing: 14,
        // Crop coordinates and scroll offsets use the same logical pixels.
        resolution: 1,
        wordWrap: { width: LOG_VIEWPORT.width - 16, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    layer.add(logText);
    this.addLogScrolling(layer, logText);

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 566,
      width: 156,
      height: 48,
      label: 'とじる',
      fillColor: COLORS.yellow,
      fontSize: 20,
      onClick: () => this.closeLog(),
    });
    layer.add(closeButton);
  }

  /** Clips log text and binds wheel/drag scrolling only for this modal's lifetime. */
  private addLogScrolling(layer: Phaser.GameObjects.Container, logText: Phaser.GameObjects.Text): void {
    const viewport = LOG_VIEWPORT;
    const maxScroll = Math.max(0, logText.height - viewport.height);
    const canScroll = maxScroll > 0;
    const thumbHeight = Math.min(viewport.height, Math.max(24, viewport.height * viewport.height / Math.max(1, logText.height)));
    const track = this.add.rectangle(viewport.x + viewport.width - 4, viewport.y, 4, viewport.height, 0xd6eadf)
      .setOrigin(0.5, 0).setVisible(canScroll);
    const thumb = this.add.rectangle(track.x, viewport.y, 4, thumbHeight, 0x47647d)
      .setOrigin(0.5, 0).setVisible(canScroll);
    const hint = this.add.text(GAME_WIDTH / 2, 253, '上下に なぞって 読めるよ', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.muted,
    }).setOrigin(0.5).setVisible(canScroll);
    const hitArea = this.add.zone(viewport.x, viewport.y, viewport.width, viewport.height)
      .setOrigin(0).setInteractive();
    layer.add([track, thumb, hint, hitArea]);

    let scrollY = 0;
    let dragPointerId: number | null = null;
    let previousPointerY = 0;

    /** Moves the text within its measured bounds and updates the position indicator. */
    const setScroll = (nextY: number): void => {
      scrollY = Phaser.Math.Clamp(nextY, 0, maxScroll);
      logText.y = viewport.y - scrollY;
      // Text cropping works in both Phaser 4 WebGL and Canvas; geometry masks are Canvas-only.
      logText.setCrop(0, scrollY, Math.min(logText.width, viewport.width - 12), viewport.height);
      thumb.y = viewport.y + (maxScroll > 0 ? scrollY / maxScroll : 0) * (viewport.height - thumbHeight);
    };
    setScroll(0);
    /** Starts dragging only when the pointer is pressed inside the log body. */
    const startDrag = (pointer: Phaser.Input.Pointer): void => {
      if (!canScroll || dragPointerId !== null) return;
      dragPointerId = pointer.id;
      previousPointerY = pointer.y;
    };
    /** Continues the same drag even if the pointer leaves the text rectangle. */
    const moveDrag = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== dragPointerId || !pointer.isDown) return;
      setScroll(scrollY + previousPointerY - pointer.y);
      previousPointerY = pointer.y;
    };
    /** Releases the active pointer both inside and outside the game canvas. */
    const endDrag = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === dragPointerId) dragPointerId = null;
    };
    /** Scrolls only when the wheel is used over the log body. */
    const onWheel = (
      _pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number, _deltaZ: number,
      event: Phaser.Types.Input.EventData,
    ): void => {
      setScroll(scrollY + deltaY);
      event.stopPropagation();
    };
    hitArea.on('pointerdown', startDrag);
    hitArea.on('wheel', onWheel);
    this.input.on('pointermove', moveDrag);
    this.input.on('pointerup', endDrag);
    this.input.on('pointerupoutside', endDrag);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.closeLog, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.closeLog, this);

    /** Removes scene-level listeners when the modal and its child objects are destroyed. */
    const cleanup = (): void => {
      this.input.off('pointermove', moveDrag);
      this.input.off('pointerup', endDrag);
      this.input.off('pointerupoutside', endDrag);
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.closeLog, this);
      this.events.off(Phaser.Scenes.Events.DESTROY, this.closeLog, this);
    };
    layer.once(Phaser.GameObjects.Events.DESTROY, cleanup);
  }

  /** Closes the log and triggers disposal of its scroll handlers and child objects. */
  private closeLog(): void {
    const layer = this.logLayer;
    this.logLayer = undefined;
    layer?.destroy(true);
  }

  /** Returns all lines the player has reached without dropping older log entries. */
  private getLogLines(): string[] {
    if (this.mode === 'teacher') {
      const teacher = getTrainerById(STORY_TRAINER_ID);
      return [
        `${teacher.name}先生: 三と四を あわせよう`,
        `${teacher.name}先生: 答えは 七`,
      ];
    }

    return debugTalkStoryScript.messages
      .slice(0, this.talkPageIndex + 1)
      .map((message) => {
        const speaker = this.getTalkActor(message.speakerId);
        return `${speaker?.name ?? '???'}: ${message.text.split('\n').join(' ')}`;
      });
  }
}
