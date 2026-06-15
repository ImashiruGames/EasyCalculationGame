import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after, beforeEach } from 'node:test';
import ts from 'typescript';
import { createServer } from 'vite';

const STORAGE_KEY = 'one-digit-capture-game-save-v1';

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    clear() {
      values.clear();
    },
  };
}

globalThis.window = {
  localStorage: createMemoryStorage(),
};

const server = await createServer({
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  window.localStorage.clear();
});

const [
  mathProblems,
  speedBonus,
  captureGauge,
  battleRules,
  evolution,
  save,
  progression,
  monstersData,
  stagesData,
  shopItemsData,
  titleBackgroundsData,
  achievementsData,
  layoutConfig,
  textPolicy,
  qrCode,
  mathExpression,
] = await Promise.all([
  server.ssrLoadModule('/src/game/problem/mathProblems.ts'),
  server.ssrLoadModule('/src/game/problem/speedBonus.ts'),
  server.ssrLoadModule('/src/game/captureGauge.ts'),
  server.ssrLoadModule('/src/game/battle/battleRules.ts'),
  server.ssrLoadModule('/src/state/evolution.ts'),
  server.ssrLoadModule('/src/state/save.ts'),
  server.ssrLoadModule('/src/state/progression.ts'),
  server.ssrLoadModule('/src/data/monsters.ts'),
  server.ssrLoadModule('/src/data/stages.ts'),
  server.ssrLoadModule('/src/data/shopItems.ts'),
  server.ssrLoadModule('/src/data/titleBackgrounds.ts'),
  server.ssrLoadModule('/src/data/achievements.ts'),
  server.ssrLoadModule('/src/game/layoutConfig.ts'),
  server.ssrLoadModule('/src/game/textPolicy.ts'),
  server.ssrLoadModule('/src/game/qrCode.ts'),
  server.ssrLoadModule('/src/game/ui/common/mathExpression.ts'),
]);

const {
  createProblem,
  createProblemAvoiding,
  formatProblemAnswer,
  formatProblem,
  getProblemAnswerPairJudgement,
  isProblemAnswerCorrect,
} = mathProblems;
const { getAnswerSpeedBonus } = speedBonus;
const { getCaptureGaugeGain } = captureGauge;
const { calculateBattleDamage, getOpponentMaxHp } = battleRules;
const { getEvolutionProgress } = evolution;
const {
  DAILY_LOGIN_COIN_REWARDS,
  FRAGMENTS_PER_CANDY,
  STAGE_PLAY_LIMIT,
  STAGE_PLAY_WINDOW_MS,
  addBattleReward,
  addCapture,
  buyTitleBackground,
  buyShopItem,
  claimDailyMissionAllClearReward,
  claimDailyMissionReward,
  claimDailyLoginBonus,
  consumeShopItem,
  createTransferCode,
  evolveMonster,
  exchangeCandyForCoins,
  exchangeFragmentsForCandy,
  getCandyCount,
  getDailyMissionBoardStatus,
  getSuggestedDailyMissionStatus,
  getDailyLoginBonusStatus,
  getMonsterFragmentCount,
  getStageMonsterCaptureCount,
  getStagePlayLimitStatus,
  getStageStarRank,
  getTransferSummary,
  hasStageSpeedStar,
  isStagePlayLimitDisabled,
  importTransferCode,
  getSelectedTitleBackground,
  getTitleMonsterIds,
  getTitleMonsterPlacements,
  loadSaveState,
  recordEncounterMonster,
  recordStageAverageAnswerTime,
  recordStagePlayEntry,
  recordStagePlayEntryUsingItem,
  saveState,
  saveTitleMonsterPlacements,
  selectTitleBackground,
  setPracticeLevelId,
} = save;
const { getStageAvailability } = progression;
const { getAdjustedEncounterWeight, getMonsterById, getStageMonsterId, monsters, pickEncounterMonsterId } = monstersData;
const { getStageById, getVisibleStageCategories, getVisibleStagesByCategoryId, stages } = stagesData;
const { SHOP_ITEM_IDS } = shopItemsData;
const { TITLE_BACKGROUND_IDS } = titleBackgroundsData;
const { achievements } = achievementsData;
const { TITLE_MONSTER_MAX_SIZE } = layoutConfig;
const { getDisallowedDisplayKanji } = textPolicy;
const { createQrMatrix } = qrCode;
const { parseStoryMathExpression } = mathExpression;

