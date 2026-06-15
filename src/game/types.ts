export type StageId = string;
export type StageAvailability = 'available' | 'locked' | 'comingSoon';
export type PracticeLevelId =
  | 'all'
  | 'grade1'
  | 'grade2'
  | 'grade3'
  | 'grade4'
  | 'grade5'
  | 'grade6'
  | 'junior'
  | 'junior1'
  | 'junior2'
  | 'junior3';
export type ProblemRule =
  | 'plusOne'
  | 'plusTwo'
  | 'plusThree'
  | 'noCarryAdd'
  | 'makeTen'
  | 'noBorrowSubtract'
  | 'multiplication'
  | 'twoDigitMinusOneDigit'
  | 'makeTenMissingResult';
export type ProblemAnswerSlot =
  | 'left'
  | 'right'
  | 'result'
  | 'leftDenominator'
  | 'rightDenominator'
  | 'resultDenominator';
export type ProblemAnswerMode =
  | 'single'
  | 'quotientRemainder'
  | 'clockHourMinute'
  | 'squareRootPair'
  | 'squareRootSimplify'
  | 'squareRootExpression'
  | 'squareRootFraction'
  | 'squareRootRationalize'
  | 'choiceGrid'
  | 'choiceRow'
  | 'choiceColumn'
  | 'multiSelect';
export type ProblemExpressionKind =
  | 'integer'
  | 'integerDivision'
  | 'squareRoot'
  | 'clockTime'
  | 'clockMinuteConversion'
  | 'decimal'
  | 'shapeArea'
  | 'verticalArithmetic'
  | 'missingDigitArithmetic'
  | 'equivalentFraction'
  | 'sameDenominatorFraction'
  | 'differentDenominatorFraction'
  | 'fractionProductQuotient';
export type ProblemOperator = '+' | '-' | '×' | '÷' | '=';
export type ProblemHiddenDigitSlot =
  | 'leftTens'
  | 'leftOnes'
  | 'rightTens'
  | 'rightOnes'
  | 'resultTens'
  | 'resultOnes';
export type ProblemOperatorInput =
  | ProblemOperator
  | 'plus'
  | 'minus'
  | 'times'
  | 'multiply'
  | '*'
  | 'divide'
  | '/'
  | 'equal'
  | '=';
export type ProblemNumberRange = readonly [number, number] | readonly [] | null;
export type ProblemDigitRule = 'noCarry' | 'carryRequired' | 'noBorrow' | 'borrowRequired';
export type ProblemRemainderRule = 'any' | 'none' | 'required';
export type SquareRootProblemMode =
  | 'principal'
  | 'pair'
  | 'simplify'
  | 'absoluteSquare'
  | 'fraction'
  | 'rationalize'
  | 'decimalValue'
  | 'compare'
  | 'addLike'
  | 'minusLike'
  | 'addSimplifyLike'
  | 'minusSimplifyLike';

export interface SquareRootComparisonTerm {
  kind: 'root' | 'number';
  sign: 1 | -1;
  value: number;
}

export interface ConfigurableProblemRule {
  kind?: ProblemExpressionKind;
  operator: ProblemOperatorInput;
  answerSlot?: ProblemAnswerSlot;
  answerMode?: ProblemAnswerMode;
  left: ProblemNumberRange;
  right: ProblemNumberRange;
  result: ProblemNumberRange;
  remainder?: ProblemNumberRange;
  remainderRule?: ProblemRemainderRule;
  rootMode?: SquareRootProblemMode;
  denominator?: ProblemNumberRange;
  leftDenominator?: ProblemNumberRange;
  rightDenominator?: ProblemNumberRange;
  resultDenominator?: ProblemNumberRange;
  digitRule?: ProblemDigitRule;
  minuteStep?: number;
  leftDecimalPlaces?: number;
  rightDecimalPlaces?: number;
  resultDecimalPlaces?: number;
}

