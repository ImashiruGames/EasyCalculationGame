import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import {
  claimDailyLoginBonus,
  DailyLoginBonusStatus,
  DAILY_LOGIN_COIN_REWARDS,
  getDailyLoginBonusStatus,
  loadSaveState,
} from '../../../state/save';
import { playRewardPopupSound, playStampSound } from '../../audio';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { DEBUG_ALWAYS_SHOW_LOGIN_BONUS_SCREEN, SHOW_LOGIN_BONUS_SCREEN } from '../../flowConfig';
import { APP_LAYOUT } from '../../layoutConfig';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { SceneKeys } from '../../sceneKeys';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';

function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class LoginBonusScene extends Phaser.Scene {
  private canContinue = false;
  private tapHintText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKeys.LoginBonus);
  }

  preload(): void {
    preloadMonsterImageAssetsByIds(this, ['kirapon', 'tenpico', 'yukipon']);
  }

  create(): void {
    startBgm('home');
    this.canContinue = false;
    if (!SHOW_LOGIN_BONUS_SCREEN) {
      this.scene.start(SceneKeys.MainMenu);
      return;
    }

    const claimResult = claimDailyLoginBonus();
    if (!claimResult && !DEBUG_ALWAYS_SHOW_LOGIN_BONUS_SCREEN) {
      this.scene.start(SceneKeys.MainMenu);
      return;
    }

    const status = claimResult?.status ?? getDailyLoginBonusStatus(loadSaveState());
    const wasClaimed = Boolean(claimResult);
    this.cameras.main.setBackgroundColor('#fff8df');
    this.drawBackground();
    const shouldPlayClaimAnimation = wasClaimed;
    const todayStampPosition = this.drawStampCard(status, wasClaimed, shouldPlayClaimAnimation);
    this.drawHeader();
    if (!shouldPlayClaimAnimation) {
      this.drawReward(status, wasClaimed);
    }
    this.drawCharacters();
    this.drawTapHint(shouldPlayClaimAnimation ? 'アニメのあと タップで すすむ' : 'どこでもタッチで すすむ');

    if (shouldPlayClaimAnimation) {
      this.time.delayedCall(520, () => {
        this.playStampPressAnimation(todayStampPosition, () => {
          this.time.delayedCall(520, () => this.showRewardOverlay(status));
        });
      });
      return;
    }

    this.time.delayedCall(450, () => this.enableTapToHome());
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#dff6ff'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(colorToNumber('#fff8df'), 1);
    graphics.fillRoundedRect(18, 128, 354, 584, 34);
    graphics.fillStyle(colorToNumber('#bfefff'), 0.68);
    graphics.fillCircle(44, 90, 76);
    graphics.fillCircle(342, 708, 84);
    graphics.fillStyle(colorToNumber('#f7d4f1'), 0.76);
    graphics.fillCircle(348, 122, 52);
    graphics.fillStyle(colorToNumber('#dff9e8'), 0.86);
    graphics.fillRoundedRect(32, 246, 326, 382, 36);
  }

  private drawHeader(): void {
    const graphics = this.add.graphics();
    const shadow = [
      new Phaser.Math.Vector2(38, 108),
      new Phaser.Math.Vector2(94, 82),
      new Phaser.Math.Vector2(296, 82),
      new Phaser.Math.Vector2(352, 108),
      new Phaser.Math.Vector2(328, 150),
      new Phaser.Math.Vector2(62, 150),
    ];
    const ribbon = shadow.map((point) => new Phaser.Math.Vector2(point.x, point.y - 6));

    graphics.fillStyle(colorToNumber('#17d9ea'), 0.92);
    graphics.fillPoints(shadow, true);
    graphics.fillStyle(colorToNumber('#ff43a5'), 1);
    graphics.fillPoints(ribbon, true);
    graphics.lineStyle(4, colorToNumber('#cf1876'), 1);
    graphics.strokePoints(ribbon, true, true);
    graphics.lineStyle(2, colorToNumber('#ff9bd0'), 0.95);
    graphics.lineBetween(82, 94, 306, 94);

    this.drawSparkleStar(55, 127, 12, '#ffffff');
    this.drawSparkleStar(335, 96, 14, COLORS.yellow);

    this.add
      .text(GAME_WIDTH / 2, 114, 'デイリーログインボーナス', {
        fontFamily: FONT_FAMILY,
        fontSize: '25px',
        fontStyle: '900',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setStroke('#cf1876', 5);
  }

  private drawReward(status: DailyLoginBonusStatus, wasClaimed: boolean): void {
    const panel = this.add.graphics();
    panel.fillStyle(colorToNumber('#17d9ea'), 0.25);
    panel.fillRoundedRect(62, 582, 266, 42, 21);
    panel.fillStyle(colorToNumber('#ffffff'), 0.98);
    panel.lineStyle(3, colorToNumber('#17cde5'), 1);
    panel.fillRoundedRect(66, 576, 258, 42, 21);
    panel.strokeRoundedRect(66, 576, 258, 42, 21);

    this.add
      .text(GAME_WIDTH / 2, 587, wasClaimed ? '今日のプレゼント GET!' : '今日はもらったよ', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: '#ff2d8d',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 604, status.rewardLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: status.rewardItemId ? '12px' : '15px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 4);
  }

  private drawStampCard(
    status: DailyLoginBonusStatus,
    wasClaimed: boolean,
    shouldAnimateTodayStamp: boolean,
  ): { x: number; y: number } | null {
    const cardX = 16;
    const cardY = 136;
    const cardWidth = 358;
    const cardHeight = 432;
    const graphics = this.add.graphics();
    let todayPosition: { x: number; y: number } | null = null;

    graphics.fillStyle(colorToNumber('#13cfe6'), 0.22);
    graphics.fillRoundedRect(cardX + 5, cardY + 8, cardWidth, cardHeight, 66);
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(6, colorToNumber('#21d5e8'), 1);
    graphics.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 66);
    graphics.strokeRoundedRect(cardX, cardY, cardWidth, cardHeight, 66);
    graphics.lineStyle(2, colorToNumber('#e5fbff'), 1);
    graphics.strokeRoundedRect(cardX + 10, cardY + 10, cardWidth - 20, cardHeight - 20, 55);

    this.add
      .text(GAME_WIDTH / 2, cardY + 44, `れんぞく ${status.streakDays}日目`, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5);

    this.add
      .text(GAME_WIDTH / 2, cardY + 72, '7日目は レアベルつき', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: '#17bdd6',
      })
      .setOrigin(0.5);

    const topRowY = cardY + 156;
    const bottomRowY = cardY + 294;
    const topRowXs = [74, 154, 234, 314];
    const bottomRowXs = [112, 195, 278];

    for (let day = 1; day <= 7; day += 1) {
      const isFirstRow = day <= 4;
      const x = isFirstRow ? topRowXs[day - 1] : bottomRowXs[day - 5];
      const y = isFirstRow ? topRowY : bottomRowY;
      const isToday = day === status.cycleDay;
      const isStamped = day < status.cycleDay
        || (isToday && !shouldAnimateTodayStamp && (wasClaimed || !status.canClaim));
      this.drawStampSlot({
        x,
        y,
        day,
        rewardCoins: DAILY_LOGIN_COIN_REWARDS[day - 1],
        isToday,
        isStamped,
      });
      if (isToday) {
        todayPosition = { x, y };
      }
    }

    const message = shouldAnimateTodayStamp
      ? 'スタンプするよ'
      : wasClaimed || !status.canClaim
        ? '今日のスタンプをおしました'
        : 'また明日もきてね';
    graphics.fillStyle(colorToNumber('#fff1f8'), 1);
    graphics.lineStyle(3, colorToNumber('#ff7fbd'), 1);
    graphics.fillRoundedRect(62, cardY + 374, 266, 36, 18);
    graphics.strokeRoundedRect(62, cardY + 374, 266, 36, 18);
    this.add
      .text(GAME_WIDTH / 2, cardY + 392, message, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: '#ff2d8d',
      })
      .setOrigin(0.5);

    return todayPosition;
  }

  private drawStampSlot({
    x,
    y,
    day,
    rewardCoins,
    isToday,
    isStamped,
  }: {
    x: number;
    y: number;
    day: number;
    rewardCoins: number;
    isToday: boolean;
    isStamped: boolean;
  }): void {
    const graphics = this.add.graphics();
    const radius = 34;
    const borderColor = day === 7 ? COLORS.yellow : '#21d5e8';

    graphics.fillStyle(colorToNumber('#11cde4'), 0.2);
    graphics.fillCircle(x + 3, y + 5, radius + 3);
    graphics.fillStyle(colorToNumber(day === 7 ? '#fff7c6' : '#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(borderColor), 1);
    graphics.fillCircle(x, y, radius);
    graphics.strokeCircle(x, y, radius);
    graphics.lineStyle(2, colorToNumber('#dffbff'), 1);
    graphics.strokeCircle(x, y, radius - 7);

    if (isToday) {
      graphics.lineStyle(4, colorToNumber('#ff2d8d'), 0.9);
      graphics.strokeCircle(x, y, radius + 7);
      this.add
        .text(x, y - radius - 13, '今日', {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          fontStyle: '900',
          color: '#ff2d8d',
        })
        .setOrigin(0.5)
        .setStroke('#ffffff', 4);
    }

    this.add
      .text(x - 21, y - 22, `${day}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: '#16bdd6',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 4);

    if (isStamped) {
      this.createGetStamp(x, y);
      return;
    }

    if (day === 7) {
      this.createRareBellIcon(x, y - 5, 30);
      this.add
        .text(x, y + 25, `${rewardCoins}コイン`, {
          fontFamily: FONT_FAMILY,
          fontSize: '10px',
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5)
        .setStroke('#ffffff', 4);
      return;
    }

    this.createRewardIcon(x, y - 2, day, rewardCoins, 30);
    this.add
      .text(x, y + 24, `x ${rewardCoins}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 4);
  }

  private createGetStamp(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();

    graphics.fillStyle(colorToNumber('#ff3b35'), 0.08);
    graphics.fillCircle(0, 0, 25);
    graphics.lineStyle(3, colorToNumber('#ff3b35'), 0.96);
    graphics.strokeCircle(0, 0, 27);
    graphics.strokeCircle(0, 0, 21);
    graphics.lineStyle(2, colorToNumber('#ff3b35'), 0.9);
    graphics.strokeCircle(0, -4, 12);
    graphics.lineBetween(-12, -8, -5, -18);
    graphics.lineBetween(-4, -10, 2, -19);
    graphics.lineBetween(5, -9, 13, -16);
    graphics.lineBetween(-8, 1, 8, 1);

    const label = this.add
      .text(0, 18, 'GET!', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: '#ff3b35',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 4);

    container.add([graphics, label]);
    return container;
  }

  private createRewardIcon(
    x: number,
    y: number,
    day: number,
    rewardCoins: number,
    size: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();
    const coinColor = day % 2 === 0 ? COLORS.yellow : '#ffcf57';

    graphics.fillStyle(colorToNumber('#f0aa30'), 0.38);
    graphics.fillEllipse(0, size * 0.4, size * 1.1, size * 0.22);
    graphics.fillStyle(colorToNumber(coinColor), 1);
    graphics.lineStyle(3, colorToNumber('#d49b23'), 1);
    graphics.fillCircle(0, 0, size * 0.42);
    graphics.strokeCircle(0, 0, size * 0.42);
    graphics.fillStyle(colorToNumber('#fff4b8'), 0.95);
    graphics.fillCircle(-size * 0.12, -size * 0.14, size * 0.13);
    container.add(graphics);

    if (size >= 28) {
      const label = this.add
        .text(0, 0, `${Math.min(99, rewardCoins)}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5);
      container.add(label);
    }

    return container;
  }

  private createRareBellIcon(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();
    const half = size * 0.5;

    graphics.fillStyle(colorToNumber('#ffd9f0'), 1);
    graphics.lineStyle(3, colorToNumber('#ff7fbd'), 1);
    graphics.fillRoundedRect(-half, -half * 0.54, size, size * 0.86, 8);
    graphics.strokeRoundedRect(-half, -half * 0.54, size, size * 0.86, 8);
    graphics.lineStyle(3, colorToNumber('#ff7fbd'), 1);
    graphics.lineBetween(0, -half * 0.54, 0, half * 0.32);
    graphics.lineBetween(-half, -half * 0.08, half, -half * 0.08);
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.fillCircle(-half * 0.58, -half * 0.82, size * 0.12);
    graphics.fillCircle(half * 0.58, -half * 0.82, size * 0.12);

    const label = this.add
      .text(0, 1, '?', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(size * 0.55)}px`,
        fontStyle: '900',
        color: '#ff2d8d',
      })
      .setOrigin(0.5);

    container.add([graphics, label]);
    return container;
  }

  private drawSparkleStar(x: number, y: number, radius: number, color: string): void {
    this.createSparkleStar(x, y, radius, color);
  }

  private createSparkleStar(x: number, y: number, radius: number, color: string): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber(color), 1);
    graphics.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const pointRadius = index % 2 === 0 ? radius : radius * 0.42;
      const angle = -Math.PI / 2 + (Math.PI * index) / 5;
      const pointX = Math.cos(angle) * pointRadius;
      const pointY = Math.sin(angle) * pointRadius;
      if (index === 0) {
        graphics.moveTo(pointX, pointY);
      } else {
        graphics.lineTo(pointX, pointY);
      }
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.setPosition(x, y);
    return graphics;
  }

  private drawCharacters(): void {
    APP_LAYOUT.loginBonus.characters.forEach((placement) => {
      createMonsterVisual(
        this,
        getMonsterById(placement.monsterId),
        placement.x,
        placement.y,
        placement.size,
      ).setDepth(8);
    });
  }

  private drawTapHint(label: string): void {
    this.tapHintText = this.add
      .text(GAME_WIDTH / 2, 804, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  private updateTapHint(label: string): void {
    this.tapHintText?.setText(label);
  }

  private playStampPressAnimation(
    stampPosition: { x: number; y: number } | null,
    onComplete: () => void,
  ): void {
    if (!stampPosition) {
      onComplete();
      return;
    }

    const stamp = this.createGetStamp(stampPosition.x, stampPosition.y - 88);
    stamp.setDepth(45);
    stamp.setScale(1.85);
    stamp.setAlpha(0);
    stamp.setAngle(-10);

    this.tweens.add({
      targets: stamp,
      y: stampPosition.y,
      scale: 1.08,
      alpha: 1,
      duration: 360,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.playStampImpact(stampPosition.x, stampPosition.y);
        this.tweens.add({
          targets: stamp,
          scale: 1,
          angle: -4,
          y: stampPosition.y + 1,
          duration: 100,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
          onComplete,
        });
      },
    });
  }

  private playStampImpact(x: number, y: number): void {
    playStampSound();
    const ring = this.add
      .circle(x, y, 38, colorToNumber('#ffffff'), 0)
      .setStrokeStyle(4, colorToNumber('#ff3b35'), 0.82)
      .setDepth(44);
    this.tweens.add({
      targets: ring,
      scale: 1.36,
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private showRewardOverlay(status: DailyLoginBonusStatus): void {
    playRewardPopupSound();
    const overlay = this.add.container(0, 0).setDepth(90);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, colorToNumber('#243044'), 0.38).setOrigin(0);
    const panel = this.add.graphics();
    panel.fillStyle(colorToNumber('#ffffff'), 1);
    panel.lineStyle(5, colorToNumber('#21d5e8'), 1);
    panel.fillRoundedRect(44, 242, 302, 276, 34);
    panel.strokeRoundedRect(44, 242, 302, 276, 34);
    panel.lineStyle(3, colorToNumber('#ff7fbd'), 1);
    panel.strokeRoundedRect(58, 256, 274, 248, 26);

    const title = this.add
      .text(GAME_WIDTH / 2, 286, 'プレゼント GET!', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: '#ff2d8d',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 6);
    const item = status.rewardItemId
      ? this.createRareBellIcon(GAME_WIDTH / 2, 374, 82)
      : this.createRewardIcon(GAME_WIDTH / 2, 374, status.cycleDay, status.rewardCoins, 82);
    const rewardLabel = this.add
      .text(GAME_WIDTH / 2, 454, status.rewardLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: status.rewardItemId ? '19px' : '23px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5);
    const closeHint = this.add
      .text(GAME_WIDTH / 2, 488, 'タップで すすむ', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    overlay.add([shade, panel, title, item, rewardLabel, closeHint]);
    this.addRewardSparkles(overlay, GAME_WIDTH / 2, 374);
    overlay.setAlpha(0);
    item.setScale(0.42);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 240,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: item,
      scale: 1,
      duration: 420,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: closeHint,
      alpha: 0.35,
      yoyo: true,
      repeat: -1,
      duration: 680,
      ease: 'Sine.easeInOut',
    });

    const closeOverlay = (): void => {
      if (!this.canContinue) {
        return;
      }

      this.canContinue = false;
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 170,
        ease: 'Sine.easeIn',
        onComplete: () => {
          overlay.destroy(true);
          this.updateTapHint('どこでもタッチで すすむ');
          this.enableTapToHome();
        },
      });
    };

    this.time.delayedCall(320, () => {
      this.canContinue = true;
      this.input.once('pointerdown', closeOverlay);
      this.input.keyboard?.once('keydown-ENTER', closeOverlay);
      this.input.keyboard?.once('keydown-SPACE', closeOverlay);
    });
  }

  private addRewardSparkles(overlay: Phaser.GameObjects.Container, centerX: number, centerY: number): void {
    const sparkleColors = ['#ffd766', '#ff7fbd', '#21d5e8', '#ffffff'];
    for (let index = 0; index < 12; index += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 12;
      const radius = index % 2 === 0 ? 78 : 58;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const sparkle = this.createSparkleStar(x, y, index % 2 === 0 ? 12 : 8, sparkleColors[index % sparkleColors.length]);
      sparkle.setAlpha(0.18);
      sparkle.setScale(0.58);
      overlay.add(sparkle);
      this.tweens.add({
        targets: sparkle,
        alpha: 1,
        scale: 1.2,
        angle: 18,
        yoyo: true,
        repeat: -1,
        duration: 560 + index * 18,
        delay: index * 68,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private enableTapToHome(): void {
    this.canContinue = true;
    this.input.once('pointerdown', () => this.goHome());
    this.input.keyboard?.once('keydown-ENTER', () => this.goHome());
    this.input.keyboard?.once('keydown-SPACE', () => this.goHome());
  }

  private goHome(): void {
    if (!this.canContinue) {
      return;
    }

    this.scene.start(SceneKeys.MainMenu);
  }
}