function getLocalDateKey(now = Date.now()) {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function baseSaveState(overrides = {}) {
  return {
    version: 5,
    practiceLevelId: 'all',
    captures: {},
    fragments: {},
    candies: {},
    items: {},
    battleWins: {},
    stageCaptures: {},
    stageMonsterCaptures: {},
    stageSpeedStars: {},
    stagePlayLimits: {},
    encounterStreak: {
      monsterId: null,
      count: 0,
    },
    dailyLogin: {
      lastClaimedDate: null,
      streakDays: 0,
      totalClaimDays: 0,
      ...(overrides.dailyLogin ?? {}),
    },
    bestStreakWins: 0,
    acknowledgedAchievementRankIndex: 0,
    coins: 0,
    dailyMissions: {
      dateKey: getLocalDateKey(),
      stageEntries: 0,
      captures: 0,
      battleWins: 0,
      claimedMissionIds: [],
      allClearClaimed: false,
      ...(overrides.dailyMissions ?? {}),
    },
    titleMonsterIds: [],
    titleMonsterPlacements: [],
    ownedTitleBackgroundIds: [],
    selectedTitleBackgroundId: TITLE_BACKGROUND_IDS.stageGrasslands,
    ...overrides,
  };
}

function withMockedRandom(values, callback) {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function normalizeRootTerm(coefficient, radicand) {
  let rootCoefficient = 1;
  let rootRadicand = radicand;
  for (let factor = Math.floor(Math.sqrt(radicand)); factor >= 2; factor -= 1) {
    const square = factor * factor;
    if (radicand % square === 0) {
      rootCoefficient = factor;
      rootRadicand = radicand / square;
      break;
    }
  }

  return {
    coefficient: coefficient * rootCoefficient,
    radicand: rootRadicand,
  };
}

function assertEquation(problem) {
  let expectedResult;
  if (problem.kind === 'clockTime') {
    expectedResult = problem.right === 0 ? problem.left : problem.left * 100 + problem.right;
    assert.ok(problem.left >= 1 && problem.left <= 12);
    assert.ok(problem.right >= 0 && problem.right <= 59);
    if (problem.minuteStep) {
      assert.equal(problem.right % problem.minuteStep, 0);
    }
  } else if (problem.kind === 'clockMinuteConversion') {
    expectedResult = problem.left % 60;
    assert.equal(problem.operator, '=');
    assert.ok(problem.left >= 60);
    assert.equal(problem.right, Math.floor(problem.left / 60));
    assert.equal(problem.left, problem.right * 60 + problem.result);
    assert.ok(problem.result >= 0 && problem.result < 60);
    if (problem.answerMode === 'clockHourMinute') {
      assert.equal(problem.remainder, problem.result);
    }
    if (problem.minuteStep) {
      assert.equal(problem.result % problem.minuteStep, 0);
    }
  } else if (problem.kind === 'decimal') {
    const resultPlaces = problem.resultDecimalPlaces ?? 1;
    const scale = 10 ** resultPlaces;
    expectedResult = Math.round((problem.operator === '+'
      ? problem.left + problem.right
      : problem.left - problem.right) * scale) / scale;
  } else if (problem.kind === 'integerDivision') {
    expectedResult = Math.floor(problem.left / problem.right);
    assert.equal(problem.left, problem.right * problem.result + problem.remainder);
    assert.ok(problem.remainder >= 0 && problem.remainder < problem.right);
  } else if (problem.kind === 'squareRoot') {
    expectedResult = problem.result;
    if (problem.answerMode === 'squareRootExpression') {
      const left = normalizeRootTerm(problem.left, problem.rootLeftRadicand);
      const right = normalizeRootTerm(problem.right, problem.rootRightRadicand);
      assert.equal(left.radicand, right.radicand);
      assert.equal(left.radicand, problem.remainder);
      assert.equal(
        problem.operator === '+'
          ? left.coefficient + right.coefficient
          : left.coefficient - right.coefficient,
        problem.result,
      );
    } else {
      assert.equal(problem.left, problem.result * problem.result * problem.remainder);
    }
  } else if (problem.kind === 'equivalentFraction') {
    expectedResult = problem.result;
    assert.equal(problem.left * problem.rightDenominator, problem.right * problem.leftDenominator);
  } else if (problem.kind === 'differentDenominatorFraction') {
    const leftScale = problem.resultDenominator / problem.leftDenominator;
    const rightScale = problem.resultDenominator / problem.rightDenominator;
    expectedResult = problem.operator === '+'
      ? problem.left * leftScale + problem.right * rightScale
      : problem.left * leftScale - problem.right * rightScale;
  } else if (problem.kind === 'fractionProductQuotient') {
    expectedResult = problem.operator === '×'
      ? problem.left * problem.right
      : problem.left * problem.rightDenominator;
  } else {
    expectedResult = problem.operator === '+'
      ? problem.left + problem.right
      : problem.operator === '-'
        ? problem.left - problem.right
        : problem.operator === '×'
          ? problem.left * problem.right
          : problem.left / problem.right;
  }

  if (problem.kind === 'decimal') {
    assert.ok(Math.abs(problem.result - expectedResult) < 1e-9);
  } else {
    assert.equal(problem.result, expectedResult);
  }
  assert.ok(problem.result >= 0, 'result should not be negative');
  if (problem.kind === 'clockTime') {
    assert.ok(problem.answer >= 0 && problem.answer <= 2359, 'clock answer should fit the keypad input range');
  } else {
    assert.ok(problem.answer >= 0 && problem.answer <= 99, 'answer should fit the keypad input range');
  }
  if (problem.kind === 'sameDenominatorFraction') {
    assert.ok(problem.result <= problem.denominator, 'same-denominator fraction result should fit in one whole');
  }
  if (problem.kind === 'differentDenominatorFraction') {
    assert.ok(problem.result <= problem.resultDenominator, 'different-denominator fraction result should fit in one whole');
  }
  if (problem.kind === 'fractionProductQuotient' && problem.operator === '×') {
    assert.equal(problem.resultDenominator, problem.leftDenominator * problem.rightDenominator);
  }
  if (problem.kind === 'fractionProductQuotient' && problem.operator === '÷') {
    assert.equal(problem.resultDenominator, problem.leftDenominator * problem.right);
  }

  const expectedAnswer = problem.answerSlot === 'left'
    ? problem.left
    : problem.answerSlot === 'right'
      ? problem.right
      : problem.answerSlot === 'leftDenominator'
        ? problem.leftDenominator
        : problem.answerSlot === 'rightDenominator'
          ? problem.rightDenominator
          : problem.answerSlot === 'resultDenominator'
            ? problem.resultDenominator
            : problem.result;
  if (problem.kind === 'decimal') {
    assert.ok(Math.abs(problem.answer - expectedAnswer) < 1e-9);
  } else {
    assert.equal(problem.answer, expectedAnswer);
  }
}

function listSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (/\.(?:ts|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectStringLiterals(sourceFile, filePath) {
  const texts = [];

  function visit(node) {
    if (
      ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)
    ) {
      texts.push({
        text: node.text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        isRubySupported: isRubySupportedTextLiteral(filePath, node),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return texts;
}

function isRubySupportedTextLiteral(filePath, node) {
  const relativePath = path.relative(process.cwd(), filePath).replaceAll('\\', '/');
  if (relativePath !== 'src/data/monsterCatalog.js') {
    return false;
  }

  const parent = node.parent;
  return ts.isCallExpression(parent)
    && ts.isIdentifier(parent.expression)
    && parent.expression.text === 'form'
    && parent.arguments[5] === node;
}

// Keeps manually approved existing UI literals out of the second-grade kanji audit.
function isKnownManualKanjiException(filePath, text) {
  const relativePath = path.relative(process.cwd(), filePath).replaceAll('\\', '/');
  return relativePath === 'src/game/scenes/capture/CaptureGameScene.ts'
    && text === '\u306e\u5e73\u65b9\u6839=';
}

test('表示文字: ルビなしUIは小学2年生までの漢字だけを使う', () => {
  const sourceRoot = path.join(process.cwd(), 'src');
  const violations = [];

  for (const filePath of listSourceFiles(sourceRoot)) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const scriptKind = filePath.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
    for (const literal of collectStringLiterals(sourceFile, filePath)) {
      if (literal.isRubySupported) {
        continue;
      }

      if (isKnownManualKanjiException(filePath, literal.text)) {
        continue;
      }

      const disallowedKanji = getDisallowedDisplayKanji(literal.text);
      if (disallowedKanji.length > 0) {
        violations.push({
          file: path.relative(process.cwd(), filePath).replaceAll('\\', '/'),
          line: literal.line,
          text: literal.text,
          disallowedKanji,
        });
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('問題生成: 既存ルールは演算結果と回答欄の整合性を保つ', () => {
  const legacyRules = [
    'plusOne',
    'plusTwo',
    'plusThree',
    'noCarryAdd',
    'makeTen',
    'noBorrowSubtract',
    'multiplication',
    'twoDigitMinusOneDigit',
    'makeTenMissingResult',
  ];

  for (const rule of legacyRules) {
    for (let index = 0; index < 8; index += 1) {
      assertEquation(createProblem(rule));
    }
  }
});

const pairwiseProblemCases = [
  {
    name: 'result slot plus zero boundary',
    randomValues: [0, 0],
    rule: { operator: 'plus', left: [0, 0], right: [0, 0], result: [0, 0] },
    expected: { left: 0, operator: '+', right: 0, result: 0, answerSlot: 'result', answer: 0 },
  },
  {
    name: 'left blank make-ten first candidate',
    randomValues: [0, 0],
    rule: { operator: 'plus', left: [], right: [1, 9], result: [10, 10] },
    expected: { left: 1, operator: '+', right: 9, result: 10, answerSlot: 'left', answer: 1 },
  },
  {
    name: 'right blank make-four',
    randomValues: [0, 0],
    rule: { operator: 'plus', left: [2, 2], right: [], result: [4, 4] },
    expected: { left: 2, operator: '+', right: 2, result: 4, answerSlot: 'right', answer: 2 },
  },
  {
    name: 'multiply alias and upper single-digit operand',
    randomValues: [0, 0],
    rule: { operator: '*', left: [9, 9], right: [9, 9], result: [0, 99] },
    expected: { left: 9, operator: '×', right: 9, result: 81, answerSlot: 'result', answer: 81 },
  },
  {
    name: 'integer division no remainder',
    randomValues: [0],
    rule: {
      kind: 'integerDivision',
      operator: 'divide',
      left: [12, 12],
      right: [3, 3],
      result: [1, 9],
      remainder: [0, 0],
      remainderRule: 'none',
    },
    expected: {
      kind: 'integerDivision',
      left: 12,
      operator: '÷',
      right: 3,
      result: 4,
      remainder: 0,
      answerSlot: 'result',
      answer: 4,
    },
  },
  {
    name: 'integer division remainder required',
    randomValues: [0],
    rule: {
      kind: 'integerDivision',
      operator: 'divide',
      left: [14, 14],
      right: [3, 3],
      result: [1, 9],
      remainder: [1, 8],
      remainderRule: 'required',
    },
    expected: {
      kind: 'integerDivision',
      left: 14,
      operator: '÷',
      right: 3,
      result: 4,
      remainder: 2,
      answerSlot: 'result',
      answerMode: 'quotientRemainder',
      answer: 4,
    },
  },
  {
    name: 'square root pair',
    randomValues: [0],
    rule: {
      kind: 'squareRoot',
      operator: 'equal',
      left: [16, 16],
      result: [1, 12],
      rootMode: 'pair',
    },
    expected: {
      kind: 'squareRoot',
      left: 16,
      operator: '=',
      right: 1,
      result: 4,
      remainder: 1,
      answerSlot: 'result',
      rootMode: 'pair',
      answerMode: 'squareRootPair',
      answer: 4,
    },
  },
  {
    name: 'principal square root',
    randomValues: [0],
    rule: {
      kind: 'squareRoot',
      operator: 'equal',
      left: [16, 16],
      result: [1, 12],
      rootMode: 'principal',
    },
    expected: {
      kind: 'squareRoot',
      left: 16,
      operator: '=',
      right: 1,
      result: 4,
      remainder: 1,
      answerSlot: 'result',
      rootMode: 'principal',
      answer: 4,
    },
  },
  {
    name: 'simplified square root',
    randomValues: [0],
    rule: {
      kind: 'squareRoot',
      operator: 'equal',
      left: [32, 32],
      result: [1, 12],
      remainder: [2, 99],
      rootMode: 'simplify',
    },
    expected: {
      kind: 'squareRoot',
      left: 32,
      operator: '=',
      right: 2,
      result: 4,
      remainder: 2,
      answerSlot: 'result',
      rootMode: 'simplify',
      answerMode: 'squareRootSimplify',
      answer: 4,
    },
  },
  {
    name: 'square root add like terms',
    randomValues: [0],
    rule: {
      kind: 'squareRoot',
      operator: 'plus',
      left: [3, 3],
      right: [4, 4],
      result: [7, 7],
      remainder: [2, 2],
      leftDenominator: [2, 2],
      rightDenominator: [2, 2],
      rootMode: 'addLike',
    },
    expected: {
      kind: 'squareRoot',
      left: 3,
      operator: '+',
      right: 4,
      result: 7,
      remainder: 2,
      answerSlot: 'result',
      rootMode: 'addLike',
      answerMode: 'squareRootExpression',
      rootLeftRadicand: 2,
      rootRightRadicand: 2,
      answer: 7,
    },
  },
  {
    name: 'square root add after simplify',
    randomValues: [0],
    rule: {
      kind: 'squareRoot',
      operator: 'plus',
      left: [1, 1],
      right: [2, 2],
      result: [5, 5],
      remainder: [2, 2],
      leftDenominator: [18, 18],
      rightDenominator: [2, 2],
      rootMode: 'addSimplifyLike',
    },
    expected: {
      kind: 'squareRoot',
      left: 1,
      operator: '+',
      right: 2,
      result: 5,
      remainder: 2,
      answerSlot: 'result',
      rootMode: 'addSimplifyLike',
      answerMode: 'squareRootExpression',
      rootLeftRadicand: 18,
      rootRightRadicand: 2,
      answer: 5,
    },
  },
  {
    name: 'clock time exact hour',
    randomValues: [0, 0],
    rule: { kind: 'clockTime', operator: 'equal', answerSlot: 'left', left: [3, 3], right: [0, 0], result: [1, 12], minuteStep: 60 },
    expected: {
      kind: 'clockTime',
      left: 3,
      operator: '=',
      right: 0,
      result: 3,
      answerSlot: 'left',
      minuteStep: 60,
      answer: 3,
    },
  },
  {
    name: 'clock time minute step',
    randomValues: [0, 0],
    rule: { kind: 'clockTime', operator: 'equal', answerSlot: 'right', left: [2, 2], right: [1, 59], result: [0, 2359], minuteStep: 15 },
    expected: {
      kind: 'clockTime',
      left: 2,
      operator: '=',
      right: 15,
      result: 215,
      answerSlot: 'right',
      minuteStep: 15,
      answer: 15,
    },
  },
  {
    name: 'clock time early one-minute',
    randomValues: [0, 0],
    rule: { kind: 'clockTime', operator: 'equal', answerSlot: 'right', left: [1, 1], right: [3, 3], result: [0, 2359], minuteStep: 1 },
    expected: {
      kind: 'clockTime',
      left: 1,
      operator: '=',
      right: 3,
      result: 103,
      answerSlot: 'right',
      minuteStep: 1,
      answer: 3,
    },
  },
  {
    name: 'clock time far one-minute',
    randomValues: [0, 0],
    rule: { kind: 'clockTime', operator: 'equal', answerSlot: 'left', left: [12, 12], right: [39, 39], result: [0, 2359], minuteStep: 1 },
    expected: {
      kind: 'clockTime',
      left: 12,
      operator: '=',
      right: 39,
      result: 1239,
      answerSlot: 'left',
      minuteStep: 1,
      answer: 12,
    },
  },
  {
    name: 'clock minute conversion',
    randomValues: [0],
    rule: {
      kind: 'clockMinuteConversion',
      operator: 'equal',
      answerSlot: 'result',
      left: [80, 80],
      right: [1, 1],
      result: [0, 59],
      minuteStep: 10,
    },
    expected: {
      kind: 'clockMinuteConversion',
      left: 80,
      operator: '=',
      right: 1,
      result: 20,
      answerSlot: 'result',
      minuteStep: 10,
      answer: 20,
    },
  },
  {
    name: 'clock minute conversion pair',
    randomValues: [0],
    rule: {
      kind: 'clockMinuteConversion',
      operator: 'equal',
      answerSlot: 'result',
      answerMode: 'clockHourMinute',
      left: [80, 80],
      right: [1, 1],
      result: [0, 59],
      minuteStep: 10,
    },
    expected: {
      kind: 'clockMinuteConversion',
      left: 80,
      operator: '=',
      right: 1,
      result: 20,
      remainder: 20,
      answerSlot: 'result',
      answerMode: 'clockHourMinute',
      minuteStep: 10,
      answer: 20,
    },
  },
  {
    name: 'decimal mixed places plus',
    randomValues: [0, 0, 0],
    rule: {
      kind: 'decimal',
      operator: 'plus',
      left: [1.2, 1.2],
      right: [0.34, 0.34],
      result: [0, 2],
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
    },
    expected: {
      kind: 'decimal',
      left: 1.2,
      operator: '+',
      right: 0.34,
      result: 1.54,
      answerSlot: 'result',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
      answer: 1.54,
    },
  },
  {
    name: 'decimal mixed places minus',
    randomValues: [0, 0, 0],
    rule: {
      kind: 'decimal',
      operator: 'minus',
      left: [1.2, 1.2],
      right: [0.34, 0.34],
      result: [0, 2],
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
    },
    expected: {
      kind: 'decimal',
      left: 1.2,
      operator: '-',
      right: 0.34,
      result: 0.86,
      answerSlot: 'result',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
      answer: 0.86,
    },
  },
  {
    name: 'decimal noCarry digit rule',
    randomValues: [0, 0, 0],
    rule: {
      kind: 'decimal',
      operator: 'plus',
      left: [1.2, 1.2],
      right: [0.3, 0.3],
      result: [0, 2],
      digitRule: 'noCarry',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 1,
      resultDecimalPlaces: 1,
    },
    expected: {
      kind: 'decimal',
      left: 1.2,
      operator: '+',
      right: 0.3,
      result: 1.5,
      answerSlot: 'result',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 1,
      resultDecimalPlaces: 1,
      answer: 1.5,
    },
  },
  {
    name: 'decimal mixed places carryRequired digit rule',
    randomValues: [0, 0, 0],
    rule: {
      kind: 'decimal',
      operator: 'plus',
      left: [1.9, 1.9],
      right: [0.12, 0.12],
      result: [0, 3],
      digitRule: 'carryRequired',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
    },
    expected: {
      kind: 'decimal',
      left: 1.9,
      operator: '+',
      right: 0.12,
      result: 2.02,
      answerSlot: 'result',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
      answer: 2.02,
    },
  },
  {
    name: 'same denominator fraction result numerator',
    randomValues: [0, 0],
    rule: {
      kind: 'sameDenominatorFraction',
      operator: 'plus',
      denominator: [4, 4],
      left: [1, 1],
      right: [2, 2],
      result: [],
    },
    expected: {
      kind: 'sameDenominatorFraction',
      left: 1,
      operator: '+',
      right: 2,
      result: 3,
      answerSlot: 'result',
      denominator: 4,
      answer: 3,
    },
  },
  {
    name: 'same denominator fraction minus numerator',
    randomValues: [0, 0],
    rule: {
      kind: 'sameDenominatorFraction',
      operator: 'minus',
      denominator: [5, 5],
      left: [4, 4],
      right: [1, 1],
      result: [],
    },
    expected: {
      kind: 'sameDenominatorFraction',
      left: 4,
      operator: '-',
      right: 1,
      result: 3,
      answerSlot: 'result',
      denominator: 5,
      answer: 3,
    },
  },
  {
    name: 'equivalent fraction missing denominator',
    randomValues: [0, 0],
    rule: {
      kind: 'equivalentFraction',
      operator: 'equal',
      left: [2, 2],
      leftDenominator: [4, 4],
      right: [1, 1],
      rightDenominator: [],
      result: [0, 0],
    },
    expected: {
      kind: 'equivalentFraction',
      left: 2,
      operator: '=',
      right: 1,
      result: 0,
      answerSlot: 'rightDenominator',
      leftDenominator: 4,
      rightDenominator: 2,
      answer: 2,
    },
  },
  {
    name: 'equivalent fraction missing numerator',
    randomValues: [0, 0],
    rule: {
      kind: 'equivalentFraction',
      operator: 'equal',
      left: [1, 1],
      leftDenominator: [2, 2],
      right: [],
      rightDenominator: [4, 4],
      result: [0, 0],
    },
    expected: {
      kind: 'equivalentFraction',
      left: 1,
      operator: '=',
      right: 2,
      result: 0,
      answerSlot: 'right',
      leftDenominator: 2,
      rightDenominator: 4,
      answer: 2,
    },
  },
  {
    name: 'different denominator fraction plus uses common denominator',
    randomValues: [0, 0],
    rule: {
      kind: 'differentDenominatorFraction',
      operator: 'plus',
      leftDenominator: [2, 2],
      rightDenominator: [3, 3],
      left: [1, 1],
      right: [1, 1],
      result: [],
    },
    expected: {
      kind: 'differentDenominatorFraction',
      left: 1,
      operator: '+',
      right: 1,
      result: 5,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 6,
      answer: 5,
    },
  },
  {
    name: 'different denominator fraction minus uses common denominator',
    randomValues: [0, 0],
    rule: {
      kind: 'differentDenominatorFraction',
      operator: 'minus',
      leftDenominator: [2, 2],
      rightDenominator: [3, 3],
      left: [1, 1],
      right: [1, 1],
      result: [],
    },
    expected: {
      kind: 'differentDenominatorFraction',
      left: 1,
      operator: '-',
      right: 1,
      result: 1,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 6,
      answer: 1,
    },
  },
  {
    name: 'fraction multiplication multiplies numerators and denominators',
    randomValues: [0, 0],
    rule: {
      kind: 'fractionProductQuotient',
      operator: 'times',
      leftDenominator: [2, 2],
      rightDenominator: [3, 3],
      left: [1, 1],
      right: [2, 2],
      result: [],
    },
    expected: {
      kind: 'fractionProductQuotient',
      left: 1,
      operator: '×',
      right: 2,
      result: 2,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 6,
      answer: 2,
    },
  },
  {
    name: 'fraction division flips the right fraction',
    randomValues: [0, 0],
    rule: {
      kind: 'fractionProductQuotient',
      operator: 'divide',
      leftDenominator: [2, 2],
      rightDenominator: [3, 3],
      left: [1, 1],
      right: [1, 1],
      result: [],
    },
    expected: {
      kind: 'fractionProductQuotient',
      left: 1,
      operator: '÷',
      right: 1,
      result: 3,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 2,
      answer: 3,
    },
  },
  {
    name: 'reversed range is normalized',
    randomValues: [0, 0],
    rule: { operator: 'plus', left: [5, 3], right: [2, 2], result: [0, 99] },
    expected: { left: 3, operator: '+', right: 2, result: 5, answerSlot: 'result', answer: 5 },
  },
  {
    name: 'plus noCarry digit rule',
    randomValues: [0, 0],
    rule: { operator: 'plus', left: [10, 12], right: [1, 9], result: [0, 99], digitRule: 'noCarry' },
    expected: { left: 10, operator: '+', right: 1, result: 11, answerSlot: 'result', answer: 11 },
  },
  {
    name: 'plus carryRequired digit rule',
    randomValues: [0, 0],
    rule: { operator: 'plus', left: [10, 12], right: [1, 9], result: [0, 99], digitRule: 'carryRequired' },
    expected: { left: 11, operator: '+', right: 9, result: 20, answerSlot: 'result', answer: 20 },
  },
  {
    name: 'minus noBorrow digit rule',
    randomValues: [0, 0],
    rule: { operator: 'minus', left: [10, 12], right: [1, 9], result: [0, 99], digitRule: 'noBorrow' },
    expected: { left: 11, operator: '-', right: 1, result: 10, answerSlot: 'result', answer: 10 },
  },
  {
    name: 'minus borrowRequired digit rule',
    randomValues: [0, 0],
    rule: { operator: 'minus', left: [10, 12], right: [1, 9], result: [0, 99], digitRule: 'borrowRequired' },
    expected: { left: 10, operator: '-', right: 1, result: 9, answerSlot: 'result', answer: 9 },
  },
];

for (const problemCase of pairwiseProblemCases) {
  test(`問題生成: ${problemCase.name}`, () => {
    const problem = withMockedRandom(problemCase.randomValues, () => createProblem(problemCase.rule));
    assert.deepEqual(problem, problemCase.expected);
    assertEquation(problem);
  });
}

test('問題生成: 禁則の複数空欄は候補なしとしてフォールバックする', () => {
  const problem = withMockedRandom(
    Array.from({ length: 13 }, () => 0),
    () => createProblem({ operator: 'plus', left: [], right: [], result: [10, 10] }),
  );

  assert.deepEqual(problem, {
    left: 1,
    operator: '+',
    right: 0,
    result: 1,
    answer: 1,
    answerSlot: 'result',
  });
});

test('問題生成: 直前と同じ問題を避けられる候補がある場合は差し替える', () => {
  const previousProblem = {
    left: 1,
    operator: '+',
    right: 0,
    result: 1,
    answer: 1,
    answerSlot: 'result',
  };
  const problem = withMockedRandom(
    [0, 0, 0, 0.9],
    () => createProblemAvoiding('plusOne', previousProblem),
  );

  assert.notDeepEqual(problem, previousProblem);
  assertEquation(problem);
});

test('問題表示: 回答欄だけを空欄として表示する', () => {
  assert.equal(formatProblem({ left: 1, operator: '+', right: 2, result: 3, answer: 3, answerSlot: 'result' }), '1 + 2 = □');
  assert.equal(formatProblem({ left: 1, operator: '+', right: 2, result: 3, answer: 1, answerSlot: 'left' }), '□ + 2 = 3');
  assert.equal(formatProblem({ left: 1, operator: '+', right: 2, result: 3, answer: 2, answerSlot: 'right' }), '1 + □ = 3');
  assert.equal(
    formatProblem({
      kind: 'clockTime',
      left: 3,
      operator: '=',
      right: 0,
      result: 3,
      answer: 3,
      answerSlot: 'left',
    }),
    '時計 □時',
  );
  assert.equal(
    formatProblem({
      kind: 'clockTime',
      left: 2,
      operator: '=',
      right: 15,
      result: 215,
      answer: 15,
      answerSlot: 'right',
    }),
    '時計 2時□分',
  );
  assert.equal(
    formatProblem({
      kind: 'clockTime',
      left: 12,
      operator: '=',
      right: 39,
      result: 1239,
      answer: 12,
      answerSlot: 'left',
    }),
    '時計 □時39分',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'clockTime',
      left: 2,
      operator: '=',
      right: 15,
      result: 215,
      answer: 215,
      answerSlot: 'result',
    }),
    '2時15分',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'clockTime',
      left: 1,
      operator: '=',
      right: 3,
      result: 103,
      answer: 103,
      answerSlot: 'result',
      minuteStep: 1,
    }),
    '1時3分',
  );
  assert.equal(
    formatProblem({
      kind: 'clockMinuteConversion',
      left: 80,
      operator: '=',
      right: 1,
      result: 20,
      answer: 20,
      answerSlot: 'result',
      minuteStep: 10,
    }),
    '80分 = 1時間□分',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'clockMinuteConversion',
      left: 80,
      operator: '=',
      right: 1,
      result: 20,
      answer: 20,
      answerSlot: 'result',
      minuteStep: 10,
    }),
    '20分',
  );
  assert.equal(
    formatProblem({
      kind: 'clockMinuteConversion',
      left: 80,
      operator: '=',
      right: 1,
      result: 20,
      remainder: 20,
      answer: 20,
      answerSlot: 'result',
      answerMode: 'clockHourMinute',
      minuteStep: 10,
    }),
    '80分 = □時間□分',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'clockMinuteConversion',
      left: 80,
      operator: '=',
      right: 1,
      result: 20,
      remainder: 20,
      answer: 20,
      answerSlot: 'result',
      answerMode: 'clockHourMinute',
      minuteStep: 10,
    }),
    '1時間20分',
  );
  assert.equal(
    formatProblem({
      kind: 'decimal',
      left: 1.2,
      operator: '+',
      right: 0.34,
      result: 1.54,
      answer: 1.54,
      answerSlot: 'result',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
    }),
    '1.2 + 0.34 = □',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'decimal',
      left: 1.2,
      operator: '-',
      right: 0.34,
      result: 0.86,
      answer: 0.86,
      answerSlot: 'result',
      leftDecimalPlaces: 1,
      rightDecimalPlaces: 2,
      resultDecimalPlaces: 2,
    }),
    '0.86',
  );
  assert.equal(
    formatProblem({
      kind: 'integerDivision',
      left: 14,
      operator: '÷',
      right: 3,
      result: 4,
      remainder: 2,
      answer: 4,
      answerSlot: 'result',
      answerMode: 'quotientRemainder',
    }),
    '14 ÷ 3 = □ あまり □',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'integerDivision',
      left: 14,
      operator: '÷',
      right: 3,
      result: 4,
      remainder: 2,
      answer: 4,
      answerSlot: 'result',
      answerMode: 'quotientRemainder',
    }),
    '4あまり2',
  );
  assert.equal(
    formatProblem({
      kind: 'squareRoot',
      left: 16,
      operator: '=',
      right: 1,
      result: 4,
      remainder: 1,
      answer: 4,
      answerSlot: 'result',
      rootMode: 'pair',
      answerMode: 'squareRootPair',
    }),
    '16の√ = □と-□',
  );
  assert.equal(
    formatProblem({
      kind: 'squareRoot',
      left: 16,
      operator: '=',
      right: 1,
      result: 4,
      remainder: 1,
      answer: 4,
      answerSlot: 'result',
      rootMode: 'principal',
    }),
    '√16 = □',
  );
  assert.equal(
    formatProblem({
      kind: 'squareRoot',
      left: 32,
      operator: '=',
      right: 2,
      result: 4,
      remainder: 2,
      answer: 4,
      answerSlot: 'result',
      rootMode: 'simplify',
      answerMode: 'squareRootSimplify',
    }),
    '√32 = □√□',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'squareRoot',
      left: 32,
      operator: '=',
      right: 2,
      result: 4,
      remainder: 2,
      answer: 4,
      answerSlot: 'result',
      rootMode: 'simplify',
      answerMode: 'squareRootSimplify',
    }),
    '4√2',
  );
  assert.equal(
    formatProblem({
      kind: 'squareRoot',
      left: 3,
      operator: '+',
      right: 4,
      result: 7,
      remainder: 2,
      answer: 7,
      answerSlot: 'result',
      rootMode: 'addLike',
      answerMode: 'squareRootExpression',
      rootLeftRadicand: 2,
      rootRightRadicand: 2,
    }),
    '3√2 + 4√2 = □√□',
  );
  assert.equal(
    formatProblem({
      kind: 'squareRoot',
      left: 1,
      operator: '+',
      right: 2,
      result: 5,
      remainder: 2,
      answer: 5,
      answerSlot: 'result',
      rootMode: 'addSimplifyLike',
      answerMode: 'squareRootExpression',
      rootLeftRadicand: 18,
      rootRightRadicand: 2,
    }),
    '√18 + 2√2 = □√□',
  );
  assert.equal(
    formatProblemAnswer({
      kind: 'squareRoot',
      left: 2,
      operator: '-',
      right: 1,
      result: 1,
      remainder: 2,
      answer: 1,
      answerSlot: 'result',
      rootMode: 'minusLike',
      answerMode: 'squareRootExpression',
      rootLeftRadicand: 2,
      rootRightRadicand: 2,
    }),
    '√2',
  );
  assert.equal(
    formatProblem({
      kind: 'sameDenominatorFraction',
      left: 1,
      operator: '+',
      right: 2,
      result: 3,
      answer: 3,
      answerSlot: 'result',
      denominator: 4,
    }),
    '1/4 + 2/4 = □/4',
  );
  assert.equal(
    formatProblem({
      kind: 'differentDenominatorFraction',
      left: 1,
      operator: '+',
      right: 1,
      result: 5,
      answer: 5,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 6,
    }),
    '1/2 + 1/3 = □/6',
  );
  assert.equal(
    formatProblem({
      kind: 'equivalentFraction',
      left: 2,
      operator: '=',
      right: 1,
      result: 0,
      answer: 2,
      answerSlot: 'rightDenominator',
      leftDenominator: 4,
      rightDenominator: 2,
    }),
    '2/4 = 1/□',
  );
  assert.equal(
    formatProblem({
      kind: 'equivalentFraction',
      left: 1,
      operator: '=',
      right: 2,
      result: 0,
      answer: 2,
      answerSlot: 'right',
      leftDenominator: 2,
      rightDenominator: 4,
    }),
    '1/2 = □/4',
  );
  assert.equal(
    formatProblem({
      kind: 'fractionProductQuotient',
      left: 1,
      operator: '×',
      right: 2,
      result: 2,
      answer: 2,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 6,
    }),
    '1/2 × 2/3 = □/6',
  );
  assert.equal(
    formatProblem({
      kind: 'fractionProductQuotient',
      left: 1,
      operator: '÷',
      right: 1,
      result: 3,
      answer: 3,
      answerSlot: 'result',
      leftDenominator: 2,
      rightDenominator: 3,
      resultDenominator: 2,
    }),
    '1/2 ÷ 1/3 = □/2',
  );
});