export type ProblemRuleDefinition = ProblemRule | ConfigurableProblemRule | ConfigurableProblemRule[];
type MonsterShape =
  | 'sprout'
  | 'puff'
  | 'rabbit'
  | 'snowball'
  | 'crystal'
  | 'seal'
  | 'ember'
  | 'spark'
  | 'coal';

export interface StageDefinition {
  id: StageId;
  order: number;
  stageCategoryId: string;
  name: string;
  subtitle: string;
  themeLabel: string;
  problemRule: ProblemRuleDefinition;
  monsterIds: StageMonsterDefinition[];
  backgroundPath?: string;
  accentColor: string;
  captureGaugeGain?: number;
  speedStarAverageMs?: number;
  minPracticeLevel?: number;
  maxPracticeLevel?: number;
  unlockConditions?: StageUnlockCondition[];
  comingSoon?: boolean;
  playLimitDisabled?: boolean;
}

export interface StageMonsterEncounter {
  monsterId: string;
  weight: number;
}

export type StageMonsterDefinition = string | StageMonsterEncounter;

export interface StageCategoryDefinition {
  id: string;
  name: string;
  subtitle: string;
  accentColor: string;
  minPracticeLevel?: number;
  maxPracticeLevel?: number;
}

export type StageUnlockCondition =
  | ({
      label?: string;
    } & {
      type: 'stageClearCount';
      stageId: StageId;
      count: number;
    })
  | ({
      label?: string;
    } & {
      type: 'uniqueDexCount';
      count: number;
    })
  | ({
      label?: string;
    } & {
      type: 'monsterCaptured';
      monsterId: string;
    })
  | ({
      label?: string;
    } & {
      type: 'achievementUnlocked';
      achievementId: string;
    })
  | ({
      label?: string;
    } & {
      type: 'itemOwned';
      itemId: string;
      count?: number;
    })
  | ({
      label?: string;
    } & {
      type: 'trainerDefeated';
      trainerId: string;
      count?: number;
    });

export interface TrainerDefinition {
  id: string;
  name: string;
  title: string;
  stageId: StageId;
  difficultyLevel: number;
  hp: number;
  problemRule: ProblemRuleDefinition;
  partnerMonsterId: string;
  partnerMonsterIds?: string[];
  rewardCoins: number;
  rewardCandyAttribute?: string;
  rewardCandyAmount?: number;
  accentColor: string;
  palette: {
    cap: string;
    shirt: string;
    shadow: string;
    background: string;
  };
}

export interface BossBattleDefinition {
  id: string;
  name: string;
  title: string;
  categoryId: string;
  pageIndex?: number;
  stageId: StageId;
  sourceStageIds: StageId[];
  difficultyLevel: number;
  hp: number;
  problemRule: ProblemRuleDefinition;
  problemRules: ProblemRuleDefinition[];
  problemCount: number;
  bossMonsterId: string;
  bossMonsterIds?: string[];
  rewardCoins: number;
  rewardCandyAttribute?: string;
  rewardCandyAmount?: number;
  accentColor: string;
  palette: {
    background: string;
  };
}

export interface MonsterDefinition {
  id: string;
  name: string;
  elementName: string;
  attribute: string;
  dexDescription: string;
  experienceTable: Array<{
    level: number;
    totalExp: number;
  }>;
  evolutionRequiredFragments: number | null;
  previousEvolutionId: string | null;
  nextEvolutionId: string | null;
  hp: number;
  attack: number;
  moveNames: string[];
  goalGauge: number;
  evolutionFamilyId: string;
  evolutionStage: number;
  maxEvolutionStage: 1 | 2 | 3 | 4;
  isRare: boolean;
  dexStoryEnabled: boolean;
  dexStoryRequiredFragments: number | null;
  shape: MonsterShape;
  imageFileName?: string;
  palette: {
    body: string;
    accent: string;
    shadow: string;
    background: string;
  };
}

