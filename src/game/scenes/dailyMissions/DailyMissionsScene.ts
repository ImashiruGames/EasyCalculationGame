import * as Phaser from 'phaser';
import {
  DailyMissionStatus,
  claimDailyMissionAllClearReward,
  claimDailyMissionReward,
  getDailyMissionBoardStatus,
  loadSaveState,
} from '../../../state/save';
import { playRewardPopupSound } from '../../audio';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { startSceneWithLoading } from '../../sceneNavigation';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';

function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class DailyMissionsScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.DailyMissions);
  }

  create(): void {
    startBgm('home');
    const saveState = loadSaveState();
    const boardStatus = getDailyMissionBoardStatus(saveState);

    this.cameras.main.setBackgroundColor('#f7fbff');
    this.drawBackground();
    this.drawHeader();
    this.drawSummary(boardStatus.completedCount, boardStatus.missions.length);
    const activeMissions = boardStatus.missions.filter((missionStatus) => !missionStatus.isClaimed);
    activeMissions.forEach((missionStatus, index) => {
      this.drawMissionCard(missionStatus, 258 + index * 124);
    });
    if (boardStatus.allClearComplete && !boardStatus.allClearClaimed) {
      this.drawAllClearPanel(boardStatus, 258 + activeMissions.length * 124 + 64);
      return;
    }

    if (activeMissions.length === 0 && boardStatus.allClearClaimed) {
      this.drawDonePanel();
    }
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#f7fbff'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, colorToNumber('#d9edf8'), 0.62);
    for (let y = 28; y < GAME_HEIGHT; y += 28) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
    graphics.fillStyle(colorToNumber('#fff1a8'), 0.88);
    graphics.fillCircle(326, 126, 84);
    graphics.fillStyle(colorToNumber('#dff9e8'), 0.92);
    graphics.fillRoundedRect(-40, 180, 214, 62, 24);
    graphics.fillStyle(colorToNumber('#ffddec'), 0.9);
    graphics.fillRoundedRect(236, 612, 190, 72, 28);
    graphics.fillStyle(colorToNumber('#d8f2ff'), 0.9);
    graphics.fillRoundedRect(-28, 686, 202, 56, 22);
  }

  private drawHeader(): void {
    createSmallButton(this, 42, 52, '←', () => this.scene.start(SceneKeys.MainMenu));
    createSmallButton(this, 348, 52, '≡', () => showGameMenu(this));
    this.add
      .text(GAME_WIDTH / 2, 54, 'ミッション', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
  }

  private drawSummary(completedCount: number, missionCount: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.98);
    graphics.lineStyle(4, colorToNumber(COLORS.yellow), 1);
    graphics.fillRoundedRect(30, 96, 330, 102, 18);
    graphics.strokeRoundedRect(30, 96, 330, 102, 18);
    graphics.fillStyle(colorToNumber(COLORS.yellow), 0.28);
    graphics.fillRoundedRect(44, 110, 78, 74, 16);
    this.drawStar(82, 147, 28, COLORS.yellow, COLORS.line);

    this.add
      .text(138, 122, '今日すること', {
        fontFamily: FONT_FAMILY,
        fontSize: '21px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(138, 154, `できた ${completedCount}/${missionCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.grassDark,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(138, 178, 'ゲットしやすいどうぐがもらえるよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
  }

  private drawMissionCard(status: DailyMissionStatus, y: number): void {
    if (status.isClaimed) {
      return;
    }

    const graphics = this.add.graphics();
    const accentColor = status.mission.accentColor;
    const ratio = status.target > 0 ? Phaser.Math.Clamp(status.current / status.target, 0, 1) : 0;

    graphics.fillStyle(colorToNumber('#ffffff'), 0.98);
    graphics.lineStyle(3, colorToNumber(status.isComplete ? accentColor : COLORS.line), 1);
    graphics.fillRoundedRect(28, y - 48, 334, 96, 16);
    graphics.strokeRoundedRect(28, y - 48, 334, 96, 16);

    graphics.fillStyle(colorToNumber(accentColor), 0.42);
    graphics.fillCircle(66, y - 4, 28);
    this.drawCheckMark(66, y - 4, status.isComplete);

    this.add
      .text(102, y - 28, status.mission.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(102, y - 2, status.mission.description, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
        wordWrap: { width: 190, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.drawProgressBar(102, y + 22, 156, 10, ratio, accentColor);
    this.add
      .text(270, y + 22, `${status.current}/${status.target}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(102, y + 38, status.rewardLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '900',
        color: '#a35a16',
      })
      .setOrigin(0, 0.5);

    if (status.isComplete) {
      createButton(this, {
        x: 316,
        y,
        width: 76,
        height: 38,
        label: 'もらう',
        fillColor: accentColor,
        fontSize: 15,
        onClick: () => this.claimMission(status.mission.id),
      });
      return;
    }

    createButton(this, {
      x: 316,
      y,
      width: 76,
      height: 38,
      label: 'いく',
      fillColor: accentColor,
      fontSize: 16,
      onClick: () => this.goToMission(status),
    });
  }

  private drawAllClearPanel(boardStatus: ReturnType<typeof getDailyMissionBoardStatus>, y: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#fffdf2'), 0.98);
    graphics.lineStyle(4, colorToNumber(COLORS.yellow), 1);
    graphics.fillRoundedRect(28, y - 54, 334, 108, 18);
    graphics.strokeRoundedRect(28, y - 54, 334, 108, 18);
    graphics.fillStyle(colorToNumber('#ffe9dc'), 0.82);
    graphics.fillCircle(70, y, 34);
    this.drawStar(70, y, 28, COLORS.yellow, '#b52a24');

    this.add
      .text(116, y - 26, 'ぜんぶクリア', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(116, y, boardStatus.allClearRewardLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: '#a35a16',
      })
      .setOrigin(0, 0.5);
    this.add
      .text(116, y + 23, 'レアをねらえるよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);

    createButton(this, {
      x: 312,
      y,
      width: 84,
      height: 42,
      label: 'もらう',
      fillColor: COLORS.yellow,
      fontSize: 15,
      onClick: () => this.claimAllClear(),
    });
  }

  private drawDonePanel(): void {
    const y = 326;
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.98);
    graphics.lineStyle(4, colorToNumber(COLORS.grass), 1);
    graphics.fillRoundedRect(42, y - 72, 306, 172, 22);
    graphics.strokeRoundedRect(42, y - 72, 306, 172, 22);
    graphics.fillStyle(colorToNumber('#dcf8e8'), 0.92);
    graphics.fillCircle(96, y - 18, 34);
    this.drawStar(96, y - 18, 27, COLORS.yellow, COLORS.grassDark);

    this.add
      .text(142, y - 34, '今日のぶんは', {
        fontFamily: FONT_FAMILY,
        fontSize: '21px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(142, y - 4, 'ぜんぶOK', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.grassDark,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(GAME_WIDTH / 2, y + 36, 'また明日きてね', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: y + 76,
      width: 142,
      height: 42,
      label: 'ホームへ',
      fillColor: COLORS.grass,
      strokeColor: COLORS.grassDark,
      fontSize: 17,
      onClick: () => startSceneWithLoading(this, SceneKeys.MainMenu, 'mainMenu'),
    });
  }

  private drawProgressBar(
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    fillColor: string,
  ): void {
    this.add
      .rectangle(x, y, width, height, colorToNumber('#eadfca'), 1)
      .setOrigin(0, 0.5);
    this.add
      .rectangle(x, y, width * ratio, height, colorToNumber(fillColor), 1)
      .setOrigin(0, 0.5);
  }

  private drawCheckMark(x: number, y: number, isComplete: boolean): void {
    const label = isComplete ? '★' : '!';
    this.add
      .text(x, y + 1, label, {
        fontFamily: FONT_FAMILY,
        fontSize: isComplete ? '25px' : '22px',
        fontStyle: '900',
        color: isComplete ? '#b52a24' : COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private drawStar(x: number, y: number, radius: number, fillColor: string, strokeColor: string): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber(fillColor), 1);
    graphics.lineStyle(3, colorToNumber(strokeColor), 1);
    graphics.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const pointRadius = index % 2 === 0 ? radius : radius * 0.44;
      const angle = -Math.PI / 2 + (Math.PI * index) / 5;
      const pointX = x + Math.cos(angle) * pointRadius;
      const pointY = y + Math.sin(angle) * pointRadius;
      if (index === 0) {
        graphics.moveTo(pointX, pointY);
      } else {
        graphics.lineTo(pointX, pointY);
      }
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private goToMission(status: DailyMissionStatus): void {
    if (status.mission.progressKey === 'battleWins') {
      startSceneWithLoading(this, SceneKeys.BattleSelect, 'battleSelect', { openTrainerList: true });
      return;
    }

    startSceneWithLoading(this, SceneKeys.StageSelect, 'stageSelect', { openCategoryList: true });
  }

  private claimMission(missionId: string): void {
    const result = claimDailyMissionReward(missionId);
    if (!result) {
      this.scene.restart();
      return;
    }

    this.showRewardPopup(result.rewardLabel);
  }

  private claimAllClear(): void {
    const result = claimDailyMissionAllClearReward();
    if (!result) {
      this.scene.restart();
      return;
    }

    this.showRewardPopup(result.rewardLabel);
  }

  private showRewardPopup(rewardLabel: string): void {
    playRewardPopupSound();
    const overlay = this.add.container(0, 0).setDepth(100);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, colorToNumber(COLORS.line), 0.42).setOrigin(0);
    const panel = this.add.graphics();
    panel.fillStyle(colorToNumber('#ffffff'), 1);
    panel.lineStyle(5, colorToNumber(COLORS.yellow), 1);
    panel.fillRoundedRect(44, 260, 302, 238, 28);
    panel.strokeRoundedRect(44, 260, 302, 238, 28);
    overlay.add([shade, panel]);
    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 316, 'ごほうび ゲット!', {
          fontFamily: FONT_FAMILY,
          fontSize: '28px',
          fontStyle: '900',
          color: '#b52a24',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 386, rewardLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
          wordWrap: { width: 250, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );
    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 456,
      width: 120,
      height: 46,
      label: 'OK',
      fillColor: COLORS.yellow,
      fontSize: 20,
      onClick: () => this.scene.restart(),
    });
    overlay.add(closeButton);
  }
}