test('時計問題: 時の答えは12時間差を許容する', () => {
  const noonProblem = {
    kind: 'clockTime',
    left: 12,
    operator: '=',
    right: 40,
    result: 1240,
    answer: 12,
    answerSlot: 'left',
  };
  const oneProblem = {
    kind: 'clockTime',
    left: 1,
    operator: '=',
    right: 13,
    result: 113,
    answer: 1,
    answerSlot: 'left',
  };
  const minuteProblem = {
    kind: 'clockTime',
    left: 1,
    operator: '=',
    right: 13,
    result: 113,
    answer: 13,
    answerSlot: 'right',
  };

  assert.equal(isProblemAnswerCorrect(noonProblem, 12), true);
  assert.equal(isProblemAnswerCorrect(noonProblem, 0), true);
  assert.equal(isProblemAnswerCorrect(noonProblem, 24), false);
  assert.equal(isProblemAnswerCorrect(oneProblem, 1), true);
  assert.equal(isProblemAnswerCorrect(oneProblem, 13), true);
  assert.equal(isProblemAnswerCorrect(oneProblem, 25), false);
  assert.equal(isProblemAnswerCorrect(minuteProblem, 13), true);
  assert.equal(isProblemAnswerCorrect(minuteProblem, 1), false);
});

test('小数問題: 数として同じ答えを正解にする', () => {
  const problem = {
    kind: 'decimal',
    left: 1.2,
    operator: '+',
    right: 0.3,
    result: 1.5,
    answer: 1.5,
    answerSlot: 'result',
    leftDecimalPlaces: 1,
    rightDecimalPlaces: 1,
    resultDecimalPlaces: 2,
  };

  assert.equal(isProblemAnswerCorrect(problem, 1.5), true);
  assert.equal(isProblemAnswerCorrect(problem, 1.50), true);
  assert.equal(isProblemAnswerCorrect(problem, 1.51), false);
});