export interface MathProblem {
  kind?: ProblemExpressionKind;
  left: number;
  operator: ProblemOperator;
  right: number;
  result: number;
  remainder?: number;
  answer: number;
  answerSlot: ProblemAnswerSlot;
  answerMode?: ProblemAnswerMode;
  denominator?: number;
  leftDenominator?: number;
  rightDenominator?: number;
  resultDenominator?: number;
  rootMode?: SquareRootProblemMode;
  rootLeftRadicand?: number;
  rootRightRadicand?: number;
  rootComparisonTerms?: SquareRootComparisonTerm[];
  hiddenDigitSlot?: ProblemHiddenDigitSlot;
  minuteStep?: number;
  leftDecimalPlaces?: number;
  rightDecimalPlaces?: number;
  resultDecimalPlaces?: number;
}

export interface AppSaveState {
  version: 5;
  practiceLevelId: PracticeLevelId;
  captures: Record<string, number>;
  fragments: Record<string, number>;
  candies: Record<string, number>;
  items: Record<string, number>;
  battleWins: Record<string, number>;
  stageCaptures: Record<string, number>;
  stageMonsterCaptures: Record<string, Record<string, number>>;
  stageSpeedStars: Record<string, boolean>;
  stagePlayLimits: Record<string, StagePlayLimitWindow>;
  dailyLogin: DailyLoginState;
  encounterStreak: EncounterStreakState;
  bestStreakWins: number;
  acknowledgedAchievementRankIndex: number;
  coins: number;
  dailyMissions: DailyMissionState;
  titleMonsterIds: Array<string | null>;
  titleMonsterPlacements: TitleMonsterPlacementState[];
  ownedTitleBackgroundIds: string[];
  selectedTitleBackgroundId: string;
  unlockedDexStoryMonsterIds: string[];
}

export interface TitleMonsterPlacementState {
  monsterId: string;
  x: number;
  y: number;
  size: number;
  angle: number;
}

export interface DailyLoginState {
  lastClaimedDate: string | null;
  streakDays: number;
  totalClaimDays: number;
}

export interface DailyMissionState {
  dateKey: string;
  stageEntries: number;
  captures: number;
  battleWins: number;
  claimedMissionIds: string[];
  allClearClaimed: boolean;
}

export interface StagePlayLimitWindow {
  startedAt: number;
  playCount: number;
}

export interface EncounterStreakState {
  monsterId: string | null;
  count: number;
}

export interface StageSceneData {
  stageId?: StageId;
  skipIntroStory?: boolean;
}

export interface CaptureSceneData {
  stageId?: StageId;
  monsterId?: string;
}

export interface ResultSceneData {
  stageId?: StageId;
  monsterId?: string;
  wasNew?: boolean;
  captureCount?: number;
  averageAnswerMs?: number;
  evolvedFromMonsterId?: string;
  conversionMessage?: string;
}

export interface EvolutionSceneData {
  stageId?: StageId;
  monsterId?: string;
  captureCount?: number;
}

export interface BattleSelectSceneData {
  trainerId?: string;
  bossId?: string;
  bossPageIndex?: number;
  bossSourceStageIds?: StageId[];
  returnStageCategoryId?: string;
  returnStagePageIndex?: number;
  partyMonsterIds?: string[];
  pageIndex?: number;
  partyPageIndex?: number;
  partySort?: BattlePartySort;
  battleMode?: BattleMode;
  openTrainerList?: boolean;
}

export type BattleMode = 'single' | 'streak' | 'boss';
export type BattlePartySort = 'attack' | 'hp' | 'dex';

export interface BattlePartySnapshot {
  monsterId: string;
  hp: number;
  maxHp: number;
}

export interface BattleSceneData {
  trainerId?: string;
  bossId?: string;
  bossPageIndex?: number;
  bossSourceStageIds?: StageId[];
  returnStageCategoryId?: string;
  returnStagePageIndex?: number;
  partyMonsterIds?: string[];
  battleMode?: BattleMode;
  streakTrainerIds?: string[];
  streakIndex?: number;
  partySnapshot?: BattlePartySnapshot[];
}
