import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import { getStageById } from '../../../data/stages';
import {
  evolveMonster,
  getMonsterCaptureCount,
  loadSaveState,
} from '../../../state/save';
import { playEvolutionBuildUp, playEvolutionFanfare } from '../../audio';
import { startStageBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import { EvolutionSceneData, MonsterDefinition, StageDefinition, StageId } from '../../types';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';

export class EvolutionScene extends Phaser.Scene {
  private stageId: StageId = 'g1-tashizan-hazimarinosougen';
  private monsterId = 'picoleaf';
  private sourceMonster!: MonsterDefinition;
  private evolvedMonster!: MonsterDefinition;
  private stage!: StageDefinition;

  constructor() {
    super(SceneKeys.Evolution);
  }

  init(data?: EvolutionSceneData): void {
    this.stageId = data?.stageId ?? 'g1-tashizan-hazimarinosougen';
    this.monsterId = data?.monsterId ?? 'picoleaf';
    this.stage = getStageById(this.stageId);
    this.sourceMonster = getMonsterById(this.monsterId);
    this.evolvedMonster = getMonsterById(this.sourceMonster.nextEvolutionId ?? this.sourceMonster.id);
  }

  preload(): void {
    preloadMonsterImageAssetsByIds(this, [
      this.sourceMonster.id,
      this.evolvedMonster.id,
      ...this.getEvolutionLine().map((monster) => monster.id),
    ]);
  }

  create(): void {
    startStageBgm(this.stageId);
    this.cameras.main.setBackgroundColor('#fff7d7');
    this.drawBackground();

    this.add
      .text(GAME_WIDTH / 2, 86, 'しんかが はじまる！', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.drawEvolutionLine();

    const glow = this.add.graphics();
    const sourceVisual = createMonsterVisual(this, this.sourceMonster, GAME_WIDTH / 2, 374, 130).setDepth(2);
    const evolvedVisual = createMonsterVisual(this, this.evolvedMonster, GAME_WIDTH / 2, 374, 142)
      .setDepth(3)
      .setAlpha(0)
      .setScale(0.7);
    const message = this.add
      .text(GAME_WIDTH / 2, 612, `${this.sourceMonster.name}の\nようすが…？`, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    if (this.isEvolvedMonsterRegistered()) {
      sourceVisual.setAlpha(0.35).setScale(0.78);
      evolvedVisual.setAlpha(1).setScale(1);
      message.setText('しんかはそろってるよ！\nたくさんあつめて\nアメにしよう！');
      this.time.delayedCall(1400, () => {
        this.scene.start(SceneKeys.Result, {
          stageId: this.stageId,
          monsterId: this.sourceMonster.id,
        });
      });
      return;
    }

    this.animateEvolution(glow, sourceVisual, evolvedVisual, message);
  }

  private drawEvolutionLine(): void {
    const line = this.getEvolutionLine();
    if (line.length <= 1) {
      return;
    }

    const saveState = loadSaveState();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.96);
    panel.lineStyle(3, Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, 0.9);
    panel.fillRoundedRect(42, 122, 306, 116, 18);
    panel.strokeRoundedRect(42, 122, 306, 116, 18);

    const spacing = line.length === 2 ? 118 : 92;
    const startX = GAME_WIDTH / 2 - spacing * (line.length - 1) / 2;
    const y = 172;
    line.forEach((monster, index) => {
      const x = startX + index * spacing;
      const isFutureEvolution = monster.evolutionStage > this.sourceMonster.evolutionStage;
      const isRegistered = getMonsterCaptureCount(saveState, monster.id) > 0;
      const showSilhouette = isFutureEvolution || !isRegistered;

      if (index > 0) {
        this.add
          .text(x - spacing / 2, y - 2, '→', {
            fontFamily: FONT_FAMILY,
            fontSize: '22px',
            fontStyle: '900',
            color: COLORS.muted,
          })
          .setOrigin(0.5);
      }

      this.add
        .circle(x, y - 4, 31, Phaser.Display.Color.HexStringToColor(showSilhouette ? '#eef2f7' : monster.palette.background).color, 1)
        .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(showSilhouette ? COLORS.muted : monster.palette.accent).color, 0.8);
      createMonsterVisual(this, monster, x, y - 4, 54, showSilhouette);
      this.add
        .text(x, y + 46, showSilhouette ? '???' : monster.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          fontStyle: '900',
          color: showSilhouette ? COLORS.muted : COLORS.ink,
          align: 'center',
          wordWrap: { width: 78, useAdvancedWrap: true },
        })
        .setOrigin(0.5);
    });
  }

  private getEvolutionLine(): MonsterDefinition[] {
    let firstMonster = this.sourceMonster;
    while (firstMonster.previousEvolutionId) {
      firstMonster = getMonsterById(firstMonster.previousEvolutionId);
    }

    const line = [firstMonster];
    let currentMonster = firstMonster;
    while (currentMonster.nextEvolutionId) {
      currentMonster = getMonsterById(currentMonster.nextEvolutionId);
      line.push(currentMonster);
    }

    return line;
  }

  private isEvolvedMonsterRegistered(): boolean {
    if (!this.sourceMonster.nextEvolutionId) {
      return false;
    }

    return getMonsterCaptureCount(loadSaveState(), this.evolvedMonster.id) > 0;
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff7d7').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, 0.22);
    graphics.fillCircle(56, 128, 96);
    graphics.fillCircle(338, 704, 136);
    graphics.lineStyle(5, Phaser.Display.Color.HexStringToColor('#ffffff').color, 0.72);
    graphics.strokeCircle(GAME_WIDTH / 2, 374, 122);
  }

  /** 光の点滅で元の姿を隠し、進化先の姿へ差し替えてからリザルトへ戻します。 */
  private animateEvolution(
    glow: Phaser.GameObjects.Graphics,
    sourceVisual: Phaser.GameObjects.Image,
    evolvedVisual: Phaser.GameObjects.Image,
    message: Phaser.GameObjects.Text,
  ): void {
    playEvolutionBuildUp();

    this.tweens.add({
      targets: sourceVisual,
      scale: 1.16,
      angle: 3,
      yoyo: true,
      repeat: 5,
      duration: 180,
      ease: 'Sine.easeInOut',
    });

    this.time.addEvent({
      delay: 90,
      repeat: 18,
      callback: () => {
        const radius = Phaser.Math.Between(78, 150);
        const alpha = Phaser.Math.FloatBetween(0.16, 0.42);
        glow.clear();
        glow.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, alpha);
        glow.fillCircle(GAME_WIDTH / 2, 374, radius);
        glow.lineStyle(4, Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, alpha);
        glow.strokeCircle(GAME_WIDTH / 2, 374, radius + 18);
      },
    });

    this.time.delayedCall(1020, () => {
      this.cameras.main.flash(460, 255, 255, 210);
      this.tweens.add({
        targets: sourceVisual,
        alpha: 0,
        scale: 0.45,
        duration: 360,
        ease: 'Back.easeIn',
      });
    });

    this.time.delayedCall(1450, () => {
      const requiredFragments = this.sourceMonster.evolutionRequiredFragments;
      if (requiredFragments === null) {
        this.scene.start(SceneKeys.Result, {
          stageId: this.stageId,
          monsterId: this.sourceMonster.id,
        });
        return;
      }

      if (this.isEvolvedMonsterRegistered()) {
        message.setText('しんかはそろってるよ！\nたくさんあつめて\nアメにしよう！');
        this.time.delayedCall(1200, () => {
          this.scene.start(SceneKeys.Result, {
            stageId: this.stageId,
            monsterId: this.sourceMonster.id,
          });
        });
        return;
      }

      const evolutionResult = evolveMonster(this.sourceMonster.id, this.evolvedMonster.id, requiredFragments);
      if (!evolutionResult) {
        message.setText('かけらが\nたりないみたい');
        this.time.delayedCall(1200, () => {
          this.scene.start(SceneKeys.Result, {
            stageId: this.stageId,
            monsterId: this.sourceMonster.id,
          });
        });
        return;
      }

      playEvolutionFanfare();
      glow.clear();
      message.setText(`${this.evolvedMonster.name}に\nしんかした！`);
      this.revealEvolvedMonsterInLine();
      this.tweens.add({
        targets: evolvedVisual,
        alpha: 1,
        scale: 1,
        duration: 520,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: message,
        scale: 1.08,
        yoyo: true,
        repeat: 2,
        duration: 140,
      });

      this.time.delayedCall(1700, () => {
        this.scene.start(SceneKeys.Result, {
          stageId: this.stageId,
          monsterId: this.evolvedMonster.id,
          wasNew: evolutionResult.wasNew,
          captureCount: evolutionResult.evolvedCaptureCount,
          evolvedFromMonsterId: this.sourceMonster.id,
        });
      });
    });
  }

  private revealEvolvedMonsterInLine(): void {
    const line = this.getEvolutionLine();
    const evolvedIndex = line.findIndex((monster) => monster.id === this.evolvedMonster.id);
    if (evolvedIndex < 0) {
      return;
    }

    const spacing = line.length === 2 ? 118 : 92;
    const x = GAME_WIDTH / 2 - (spacing * (line.length - 1)) / 2 + evolvedIndex * spacing;
    const y = 168;
    const cover = this.add
      .circle(x, y, 33, Phaser.Display.Color.HexStringToColor(this.evolvedMonster.palette.background).color, 1)
      .setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 1)
      .setDepth(6);
    const visual = createMonsterVisual(this, this.evolvedMonster, x, y, 58, false).setDepth(7);
    const labelBackground = this.add
      .rectangle(x, y + 50, 84, 20, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.92)
      .setDepth(6);
    const label = this.add
      .text(x, y + 50, this.evolvedMonster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: 78, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(7);
    const ring = this.add
      .circle(x, y, 36, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0)
      .setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0.95)
      .setDepth(5);

    [cover, visual, labelBackground, label].forEach((target) => target.setScale(0.84));
    this.tweens.add({
      targets: [cover, visual, labelBackground, label],
      scale: 1,
      duration: 340,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: [cover, visual],
      scale: 1.13,
      yoyo: true,
      repeat: 2,
      duration: 170,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: ring,
      scale: 1.5,
      alpha: 0,
      duration: 760,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.addLineUnlockSparkles(x, y);
  }

  private addLineUnlockSparkles(x: number, y: number): void {
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
      const sparkle = this.add
        .text(x + Math.cos(angle) * 25, y + Math.sin(angle) * 25, '✦', {
          fontFamily: FONT_FAMILY,
          fontSize: index % 2 === 0 ? '16px' : '12px',
          fontStyle: '900',
          color: COLORS.yellow,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(8);
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * 46,
        y: y + Math.sin(angle) * 46,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.45, to: 1.25 },
        yoyo: true,
        duration: 620,
        delay: index * 42,
        ease: 'Sine.easeOut',
        onComplete: () => sparkle.destroy(),
      });
    }
  }
}
