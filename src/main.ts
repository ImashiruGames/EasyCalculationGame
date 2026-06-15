import * as Phaser from 'phaser';
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
import { MainMenuScene } from './game/scenes/menu/MainMenuScene';
import { BattlePreviewScene, DexPreviewScene, ShopPreviewScene } from './game/scenes/previews/DexPreviewScenes';
import { StoryCreatorScene } from './game/scenes/story/StoryCreatorScene';
import { StoryListScene } from './game/scenes/story/StoryListScene';
import { StoryPreviewScene } from './game/scenes/story/StoryPreviewScene.ts';
import { StoryScene } from './game/scenes/story/StoryScene';
import { TitleEditScene } from './game/scenes/title/TitleEditScene';
import { TitleScene } from './game/scenes/title/TitleScene';
import { TransferScene } from './game/scenes/transfer/TransferScene';

new Phaser.Game({
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
    LoadingScene,
    TitleEditScene,
    LoginBonusScene,
    MainMenuScene,
    DebugBgmScene,
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
