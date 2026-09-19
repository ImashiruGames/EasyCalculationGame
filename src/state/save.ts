// Public entry point; feature modules own the implementation.
export {
  TITLE_MONSTER_DEFAULT_SIZE,
  TITLE_MONSTER_MAX_SIZE,
  TITLE_MONSTER_MIN_SIZE,
  TITLE_MONSTER_PLACEMENT_BOUNDS,
  TITLE_MONSTER_SLOT_COUNT,
} from '../game/layoutConfig';
export {
  COINS_PER_CANDY,
  DAILY_LOGIN_COIN_REWARDS,
  FRAGMENTS_PER_CANDY,
  STAGE_PLAY_LIMIT,
  STAGE_PLAY_WINDOW_MS,
} from './save/constants';
export {
  claimDailyLoginBonus,
  claimDailyMissionAllClearReward,
  claimDailyMissionReward,
  getDailyLoginBonusStatus,
  getDailyMissionBoardStatus,
  getSuggestedDailyMissionStatus,
  type DailyLoginBonusClaimResult,
  type DailyLoginBonusStatus,
  type DailyMissionBoardStatus,
  type DailyMissionClaimResult,
  type DailyMissionStatus,
} from './save/dailyRewards';
export {
  debugSetCoinsToLargeAmount,
  debugUnlockAllMonsters,
  debugUnlockAllStages,
} from './save/debugActions';
export {
  buyShopItem,
  buyTitleBackground,
  canExchangeFragmentsForCandy,
  canUnlockDexStory,
  canUnlockDexStoryWithCandy,
  consumeShopItem,
  evolveMonster,
  exchangeCandyForCoins,
  exchangeFragmentsForCandy,
  getDexStoryUnlockCandyShortfall,
  isDexStoryUnlocked,
  saveTitleMonsterPlacements,
  selectTitleBackground,
  unlockDexStory,
} from './save/inventoryActions';
export {
  getStagePlayLimitStatus,
  isStagePlayLimitDisabled,
  recordStagePlayEntry,
  recordStagePlayEntryUsingItem,
  type StagePlayLimitStatus,
} from './save/playEntries';
export {
  acknowledgeAchievementRankIndex,
  addBattleBonusReward,
  addBattleReward,
  addCapture,
  createTransferCode,
  hasReadStageIntroStory,
  importTransferCode,
  recordBestStreakWins,
  recordEncounterMonster,
  recordStageAverageAnswerTime,
  recordStageIntroStoryRead,
  setPracticeLevelId,
} from './save/progressActions';
export {
  getBattleWinCount,
  getBestStreakWins,
  getCandyCount,
  getCoinCount,
  getItemCount,
  getMonsterCaptureCount,
  getMonsterFragmentCount,
  getOwnedTitleBackgroundIds,
  getSelectedTitleBackground,
  getStageCaptureCount,
  getStageMonsterCaptureCount,
  getStageSpeedStarTargetMs,
  getStageStarRank,
  getTitleMonsterIds,
  getTitleMonsterPlacements,
  getTotalCaptureCount,
  getUniqueCaptureCount,
  hasStageSpeedStar,
  isTitleBackgroundOwned,
} from './save/selectors';
export { loadSaveState, saveState } from './save/storage';
export { TRANSFER_CODE_PREFIX, getTransferSummary } from './save/transfer';
export type { TransferImportResult, TransferSummary } from './save/transfer';