test('わり算問題: あまりつきの答えを二つの数で判定する', () => {
  const problem = {
    kind: 'integerDivision',
    left: 14,
    operator: '÷',
    right: 3,
    result: 4,
    remainder: 2,
    answer: 4,
    answerSlot: 'result',
    answerMode: 'quotientRemainder',
  };

  assert.equal(isProblemAnswerCorrect(problem, 4), false);
  assert.equal(getProblemAnswerPairJudgement(problem, 4, 2), 'correct');
  assert.equal(getProblemAnswerPairJudgement(problem, 4, 1), 'wrong');
});

test('√問題: 二つの答えを判定する', () => {
  const pairProblem = {
    kind: 'squareRoot',
    left: 16,
    operator: '=',
    right: 1,
    result: 4,
    remainder: 1,
    answer: 4,
    answerSlot: 'result',
    rootMode: 'pair',
    answerMode: 'squareRootPair',
  };
  const simplifyProblem = {
    kind: 'squareRoot',
    left: 32,
    operator: '=',
    right: 2,
    result: 4,
    remainder: 2,
    answer: 4,
    answerSlot: 'result',
    rootMode: 'simplify',
    answerMode: 'squareRootSimplify',
  };
  const expressionProblem = {
    kind: 'squareRoot',
    left: 1,
    operator: '+',
    right: 2,
    result: 5,
    remainder: 2,
    answer: 5,
    answerSlot: 'result',
    rootMode: 'addSimplifyLike',
    answerMode: 'squareRootExpression',
    rootLeftRadicand: 18,
    rootRightRadicand: 2,
  };
  const coefficientOneProblem = {
    kind: 'squareRoot',
    left: 2,
    operator: '-',
    right: 1,
    result: 1,
    remainder: 2,
    answer: 1,
    answerSlot: 'result',
    rootMode: 'minusLike',
    answerMode: 'squareRootExpression',
    rootLeftRadicand: 2,
    rootRightRadicand: 2,
  };
  const unsimplifiedAnswerProblem = {
    kind: 'squareRoot',
    left: 2,
    operator: '+',
    right: 2,
    result: 4,
    remainder: 3,
    answer: 4,
    answerSlot: 'result',
    rootMode: 'addSimplifyLike',
    answerMode: 'squareRootExpression',
    rootLeftRadicand: 12,
    rootRightRadicand: 3,
  };
  const clockMinuteConversionProblem = {
    kind: 'clockMinuteConversion',
    left: 80,
    operator: '=',
    right: 1,
    result: 20,
    remainder: 20,
    answer: 20,
    answerSlot: 'result',
    answerMode: 'clockHourMinute',
    minuteStep: 10,
  };

  assert.equal(isProblemAnswerCorrect(pairProblem, 4), false);
  assert.equal(isProblemAnswerCorrect(clockMinuteConversionProblem, 20), false);
  assert.equal(getProblemAnswerPairJudgement(pairProblem, 4, 4), 'correct');
  assert.equal(getProblemAnswerPairJudgement(pairProblem, 4, 2), 'wrong');
  assert.equal(getProblemAnswerPairJudgement(clockMinuteConversionProblem, 1, 20), 'correct');
  assert.equal(getProblemAnswerPairJudgement(clockMinuteConversionProblem, 12, 0), 'wrong');
  assert.equal(getProblemAnswerPairJudgement(simplifyProblem, 4, 2), 'correct');
  assert.equal(getProblemAnswerPairJudgement(simplifyProblem, 2, 4), 'wrong');
  assert.equal(getProblemAnswerPairJudgement(expressionProblem, 5, 2), 'correct');
  assert.equal(getProblemAnswerPairJudgement(coefficientOneProblem, null, 2), 'correct');
  assert.equal(getProblemAnswerPairJudgement(coefficientOneProblem, 1, 2), 'partial');
  assert.equal(getProblemAnswerPairJudgement(unsimplifiedAnswerProblem, 2, 12), 'partial');
  assert.equal(getProblemAnswerPairJudgement(unsimplifiedAnswerProblem, 4, 3), 'correct');
});

const speedBoundaryCases = [
  { elapsedMs: -1, multiplier: 1, label: null },
  { elapsedMs: 0, multiplier: 2, label: '2ばい' },
  { elapsedMs: 999, multiplier: 2, label: '2ばい' },
  { elapsedMs: 1000, multiplier: 1.5, label: '1.5ばい' },
  { elapsedMs: 2999, multiplier: 1.5, label: '1.5ばい' },
  { elapsedMs: 3000, multiplier: 1, label: null },
];

for (const speedCase of speedBoundaryCases) {
  test(`速度ボーナス: ${speedCase.elapsedMs}ms`, () => {
    assert.deepEqual(getAnswerSpeedBonus(speedCase.elapsedMs), {
      multiplier: speedCase.multiplier,
      label: speedCase.label,
    });
  });
}

test('捕獲ゲージ: goalGaugeが大きいほど必要な正解数が増える', () => {
  const normalGain = getCaptureGaugeGain(undefined, 1, 1);

  assert.equal(normalGain, 20);
  assert.equal(Math.ceil(100 / normalGain), 5);
  assert.equal(Math.ceil(200 / normalGain), 10);
  assert.equal(getCaptureGaugeGain(33, 1, 1), 33);
  assert.equal(Math.ceil(100 / getCaptureGaugeGain(33, 1, 1)), 4);
  assert.equal(getCaptureGaugeGain(70, 1, 1), 70);
  assert.equal(getCaptureGaugeGain(undefined, 1.5, 1), 30);
  assert.equal(getCaptureGaugeGain(undefined, 1, 1.25), 25);
});

test('バトル: 相性が有利/不利/通常の倍率を返す', () => {
  const grassMonster = getMonsterById('haneppu');
  const waterMonster = getMonsterById('awapon');

  const strong = calculateBattleDamage(grassMonster, waterMonster);
  assert.equal(strong.affinity.multiplier, 1.25);
  assert.equal(strong.amount, Math.max(1, Math.round(grassMonster.attack * 1.25)));

  const weak = calculateBattleDamage(waterMonster, grassMonster);
  assert.equal(weak.affinity.multiplier, 0.8);
  assert.equal(weak.amount, Math.max(1, Math.round(waterMonster.attack * 0.8)));

  const neutral = calculateBattleDamage(grassMonster, grassMonster);
  assert.equal(neutral.affinity.multiplier, 1);
  assert.equal(neutral.amount, grassMonster.attack);
});

test('バトル: 速度倍率と基礎倍率を掛けてもダメージは最低1を保証する', () => {
  const attacker = { attack: 1, attribute: 'neutral' };
  const defender = { attribute: 'other' };

  assert.deepEqual(calculateBattleDamage(attacker, defender, 0.1, 0.1), {
    amount: 1,
    affinity: {
      multiplier: 1,
      label: null,
    },
  });
});

test('バトル: 非有限倍率は等倍として扱い、非有限ダメージを返さない', () => {
  const attacker = { attack: 12, attribute: 'neutral' };
  const defender = { attribute: 'other' };
  const damage = calculateBattleDamage(attacker, defender, Number.NaN, Number.POSITIVE_INFINITY);

  assert.equal(damage.amount, 12);
  assert.equal(Number.isFinite(damage.amount), true);
});

test('バトル: 相手HPはトレーナーHPとモンスターHPの大きい方になる', () => {
  assert.equal(getOpponentMaxHp({ hp: 80 }, { hp: 120 }), 120);
  assert.equal(getOpponentMaxHp({ hp: 150 }, { hp: 120 }), 150);
});

