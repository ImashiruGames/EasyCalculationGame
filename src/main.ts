import * as Phaser from 'phaser';
import { isDebugModeEnabled, setStoredDebugModeEnabled } from './data/debugMode';
import { cancelImageAssetWarmup } from './game/assets/assetWarmup';
import { disposeAudio } from './game/bgm';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { AchievementsScene } from './game/scenes/achievements/AchievementsScene';
import { BattleGameScene } from './game/scenes/battle/BattleGameScene';
import { BattleSelectScene } from './game/scenes/battle/BattleSelectScene';
import { CaptureGameScene } from './game/scenes/capture/CaptureGameScene';
import { DailyMissionsScene } from './game/scenes/dailyMissions/DailyMissionsScene';
import { ResultScene } from './game/scenes/capture/ResultScene';
import { StageIntroScene } from './game/scenes/capture/StageIntroScene';
import { StageSelectScene } from './game/scenes/capture/StageSelectScene';
import { EvolutionScene } from './game/scenes/evolution/EvolutionScene';
import { LoadingScene } from './game/scenes/loading/LoadingScene';
import { LoginBonusScene } from './game/scenes/login/LoginBonusScene';
import { DebugBgmScene } from './game/scenes/menu/DebugBgmScene';
import { GridProblemEditorScene } from './game/scenes/menu/GridProblemEditorScene';
import { MainMenuScene } from './game/scenes/menu/MainMenuScene';
import { BattlePreviewScene, DexPreviewScene, ShopPreviewScene } from './game/scenes/previews/DexPreviewScenes';
import { StoryCreatorScene } from './game/scenes/story/StoryCreatorScene';
import { StoryListScene } from './game/scenes/story/StoryListScene';
import { StoryPreviewScene } from './game/scenes/story/StoryPreviewScene.ts';
import { StoryScene } from './game/scenes/story/StoryScene';
import { TitleEditScene } from './game/scenes/title/TitleEditScene';
import { TitleNoticeScene } from './game/scenes/title/TitleNoticeScene';
import { TitleScene } from './game/scenes/title/TitleScene';
import { TransferScene } from './game/scenes/transfer/TransferScene';

type DebugCorner = 'left' | 'right';

const DEBUG_CORNER_SIZE = 30;
const DEBUG_CORNER_SEQUENCE: DebugCorner[] = ['left', 'right', 'left', 'right', 'left', 'right'];
const DEBUG_GESTURE_TIMEOUT_MS = 3000;

// Registers the PWA service worker when the browser supports it.
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error: unknown) => {
      console.warn('Service worker registration failed.', error);
    });
  });
}

registerServiceWorker();

/** Returns the hidden top corner tapped by a pointer event. */
function getDebugCornerFromPointer(game: Phaser.Game, event: PointerEvent): DebugCorner | null {
  const rect = game.canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = ((event.clientX - rect.left) / rect.width) * GAME_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT;
  if (x < 0 || x > GAME_WIDTH || y < 0 || y > DEBUG_CORNER_SIZE) {
    return null;
  }

  if (x <= DEBUG_CORNER_SIZE) {
    return 'left';
  }
  if (x >= GAME_WIDTH - DEBUG_CORNER_SIZE) {
    return 'right';
  }

  return null;
}

/** Saves the toggled debug state and reloads data-backed scenes. */
function toggleHiddenDebugMode(): void {
  const nextEnabled = !isDebugModeEnabled();
  setStoredDebugModeEnabled(nextEnabled);

  const nextUrl = new URL(window.location.href);
  if (!nextEnabled) {
    nextUrl.searchParams.delete('debug');
  }

  if (nextUrl.href !== window.location.href) {
    window.location.replace(nextUrl.href);
    return;
  }

  window.location.reload();
}

/** Installs the hidden corner sequence that toggles debug mode. */
function installDebugCornerGesture(game: Phaser.Game): void {
  let sequenceIndex = 0;
  let previousTapAt = 0;

  /** Tracks the corner sequence for this game canvas. */
  const handlePointerDown = (event: PointerEvent): void => {
    const corner = getDebugCornerFromPointer(game, event);
    const now = Date.now();
    if (!corner) {
      sequenceIndex = 0;
      previousTapAt = 0;
      return;
    }

    if (now - previousTapAt > DEBUG_GESTURE_TIMEOUT_MS) {
      sequenceIndex = corner === DEBUG_CORNER_SEQUENCE[0] ? 1 : 0;
      previousTapAt = now;
      return;
    }

    if (corner === DEBUG_CORNER_SEQUENCE[sequenceIndex]) {
      sequenceIndex += 1;
    } else {
      sequenceIndex = corner === DEBUG_CORNER_SEQUENCE[0] ? 1 : 0;
    }
    previousTapAt = now;

    if (sequenceIndex < DEBUG_CORNER_SEQUENCE.length) {
      return;
    }

    sequenceIndex = 0;
    previousTapAt = 0;
    toggleHiddenDebugMode();
  };
  game.canvas.addEventListener('pointerdown', handlePointerDown, { passive: true });
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    game.canvas.removeEventListener('pointerdown', handlePointerDown);
  });
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#fffaf0',
  fps: {
    target: 30,
    limit: 30,
    min: 15,
  },
  render: {
    powerPreference: 'low-power',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [
    TitleScene,
    TitleNoticeScene,
    LoadingScene,
    TitleEditScene,
    LoginBonusScene,
    MainMenuScene,
    DebugBgmScene,
    GridProblemEditorScene,
    StoryListScene,
    StoryCreatorScene,
    StoryPreviewScene,
    StoryScene,
    TransferScene,
    DailyMissionsScene,
    StageSelectScene,
    StageIntroScene,
    CaptureGameScene,
    ResultScene,
    EvolutionScene,
    BattlePreviewScene,
    BattleSelectScene,
    BattleGameScene,
    DexPreviewScene,
    ShopPreviewScene,
    AchievementsScene,
  ],
});

installDebugCornerGesture(game);
game.events.once(Phaser.Core.Events.DESTROY, () => {
  cancelImageAssetWarmup();
  disposeAudio();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