const evolutionCases = [
  { name: 'evolution not available', required: null, fragments: 10, expected: { canEvolve: false, filledSlots: 0, remainingFragments: null, requiredFragments: null } },
  { name: 'no fragments', required: 3, fragments: 0, expected: { canEvolve: false, filledSlots: 0, remainingFragments: 3, requiredFragments: 3 } },
  { name: 'one short', required: 3, fragments: 2, expected: { canEvolve: false, filledSlots: 2, remainingFragments: 1, requiredFragments: 3 } },
  { name: 'exactly enough', required: 3, fragments: 3, expected: { canEvolve: true, filledSlots: 3, remainingFragments: 0, requiredFragments: 3 } },
  { name: 'more than enough', required: 3, fragments: 4, expected: { canEvolve: true, filledSlots: 3, remainingFragments: 0, requiredFragments: 3 } },
];

for (const evolutionCase of evolutionCases) {
  test(`進化進捗: ${evolutionCase.name}`, () => {
    assert.deepEqual(
      getEvolutionProgress({ evolutionRequiredFragments: evolutionCase.required }, evolutionCase.fragments),
      evolutionCase.expected,
    );
  });
}

test('進化進捗: 異常なかけら数は0として扱う', () => {
  const monster = { evolutionRequiredFragments: 6 };
  assert.deepEqual(getEvolutionProgress(monster, -1), {
    canEvolve: false,
    filledSlots: 0,
    remainingFragments: 6,
    requiredFragments: 6,
  });
  assert.deepEqual(getEvolutionProgress(monster, Number.NaN), {
    canEvolve: false,
    filledSlots: 0,
    remainingFragments: 6,
    requiredFragments: 6,
  });
  assert.deepEqual(getEvolutionProgress(monster, Number.POSITIVE_INFINITY), {
    canEvolve: false,
    filledSlots: 0,
    remainingFragments: 6,
    requiredFragments: 6,
  });
});

test('ステージ解放: 無条件、未達、達成、Coming Soonを判定する', () => {
  assert.equal(getStageAvailability(getStageById('g1-tashizan-hazimarinosougen'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g2-tokei-tokeiwoyomu'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g2-tokei-gofungoto'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g2-tokei-ippunnokei'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g2-tokei-tooifunnokei'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g2-tokei-jippunnokei'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g4-shosu-shosuketachigaitashizan'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g4-shosu-shosuketachigaihikizan'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g3-shosu-shosuichiketakurinashi'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g3-shosu-shosuichiketakuriari'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g3-warizan-pittariwarizan'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g3-warizan-amarinowarizan'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-heihokon'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-rootpittari'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-rootwonaosu'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-onajiroottashi'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-onajiroothiki'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-naoshitetasu'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g9-root-naoshitehiku'), baseSaveState()), 'available');
  assert.equal(getStageAvailability(getStageById('g1-hikizan-hikuichinokomichi'), baseSaveState()), 'locked');
  assert.equal(
    getStageAvailability(getStageById('g1-hikizan-hikuichinokomichi'), baseSaveState({ stageCaptures: { 'g1-tashizan-junotomodachi': 5 } })),
    'available',
  );
  assert.equal(
    getStageAvailability({ ...getStageById('g1-tashizan-hazimarinosougen'), comingSoon: true }, baseSaveState()),
    'comingSoon',
  );
});

test('時計ステージ: 時と分のどちらかだけを空欄にする', () => {
  const hourRules = getStageById('g2-tokei-tokeiwoyomu').problemRule;
  const fiveMinuteRules = getStageById('g2-tokei-gofungoto').problemRule;
  const tenMinuteStage = getStageById('g2-tokei-jippunnokei');
  const tenMinuteRules = tenMinuteStage.problemRule;
  assert.ok(Array.isArray(hourRules));
  assert.ok(Array.isArray(fiveMinuteRules));
  assert.ok(Array.isArray(tenMinuteRules));
  assert.equal(hourRules[0].answerSlot, 'left');
  assert.deepEqual(fiveMinuteRules.map((rule) => rule.answerSlot), ['right', 'left']);
  assert.deepEqual(fiveMinuteRules[0].right, [5, 55]);
  assert.deepEqual(fiveMinuteRules[1].left, [1, 12]);
  assert.equal(tenMinuteRules[0].kind, 'clockMinuteConversion');
  assert.equal(tenMinuteRules[1].kind, 'clockMinuteConversion');
  assert.deepEqual(tenMinuteRules[0].left, [60, 110]);
  assert.deepEqual(tenMinuteRules[0].right, [1, 1]);
  assert.deepEqual(tenMinuteRules[0].result, []);
  assert.equal(tenMinuteRules[0].minuteStep, 10);
  assert.deepEqual(tenMinuteRules[1].left, [60, 110]);
  assert.deepEqual(tenMinuteRules[1].right, [1, 1]);
  assert.deepEqual(tenMinuteRules[1].result, []);
  assert.equal(tenMinuteRules[1].answerMode, 'clockHourMinute');
  assert.equal(tenMinuteRules[1].minuteStep, 10);
  const tenMinuteMonsterIds = tenMinuteStage.monsterIds.map((monsterEntry) => getStageMonsterId(monsterEntry));
  assert.ok(tenMinuteMonsterIds.length > 0);
  tenMinuteMonsterIds.forEach((monsterId) => assert.ok(getMonsterById(monsterId)));
});

test('小数ステージ: 小数けたをCSVで指定できる', () => {
  const mixedAddRules = getStageById('g4-shosu-shosuketachigaitashizan').problemRule;
  const noCarryRules = getStageById('g3-shosu-shosuichiketakurinashi').problemRule;
  const carryRules = getStageById('g3-shosu-shosuichiketakuriari').problemRule;
  assert.ok(Array.isArray(mixedAddRules));
  assert.ok(Array.isArray(noCarryRules));
  assert.ok(Array.isArray(carryRules));
  assert.deepEqual(
    mixedAddRules.map((rule) => [rule.leftDecimalPlaces, rule.rightDecimalPlaces, rule.resultDecimalPlaces]),
    [
      [1, 2, 2],
      [2, 1, 2],
    ],
  );
  assert.equal(noCarryRules[0].digitRule, 'noCarry');
  assert.equal(carryRules[0].digitRule, 'carryRequired');
});

test('わり算ステージ: あまりルールをCSVで指定できる', () => {
  const noRemainderRules = getStageById('g3-warizan-pittariwarizan').problemRule;
  const remainderRules = getStageById('g3-warizan-amarinowarizan').problemRule;
  assert.ok(Array.isArray(noRemainderRules));
  assert.ok(Array.isArray(remainderRules));
  assert.equal(noRemainderRules[0].kind, 'integerDivision');
  assert.equal(noRemainderRules[0].remainderRule, 'none');
  assert.deepEqual(noRemainderRules[0].remainder, [0, 0]);
  assert.equal(remainderRules[0].kind, 'integerDivision');
  assert.equal(remainderRules[0].remainderRule, 'required');
  assert.deepEqual(remainderRules[0].remainder, [1, 8]);
});

test('√ステージ: √の形をCSVで指定できる', () => {
  const pairRules = getStageById('g9-root-heihokon').problemRule;
  const principalRules = getStageById('g9-root-rootpittari').problemRule;
  const simplifyRules = getStageById('g9-root-rootwonaosu').problemRule;
  const addLikeRules = getStageById('g9-root-onajiroottashi').problemRule;
  const minusLikeRules = getStageById('g9-root-onajiroothiki').problemRule;
  const addSimplifyRules = getStageById('g9-root-naoshitetasu').problemRule;
  const minusSimplifyRules = getStageById('g9-root-naoshitehiku').problemRule;
  assert.ok(Array.isArray(pairRules));
  assert.ok(Array.isArray(principalRules));
  assert.ok(Array.isArray(simplifyRules));
  assert.ok(Array.isArray(addLikeRules));
  assert.ok(Array.isArray(minusLikeRules));
  assert.ok(Array.isArray(addSimplifyRules));
  assert.ok(Array.isArray(minusSimplifyRules));
  assert.equal(pairRules[0].kind, 'squareRoot');
  assert.equal(pairRules[0].rootMode, 'pair');
  assert.equal(principalRules[0].rootMode, 'principal');
  assert.equal(simplifyRules[0].rootMode, 'simplify');
  assert.equal(addLikeRules[0].rootMode, 'addLike');
  assert.equal(minusLikeRules[0].rootMode, 'minusLike');
  assert.equal(addSimplifyRules[0].rootMode, 'addSimplifyLike');
  assert.equal(minusSimplifyRules[0].rootMode, 'minusSimplifyLike');
  assert.deepEqual(simplifyRules[0].remainder, [2, 50]);

  const pairProblem = createProblem(pairRules);
  const principalProblem = createProblem(principalRules);
  const simplifyProblem = createProblem(simplifyRules);
  const addLikeProblem = createProblem(addLikeRules);
  const minusSimplifyProblem = createProblem(minusSimplifyRules);
  assert.equal(pairProblem.kind, 'squareRoot');
  assert.equal(pairProblem.answerMode, 'squareRootPair');
  assert.equal(principalProblem.kind, 'squareRoot');
  assert.equal(principalProblem.rootMode, 'principal');
  assert.equal(simplifyProblem.kind, 'squareRoot');
  assert.equal(simplifyProblem.answerMode, 'squareRootSimplify');
  assert.equal(addLikeProblem.kind, 'squareRoot');
  assert.equal(addLikeProblem.answerMode, 'squareRootExpression');
  assert.equal(minusSimplifyProblem.kind, 'squareRoot');
  assert.equal(minusSimplifyProblem.answerMode, 'squareRootExpression');
});

test('学年表示: ジャンルとステージを学年で切り替える', () => {
  assert.deepEqual(
    getVisibleStageCategories('grade2').map((category) => category.id),
    ['addition', 'subtraction', 'multiplication', 'clock', 'makeTen'],
  );
  assert.deepEqual(
    getVisibleStageCategories('grade3').map((category) => category.id),
    ['division', 'fraction', 'decimal'],
  );
  assert.deepEqual(
    getVisibleStagesByCategoryId('decimal', 'grade3').map((stage) => stage.id),
    ['g3-shosu-shosuichiketatashizan', 'g3-shosu-shosuichiketahikizan', 'g3-shosu-shosuichiketakurinashi', 'g3-shosu-shosuichiketakuriari'],
  );
  assert.deepEqual(
    getVisibleStagesByCategoryId('decimal', 'grade4').map((stage) => stage.id),
    ['g4-shosu-shosuniketatashizan', 'g4-shosu-shosuniketahikizan', 'g4-shosu-shosuketachigaitashizan', 'g4-shosu-shosuketachigaihikizan'],
  );
  assert.deepEqual(getVisibleStageCategories('junior'), []);
  assert.deepEqual(
    getVisibleStageCategories('junior3').map((category) => category.id),
    ['root'],
  );
  assert.deepEqual(
    getVisibleStagesByCategoryId('root', 'junior3').map((stage) => stage.id),
    [
      'g9-root-heihokon',
      'g9-root-rootpittari',
      'g9-root-rootwonaosu',
      'g9-root-onajiroottashi',
      'g9-root-onajiroothiki',
      'g9-root-naoshitetasu',
      'g9-root-naoshitehiku',
    ],
  );
  assert.ok(getVisibleStageCategories('all').length > getVisibleStageCategories('grade2').length);
});

test('stage ids include grade, romaji category, and romaji substage', () => {
  for (const stage of stages) {
    assert.match(stage.id, /^g\d+-[a-z0-9]+-[a-z0-9]+$/);
  }

  assert.equal(getStageById('grasslands').id, 'g1-tashizan-hazimarinosougen');
});

test('セーブ: 学年表示を保存できる', () => {
  saveState(baseSaveState());
  const nextState = setPracticeLevelId('grade3');
  assert.ok(nextState);
  assert.equal(loadSaveState().practiceLevelId, 'grade3');

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 5, practiceLevelId: 'bad' }));
  assert.equal(loadSaveState().practiceLevelId, 'grade2');
});

test('encounter weights halve only the repeated monster', () => {
  const repeatedEntry = { monsterId: 'picoleaf', weight: 40 };
  const otherEntry = { monsterId: 'haneppu', weight: 40 };

  assert.equal(getAdjustedEncounterWeight(repeatedEntry, { monsterId: 'picoleaf', count: 1 }), 20);
  assert.equal(getAdjustedEncounterWeight(repeatedEntry, { monsterId: 'picoleaf', count: 2 }), 10);
  assert.equal(getAdjustedEncounterWeight(repeatedEntry, { monsterId: 'picoleaf', count: 3 }), 5);
  assert.equal(getAdjustedEncounterWeight(otherEntry, { monsterId: 'picoleaf', count: 3 }), 40);
  assert.equal(getAdjustedEncounterWeight(repeatedEntry, { monsterId: 'picoleaf', count: 0 }), 40);
});

test('encounter picker uses the streak-adjusted total weight', () => {
  const monsterIds = [
    { monsterId: 'picoleaf', weight: 10 },
    { monsterId: 'haneppu', weight: 10 },
  ];

  assert.equal(
    withMockedRandom([0.34], () => pickEncounterMonsterId(monsterIds)),
    'picoleaf',
  );
  assert.equal(
    withMockedRandom([0.34], () => pickEncounterMonsterId(monsterIds, { monsterId: 'picoleaf', count: 1 })),
    'haneppu',
  );
});

test('セーブ: 未保存または壊れたJSONは初期状態に戻す', () => {
  assert.deepEqual(loadSaveState().captures, {});

  window.localStorage.setItem(STORAGE_KEY, '{not-json');
  const state = loadSaveState();
  assert.equal(state.version, 5);
  assert.deepEqual(state.captures, {});
  assert.equal(state.coins, 0);
  assert.deepEqual(state.encounterStreak, { monsterId: null, count: 0 });
});

test('セーブ: captures欠損でも復旧できる値は保持する', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 5,
    coins: 45.8,
    items: {
      [SHOP_ITEM_IDS.rareBell]: 2.4,
    },
  }));

  const state = loadSaveState();
  assert.deepEqual(state.captures, {});
  assert.equal(state.coins, 45);
  assert.equal(state.items[SHOP_ITEM_IDS.rareBell], 2);
});

test('セーブ: 保存値は既知IDと正の有限数だけに正規化する', () => {
  const now = Date.now();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    captures: {
      haneppu: 2.8,
      unknownMonster: 7,
      awapon: 0,
    },
    fragments: {
      haneppu: 4.9,
      unknownMonster: 8,
    },
    stageCaptures: {
      grasslands: 3.7,
      'g1-tashizan-hazimarinosougen': 3.7,
      unknownStage: 4,
    },
    stageSpeedStars: {
      grasslands: true,
    },
    stageBestAverageAnswerMs: {
      iceCave: 2000,
    },
    stagePlayLimits: {
      grasslands: {
        startedAt: now,
        playCount: 2.9,
      },
    },
    encounterStreak: {
      monsterId: 'haneppu',
      count: 2.9,
    },
    dailyLogin: {
      lastClaimedDate: '2026-05-24',
      streakDays: 2.9,
      totalClaimDays: 9.1,
    },
    coins: 12.8,
  }));

  const state = loadSaveState();
  assert.deepEqual(state.captures, { haneppu: 2 });
  assert.equal(getMonsterFragmentCount(state, 'haneppu'), 4);
  assert.deepEqual(state.stageCaptures, { 'g1-tashizan-hazimarinosougen': 6 });
  assert.deepEqual(state.stageSpeedStars, {
    'g1-tashizan-hazimarinosougen': true,
    'g1-tashizan-koorinodoukutsu': true,
  });
  assert.deepEqual(state.stagePlayLimits, {
    'g1-tashizan-hazimarinosougen': {
      startedAt: now,
      playCount: 2,
    },
  });
  assert.deepEqual(state.encounterStreak, { monsterId: 'haneppu', count: 2 });
  assert.deepEqual(state.dailyLogin, {
    lastClaimedDate: '2026-05-24',
    streakDays: 2,
    totalClaimDays: 9,
  });
  assert.equal(state.coins, 12);
});

test('セーブ: 旧保存の空fragments/stageCapturesはcapturesから補完する', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 4,
    captures: {
      haneppu: 2,
      awapon: 1,
    },
    fragments: {},
    stageCaptures: {},
  }));

  const state = loadSaveState();
  assert.equal(getMonsterFragmentCount(state, 'haneppu'), 2);
  assert.equal(getMonsterFragmentCount(state, 'awapon'), 1);
  assert.equal(state.stageCaptures['g1-tashizan-hazimarinosougen'], 2);
  assert.equal(state.stageCaptures['g1-tashizan-mizubenoniwa'], 1);
  assert.deepEqual(state.stageMonsterCaptures, {});
  assert.deepEqual(state.stageSpeedStars, {});
  assert.equal(getStageMonsterCaptureCount(state, 'g1-tashizan-hazimarinosougen', 'haneppu'), 0);
});

test('セーブ: 今の保存はcapturesだけからステージ星を作らない', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 5,
    captures: {
      picoleaf: 1,
    },
  }));

  const state = loadSaveState();
  assert.deepEqual(state.stageCaptures, {});
  assert.deepEqual(state.stageMonsterCaptures, {});
  assert.deepEqual(state.stageSpeedStars, {});
  assert.equal(getStageStarRank(state, getStageById('g1-tashizan-hazimarinosougen')), 0);
});

test('セーブ: 捕獲すると捕獲数、かけら、ステージ捕獲数が増える', () => {
  saveState(baseSaveState());

  const state = addCapture('haneppu', 'g1-tashizan-hazimarinosougen');
  assert.equal(state.captures.haneppu, 1);
  assert.equal(getMonsterFragmentCount(state, 'haneppu'), 1);
  assert.equal(state.stageCaptures['g1-tashizan-hazimarinosougen'], 1);
  assert.equal(getStageMonsterCaptureCount(state, 'g1-tashizan-hazimarinosougen', 'haneppu'), 0);
});

test('セーブ: ステージのスピード星は目標以内で保存する', () => {
  saveState(baseSaveState());

  let state = recordStageAverageAnswerTime('g1-tashizan-hazimarinosougen', 3400);
  assert.ok(state);
  assert.equal(hasStageSpeedStar(state, 'g1-tashizan-hazimarinosougen'), false);

  state = recordStageAverageAnswerTime('g1-tashizan-hazimarinosougen', 2800);
  assert.ok(state);
  assert.equal(hasStageSpeedStar(state, 'g1-tashizan-hazimarinosougen'), true);

  state = recordStageAverageAnswerTime('g1-tashizan-hazimarinosougen', 4200);
  assert.ok(state);
  assert.equal(hasStageSpeedStar(state, 'g1-tashizan-hazimarinosougen'), true);
  assert.equal(recordStageAverageAnswerTime('unknownStage', 2000), null);
});

test('デイリーミッション: 今日の進みとごほうびを保存する', () => {
  saveState(baseSaveState());

  recordStagePlayEntry('g1-tashizan-hazimarinosougen');
  recordStagePlayEntry('g1-tashizan-hazimarinosougen');
  addCapture('haneppu', 'g1-tashizan-hazimarinosougen');
  addCapture('picoleaf', 'g1-tashizan-hazimarinosougen');
  addBattleReward('trainer-haru', 10);

  const board = getDailyMissionBoardStatus(loadSaveState());
  assert.equal(board.completedCount, 3);
  assert.equal(board.allClearComplete, true);
  assert.deepEqual(board.missions.map((mission) => mission.current), [2, 2, 1]);

  const stageReward = claimDailyMissionReward('stage-entries-2');
  assert.ok(stageReward);
  assert.equal(stageReward.state.coins, 30);
  assert.deepEqual(stageReward.state.dailyMissions.claimedMissionIds, ['stage-entries-2']);
  assert.equal(claimDailyMissionReward('stage-entries-2'), null);

  const allClearReward = claimDailyMissionAllClearReward();
  assert.ok(allClearReward);
  assert.equal(allClearReward.state.items[SHOP_ITEM_IDS.rareBell], 1);
  assert.equal(allClearReward.state.dailyMissions.allClearClaimed, true);
  assert.equal(claimDailyMissionAllClearReward(), null);
});

test('デイリーミッション: もらったものはおすすめに出さない', () => {
  saveState(baseSaveState({
    dailyMissions: {
      dateKey: getLocalDateKey(),
      stageEntries: 2,
      captures: 2,
      battleWins: 1,
      claimedMissionIds: ['stage-entries-2', 'captures-2', 'battle-wins-1'],
      allClearClaimed: true,
    },
  }));

  assert.equal(getSuggestedDailyMissionStatus(loadSaveState()), null);
});

test('トロフィー: ステージぜんぶはそのステージの星5つを見る', () => {
  const grasslandsComplete = achievements.find((achievement) => achievement.id === 'stage-complete-g1-tashizan-hazimarinosougen');
  const timesTable1Complete = achievements.find((achievement) => achievement.id === 'stage-complete-g2-kakezan-ichinodan');
  assert.ok(grasslandsComplete);
  assert.ok(timesTable1Complete);
  const stage = getStageById('g1-tashizan-hazimarinosougen');
  const stageMonsterIds = stage.monsterIds.map((monsterEntry) => getStageMonsterId(monsterEntry));
  function getFinalMonsterId(monsterId) {
    let monster = getMonsterById(monsterId);
    while (monster.nextEvolutionId) {
      monster = getMonsterById(monster.nextEvolutionId);
    }

    return monster.id;
  }

  saveState(baseSaveState({
    captures: {
      ...Object.fromEntries(stageMonsterIds.map((monsterId) => [monsterId, 1])),
      ...Object.fromEntries(stageMonsterIds.map((monsterId) => [getFinalMonsterId(monsterId), 1])),
    },
    stageCaptures: {
      [stage.id]: 10,
    },
    stageSpeedStars: {
      [stage.id]: true,
    },
  }));

  const state = loadSaveState();
  assert.equal(grasslandsComplete.isUnlocked(state), true);
  assert.equal(timesTable1Complete.isUnlocked(state), false);
});

test('ステージ星: 達成した条件の数で増える', () => {
  const stage = getStageById('g1-tashizan-hazimarinosougen');
  const stageMonsterIds = stage.monsterIds.map((monsterEntry) => getStageMonsterId(monsterEntry));
  function getFinalMonsterId(monsterId) {
    let monster = getMonsterById(monsterId);
    while (monster.nextEvolutionId) {
      monster = getMonsterById(monster.nextEvolutionId);
    }

    return monster.id;
  }

  const capturedAllEntries = Object.fromEntries(stageMonsterIds.map((monsterId) => [monsterId, 1]));
  const finalCaptureEntries = Object.fromEntries(stageMonsterIds.map((monsterId) => [getFinalMonsterId(monsterId), 1]));

  saveState(baseSaveState({
    captures: {
      ...capturedAllEntries,
      ...finalCaptureEntries,
    },
  }));
  assert.equal(getStageStarRank(loadSaveState(), stage), 2);

  saveState(baseSaveState({
    stageCaptures: {
      [stage.id]: 1,
    },
  }));
  assert.equal(getStageStarRank(loadSaveState(), stage), 1);

  saveState(baseSaveState({
    stageCaptures: {
      [stage.id]: 10,
    },
  }));
  assert.equal(getStageStarRank(loadSaveState(), stage), 2);

  saveState({
    ...loadSaveState(),
    captures: capturedAllEntries,
  });
  assert.equal(getStageStarRank(loadSaveState(), stage), 3);

  const state = loadSaveState();
  saveState({
    ...state,
    captures: {
      ...state.captures,
      ...finalCaptureEntries,
    },
  });
  assert.equal(getStageStarRank(loadSaveState(), stage), 4);

  recordStageAverageAnswerTime(stage.id, 2500);
  assert.equal(getStageStarRank(loadSaveState(), stage), 5);
});

test('ステージ星: レア以外をぜんぶ見つけると星3つになる', () => {
  const stage = getStageById('g3-bunsu-bunsunohoshi');
  const normalMonsterIds = stage.monsterIds
    .map((monsterEntry) => getStageMonsterId(monsterEntry))
    .filter((monsterId) => !getMonsterById(monsterId).isRare);
  const rareMonsterIds = stage.monsterIds
    .map((monsterEntry) => getStageMonsterId(monsterEntry))
    .filter((monsterId) => getMonsterById(monsterId).isRare);
  function getFinalMonsterId(monsterId) {
    let monster = getMonsterById(monsterId);
    while (monster.nextEvolutionId) {
      monster = getMonsterById(monster.nextEvolutionId);
    }

    return monster.id;
  }

  assert.ok(normalMonsterIds.length > 0);
  assert.ok(rareMonsterIds.length > 0);
  saveState(baseSaveState({
    stageCaptures: {
      [stage.id]: 10,
    },
  }));

  for (const monsterId of normalMonsterIds) {
    addCapture(monsterId, stage.id);
  }
  assert.equal(getStageStarRank(loadSaveState(), stage), 3);

  const state = loadSaveState();
  saveState({
    ...state,
    captures: {
      ...state.captures,
      ...Object.fromEntries(normalMonsterIds.map((monsterId) => [getFinalMonsterId(monsterId), 1])),
    },
  });
  assert.equal(getStageStarRank(loadSaveState(), stage), 4);
});

test('ステージ星: 条件ごとに独立して星を数える', () => {
  const iceCave = getStageById('g1-tashizan-koorinodoukutsu');
  const stageMonsterIds = iceCave.monsterIds.map((monsterEntry) => getStageMonsterId(monsterEntry));
  function getFinalMonsterId(monsterId) {
    let monster = getMonsterById(monsterId);
    while (monster.nextEvolutionId) {
      monster = getMonsterById(monster.nextEvolutionId);
    }

    return monster.id;
  }

  saveState(baseSaveState({
    captures: {
      ...Object.fromEntries(stageMonsterIds.map((monsterId) => [monsterId, 1])),
      ...Object.fromEntries(stageMonsterIds.map((monsterId) => [getFinalMonsterId(monsterId), 1])),
    },
    stageCaptures: {
      [iceCave.id]: 9,
    },
  }));

  assert.equal(getStageStarRank(loadSaveState(), iceCave), 3);
  saveState({
    ...loadSaveState(),
    stageCaptures: {
      [iceCave.id]: 10,
    },
  });
  assert.equal(getStageStarRank(loadSaveState(), iceCave), 4);
});

test('セーブ: タイトルかざりは捕獲済みモンスターだけ保存する', () => {
  saveState(baseSaveState({
    captures: {
      picoleaf: 1,
    },
  }));

  const state = saveTitleMonsterPlacements([
    { monsterId: 'picoleaf', x: 80, y: 608, size: 82, angle: 0 },
    { monsterId: 'hinokoro', x: 150, y: 552, size: 92, angle: 0 },
  ]);
  assert.ok(state);
  assert.deepEqual(state.titleMonsterIds, ['picoleaf', null, null, null, null]);
  assert.deepEqual(getTitleMonsterIds(state), ['picoleaf', null, null, null, null]);
  assert.equal(getTitleMonsterPlacements(state)[0].monsterId, 'picoleaf');
});

test('セーブ: タイトルかざりは自由配置の位置と大きさを保存する', () => {
  saveState(baseSaveState({
    captures: {
      picoleaf: 1,
      hinokoro: 1,
    },
  }));

  const state = saveTitleMonsterPlacements([
    { monsterId: 'picoleaf', x: 180, y: 620, size: 94, angle: 15 },
    { monsterId: 'hinokoro', x: 10, y: 900, size: 999, angle: -15 },
    { monsterId: 'unknownMonster', x: 220, y: 620, size: 90 },
  ]);
  assert.ok(state);
  assert.deepEqual(state.titleMonsterIds, ['picoleaf', 'hinokoro', null, null, null]);
  assert.deepEqual(getTitleMonsterPlacements(state), [
    { monsterId: 'picoleaf', x: 180, y: 620, size: 94, angle: 15 },
    { monsterId: 'hinokoro', x: 44, y: 728, size: TITLE_MONSTER_MAX_SIZE, angle: 345 },
  ]);
});

test('セーブ: タイトル背景は購入後に選択でき、未購入は選べない', () => {
  saveState(baseSaveState({ coins: 620 }));
  assert.equal(getSelectedTitleBackground(loadSaveState()).id, TITLE_BACKGROUND_IDS.stageGrasslands);
  assert.equal(selectTitleBackground(TITLE_BACKGROUND_IDS.stageIceCave), null);

  const boughtState = buyTitleBackground(TITLE_BACKGROUND_IDS.stageIceCave);
  assert.ok(boughtState);
  assert.equal(boughtState.coins, 0);
  assert.deepEqual(boughtState.ownedTitleBackgroundIds, [TITLE_BACKGROUND_IDS.stageIceCave]);
  assert.equal(boughtState.selectedTitleBackgroundId, TITLE_BACKGROUND_IDS.stageIceCave);
  assert.equal(getSelectedTitleBackground(boughtState).id, TITLE_BACKGROUND_IDS.stageIceCave);

  const defaultState = selectTitleBackground(TITLE_BACKGROUND_IDS.stageGrasslands);
  assert.ok(defaultState);
  assert.equal(defaultState.selectedTitleBackgroundId, TITLE_BACKGROUND_IDS.stageGrasslands);

  saveState(baseSaveState({ coins: 620 }));
  const stageBoughtState = buyTitleBackground(TITLE_BACKGROUND_IDS.stageFireMountain);
  assert.ok(stageBoughtState);
  assert.equal(stageBoughtState.coins, 0);
  assert.deepEqual(stageBoughtState.ownedTitleBackgroundIds, [TITLE_BACKGROUND_IDS.stageFireMountain]);
  assert.equal(stageBoughtState.selectedTitleBackgroundId, TITLE_BACKGROUND_IDS.stageFireMountain);
});

test('transfer code imports captures backgrounds and stage progress', () => {
  const picoleaf = getMonsterById('picoleaf');
  const transferSourceState = baseSaveState({
    coins: 777,
    captures: {
      picoleaf: 2,
      haneppu: 1,
    },
    fragments: {
      [picoleaf.evolutionFamilyId]: 4,
    },
    stageCaptures: {
      'g1-tashizan-hazimarinosougen': 12,
      'g1-tashizan-koorinodoukutsu': 1,
    },
    stageSpeedStars: {
      'g1-tashizan-hazimarinosougen': true,
    },
    stageMonsterCaptures: {
      'g1-tashizan-hazimarinosougen': {
        picoleaf: 2,
        haneppu: 1,
      },
      'g1-tashizan-koorinodoukutsu': {
        yukipon: 1,
      },
    },
    ownedTitleBackgroundIds: [TITLE_BACKGROUND_IDS.stageIceCave],
    selectedTitleBackgroundId: TITLE_BACKGROUND_IDS.stageIceCave,
  });
  saveState(transferSourceState);

  const code = createTransferCode();
  assert.equal(code, createTransferCode({
    ...transferSourceState,
    captures: {
      picoleaf: 1,
      haneppu: 1,
    },
    stageCaptures: {
      'g1-tashizan-hazimarinosougen': 12,
      'g1-tashizan-koorinodoukutsu': 1,
    },
    stageSpeedStars: {
      'g1-tashizan-hazimarinosougen': true,
    },
    stageMonsterCaptures: {},
  }));
  const qrMatrix = createQrMatrix(code);
  assert.ok(qrMatrix.size > 0);
  assert.deepEqual(getTransferSummary(loadSaveState()), {
    captureKinds: 2,
    titleBackgrounds: 2,
    stages: 2,
  });

  saveState(baseSaveState({
    coins: 12,
    captures: {
      hinokoro: 1,
    },
    stageCaptures: {
      'g1-tashizan-honoonoyama': 9,
    },
    stageSpeedStars: {
      'g1-tashizan-honoonoyama': true,
    },
    stageMonsterCaptures: {
      'g1-tashizan-honoonoyama': {
        hinokoro: 9,
      },
    },
    ownedTitleBackgroundIds: [TITLE_BACKGROUND_IDS.stageFireMountain],
    selectedTitleBackgroundId: TITLE_BACKGROUND_IDS.stageFireMountain,
  }));

  const codeWithReaderSpaces = `${code.slice(0, 8)} \n ${code.slice(8, 24)} ${code.slice(24)}`;
  const result = importTransferCode(codeWithReaderSpaces);
  assert.equal(result.status, 'ok');
  const state = loadSaveState();
  assert.equal(state.coins, 12);
  assert.deepEqual(state.captures, {
    picoleaf: 1,
    haneppu: 1,
  });
  assert.deepEqual(state.fragments, {
    [picoleaf.evolutionFamilyId]: 4,
  });
  assert.deepEqual(state.stageCaptures, {
    'g1-tashizan-hazimarinosougen': 12,
    'g1-tashizan-koorinodoukutsu': 1,
  });
  assert.deepEqual(state.stageSpeedStars, {
    'g1-tashizan-hazimarinosougen': true,
  });
  assert.deepEqual(state.stageMonsterCaptures, {});
  assert.deepEqual(state.ownedTitleBackgroundIds, [TITLE_BACKGROUND_IDS.stageIceCave]);
  assert.equal(state.selectedTitleBackgroundId, TITLE_BACKGROUND_IDS.stageIceCave);

  const badCode = `${code.slice(0, -1)}${code.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(importTransferCode(badCode).status, 'badChecksum');
  assert.equal(loadSaveState().coins, 12);
});

test('encounter streak save tracks repeats and resets on a different monster', () => {
  saveState(baseSaveState());

  let state = recordEncounterMonster('picoleaf');
  assert.ok(state);
  assert.deepEqual(state.encounterStreak, { monsterId: 'picoleaf', count: 1 });

  state = recordEncounterMonster('picoleaf');
  assert.ok(state);
  assert.deepEqual(state.encounterStreak, { monsterId: 'picoleaf', count: 2 });

  state = recordEncounterMonster('haneppu');
  assert.ok(state);
  assert.deepEqual(state.encounterStreak, { monsterId: 'haneppu', count: 1 });
  assert.equal(recordEncounterMonster('unknownMonster'), null);
});

test('セーブ: レア捕獲はかけらを5個増やす', () => {
  const rareMonster = monsters.find((monster) => monster.isRare);
  assert.ok(rareMonster, 'rare monster fixture should exist');
  saveState(baseSaveState());

  const state = addCapture(rareMonster.id);
  assert.equal(getMonsterFragmentCount(state, rareMonster.id), 5);
});

test('ログインボーナス: 7日目はレアベル付きで、同日再受け取りはできない', () => {
  const now = new Date(2026, 4, 25, 9, 0, 0).getTime();
  saveState(baseSaveState({
    dailyLogin: {
      lastClaimedDate: '2026-05-24',
      streakDays: 6,
      totalClaimDays: 6,
    },
  }));

  const status = getDailyLoginBonusStatus(loadSaveState(), now);
  assert.equal(status.canClaim, true);
  assert.equal(status.cycleDay, DAILY_LOGIN_COIN_REWARDS.length);
  assert.equal(status.rewardCoins, 60);
  assert.equal(status.rewardItemId, SHOP_ITEM_IDS.rareBell);

  const claim = claimDailyLoginBonus(now);
  assert.ok(claim);
  assert.equal(claim.state.coins, 60);
  assert.equal(claim.state.items[SHOP_ITEM_IDS.rareBell], 1);
  assert.equal(claim.state.dailyLogin.lastClaimedDate, '2026-05-25');

  assert.equal(claimDailyLoginBonus(now), null);
});

test('ログインボーナス: 未来日や存在しない日付は受け取り判定を壊さない', () => {
  const now = new Date(2026, 4, 25, 9, 0, 0).getTime();
  const futureStatus = getDailyLoginBonusStatus(baseSaveState({
    dailyLogin: {
      lastClaimedDate: '2026-05-26',
      streakDays: 4,
      totalClaimDays: 4,
    },
  }), now);
  assert.equal(futureStatus.canClaim, false);
  assert.equal(futureStatus.streakDays, 4);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 5,
    captures: {},
    dailyLogin: {
      lastClaimedDate: '2026-02-31',
      streakDays: 3,
      totalClaimDays: 3,
    },
  }));
  assert.equal(loadSaveState().dailyLogin.lastClaimedDate, null);
});

test('ログインボーナス: 日付が飛んだ場合は連続日数が1日に戻る', () => {
  const now = new Date(2026, 4, 25, 9, 0, 0).getTime();
  const status = getDailyLoginBonusStatus(baseSaveState({
    dailyLogin: {
      lastClaimedDate: '2026-05-20',
      streakDays: 6,
      totalClaimDays: 6,
    },
  }), now);

  assert.equal(status.canClaim, true);
  assert.equal(status.streakDays, 1);
  assert.equal(status.cycleDay, 1);
  assert.equal(status.rewardCoins, 10);
});

test('プレイ制限: 10分窓の境界と上限回数を判定する', () => {
  const now = 1_000_000;
  const activeState = baseSaveState({
    stagePlayLimits: {
      'g1-tashizan-hazimarinosougen': {
        startedAt: now - STAGE_PLAY_WINDOW_MS + 1,
        playCount: STAGE_PLAY_LIMIT - 1,
      },
    },
  });
  assert.deepEqual(getStagePlayLimitStatus(activeState, 'g1-tashizan-hazimarinosougen', now), {
    isActive: true,
    isLimited: false,
    playCount: STAGE_PLAY_LIMIT - 1,
    remainingPlays: 1,
    remainingMs: 1,
    windowStartedAt: now - STAGE_PLAY_WINDOW_MS + 1,
  });

  const limitedState = baseSaveState({
    stagePlayLimits: {
      'g1-tashizan-hazimarinosougen': {
        startedAt: now - STAGE_PLAY_WINDOW_MS + 1,
        playCount: STAGE_PLAY_LIMIT,
      },
    },
  });
  assert.equal(getStagePlayLimitStatus(limitedState, 'g1-tashizan-hazimarinosougen', now).isLimited, true);

  const expiredState = baseSaveState({
    stagePlayLimits: {
      'g1-tashizan-hazimarinosougen': {
        startedAt: now - STAGE_PLAY_WINDOW_MS,
        playCount: STAGE_PLAY_LIMIT,
      },
    },
  });
  assert.equal(getStagePlayLimitStatus(expiredState, 'g1-tashizan-hazimarinosougen', now).isActive, false);
});

test('プレイ制限: 時計デバッグステージは制限しない', () => {
  const now = 1_000_000;
  const state = baseSaveState({
    stagePlayLimits: {
      'g2-tokei-gofungoto': {
        startedAt: now,
        playCount: STAGE_PLAY_LIMIT,
      },
    },
  });

  assert.equal(isStagePlayLimitDisabled('g2-tokei-gofungoto'), true);
  assert.equal(getStagePlayLimitStatus(state, 'g2-tokei-gofungoto', now).isLimited, false);

  saveState(state);
  const next = recordStagePlayEntry('g2-tokei-gofungoto', now);
  assert.ok(next);
  assert.equal(next.stagePlayLimits['g2-tokei-gofungoto'], undefined);
  assert.equal(next.dailyMissions.stageEntries, 1);
});

test('stage play entry using an item consumes the item and increments play count together', () => {
  const now = Date.now();
  saveState(baseSaveState({
    items: {
      [SHOP_ITEM_IDS.nakamaCall]: 2,
    },
  }));

  const state = recordStagePlayEntryUsingItem('g1-tashizan-hazimarinosougen', SHOP_ITEM_IDS.nakamaCall, 1, now);
  assert.ok(state);
  assert.equal(state.items[SHOP_ITEM_IDS.nakamaCall], 1);
  assert.equal(state.stagePlayLimits['g1-tashizan-hazimarinosougen'].playCount, 1);
  assert.equal(state.stagePlayLimits['g1-tashizan-hazimarinosougen'].startedAt, now);

  assert.equal(recordStagePlayEntryUsingItem('g1-tashizan-hazimarinosougen', SHOP_ITEM_IDS.nakamaCall, 2, now + 1), null);
  assert.equal(loadSaveState().items[SHOP_ITEM_IDS.nakamaCall], 1);
  assert.equal(loadSaveState().stagePlayLimits['g1-tashizan-hazimarinosougen'].playCount, 1);
});

test('stage play entry using an item does not consume while the stage is limited', () => {
  const now = Date.now();
  saveState(baseSaveState({
    items: {
      [SHOP_ITEM_IDS.nakamaCall]: 1,
    },
    stagePlayLimits: {
      'g1-tashizan-hazimarinosougen': {
        startedAt: now,
        playCount: STAGE_PLAY_LIMIT,
      },
    },
  }));

  assert.equal(recordStagePlayEntryUsingItem('g1-tashizan-hazimarinosougen', SHOP_ITEM_IDS.nakamaCall, 1, now + 1), null);
  assert.equal(loadSaveState().items[SHOP_ITEM_IDS.nakamaCall], 1);
  assert.equal(loadSaveState().stagePlayLimits['g1-tashizan-hazimarinosougen'].playCount, STAGE_PLAY_LIMIT);
});

test('プレイ制限: 未来のstartedAtは有効な制限窓にしない', () => {
  const now = 1_000_000;
  const state = baseSaveState({
    stagePlayLimits: {
      'g1-tashizan-hazimarinosougen': {
        startedAt: now + 60_000,
        playCount: STAGE_PLAY_LIMIT,
      },
    },
  });

  const status = getStagePlayLimitStatus(state, 'g1-tashizan-hazimarinosougen', now);
  assert.equal(status.isActive, false);
  assert.equal(status.isLimited, false);
});

test('進化/交換/ショップ: 必要数ぴったりの境界で更新できる', () => {
  const sourceMonster = monsters.find((monster) => monster.nextEvolutionId);
  assert.ok(sourceMonster, 'evolution source fixture should exist');
  const evolvedMonsterId = sourceMonster.nextEvolutionId;
  let finalMonster = sourceMonster;
  while (finalMonster.nextEvolutionId) {
    finalMonster = getMonsterById(finalMonster.nextEvolutionId);
  }
  const familyMonsterIds = monsters
    .filter((monster) => monster.evolutionFamilyId === sourceMonster.evolutionFamilyId)
    .map((monster) => monster.id);
  const requiredFragments = 3;

  saveState(baseSaveState({
    fragments: {
      [sourceMonster.evolutionFamilyId]: requiredFragments,
    },
  }));

  const evolutionResult = evolveMonster(sourceMonster.id, evolvedMonsterId, requiredFragments);
  assert.ok(evolutionResult);
  assert.equal(evolutionResult.state.captures[evolvedMonsterId], 1);
  assert.equal(getMonsterFragmentCount(evolutionResult.state, sourceMonster.id), 0);

  saveState(baseSaveState({
    captures: {
      [finalMonster.id]: 1,
    },
    fragments: {
      [sourceMonster.evolutionFamilyId]: 5,
    },
    unlockedDexStoryMonsterIds: familyMonsterIds,
  }));
  const exchangeResult = exchangeFragmentsForCandy(sourceMonster.id, sourceMonster.attribute);
  assert.ok(exchangeResult);
  assert.equal(getMonsterFragmentCount(exchangeResult, sourceMonster.id), 0);
  assert.equal(getCandyCount(exchangeResult, sourceMonster.attribute), 1);

  saveState(baseSaveState({ coins: 30 }));
  const boughtState = buyShopItem(SHOP_ITEM_IDS.gaugeBall, 30);
  assert.ok(boughtState);
  assert.equal(boughtState.coins, 0);
  assert.equal(boughtState.items[SHOP_ITEM_IDS.gaugeBall], 1);

  const consumedState = consumeShopItem(SHOP_ITEM_IDS.gaugeBall, 1);
  assert.ok(consumedState);
  assert.equal(consumedState.items[SHOP_ITEM_IDS.gaugeBall], undefined);
});

test('進化/交換/ショップ: 不正なコストや直接でない進化先は拒否する', () => {
  const sourceMonster = getMonsterById('picoleaf');
  saveState(baseSaveState({
    coins: 30,
    fragments: {
      [sourceMonster.evolutionFamilyId]: 6,
    },
    candies: {
      [sourceMonster.attribute]: 2,
    },
    items: {
      [SHOP_ITEM_IDS.gaugeBall]: 1,
    },
  }));

  assert.equal(evolveMonster(sourceMonster.id, 'morileaf', 6), null);
  assert.equal(evolveMonster(sourceMonster.id, sourceMonster.nextEvolutionId, 0), null);
  assert.equal(exchangeFragmentsForCandy(sourceMonster.id, sourceMonster.attribute, 0), null);
  assert.equal(exchangeCandyForCoins(sourceMonster.attribute, -1), null);
  assert.equal(buyShopItem(SHOP_ITEM_IDS.gaugeBall, -10), null);
  assert.equal(consumeShopItem(SHOP_ITEM_IDS.gaugeBall, -1), null);
});

test('保存失敗時は更新系関数が成功扱いを返さない', () => {
  const originalStorage = window.localStorage;
  const failingStorage = createMemoryStorage();
  failingStorage.setItem(STORAGE_KEY, JSON.stringify(baseSaveState({
    coins: 800,
    fragments: {
      picoleaf: FRAGMENTS_PER_CANDY,
    },
    candies: {
      'くさ': 1,
    },
    items: {
      [SHOP_ITEM_IDS.gaugeBall]: 1,
    },
  })));
  failingStorage.setItem = () => {
    throw new Error('storage full');
  };
  window.localStorage = failingStorage;

  try {
    assert.equal(claimDailyLoginBonus(new Date(2026, 4, 25, 9, 0, 0).getTime()), null);
    assert.equal(recordStagePlayEntry('g1-tashizan-hazimarinosougen', 1_000_000), null);
    assert.equal(recordStagePlayEntryUsingItem('g1-tashizan-hazimarinosougen', SHOP_ITEM_IDS.gaugeBall, 1, 1_000_000), null);
    assert.equal(recordEncounterMonster('picoleaf'), null);
    assert.equal(exchangeFragmentsForCandy('picoleaf', 'くさ'), null);
    assert.equal(exchangeCandyForCoins('くさ'), null);
    assert.equal(buyShopItem(SHOP_ITEM_IDS.gaugeBall, 30), null);
    assert.equal(buyTitleBackground(TITLE_BACKGROUND_IDS.stageMoonRuins), null);
    assert.equal(consumeShopItem(SHOP_ITEM_IDS.gaugeBall), null);
  } finally {
    window.localStorage = originalStorage;
  }
});

test('ストーリー数式: 分数の分子にルートを入れられる', () => {
  assert.deepEqual(parseStoryMathExpression('frac(sqrt(5),2)'), {
    kind: 'call',
    name: 'frac',
    args: [
      {
        kind: 'call',
        name: 'sqrt',
        args: [
          { kind: 'text', value: '5' },
        ],
      },
      { kind: 'text', value: '2' },
    ],
  });
});

test('ストーリー数式: logと上付きの入れ子を読める', () => {
  assert.deepEqual(parseStoryMathExpression('pow(log(e,2),2)'), {
    kind: 'call',
    name: 'pow',
    args: [
      {
        kind: 'call',
        name: 'log',
        args: [
          { kind: 'text', value: 'e' },
          { kind: 'text', value: '2' },
        ],
      },
      { kind: 'text', value: '2' },
    ],
  });
});
