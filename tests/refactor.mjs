import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

/** Registers focused regression cases using the existing Vite test runtime. */
export async function registerRefactorTests(server) {
  const [lifetime, browserStorage, debug, notices, story, choices, geometry, input] = await Promise.all([
    server.ssrLoadModule('/src/game/sceneLifetime.ts'),
    server.ssrLoadModule('/src/state/browserStorage.ts'),
    server.ssrLoadModule('/src/data/debugMode.ts'),
    server.ssrLoadModule('/src/state/titleNotice.ts'),
    server.ssrLoadModule('/src/state/storyCreator.ts'),
    server.ssrLoadModule('/src/game/problem/choiceAnswers.ts'),
    server.ssrLoadModule('/src/game/problem/gridGeometry.ts'),
    server.ssrLoadModule('/src/game/problem/answerInput.ts'),
  ]);

  /** Models the event surfaces used by scene lifetime helpers. */
  function createSceneEvents() {
    const input = new EventEmitter();
    input.keyboard = new EventEmitter();
    return { events: new EventEmitter(), input };
  }

  test('scene lifetime: repeated visits release both exit listeners', () => {
    const scene = createSceneEvents();
    let calls = 0;
    for (let visit = 0; visit < 25; visit += 1) {
      const cleanup = lifetime.onSceneExit(scene, () => { calls += 1; });
      scene.events.emit('shutdown');
      cleanup();
      assert.equal(scene.events.listenerCount('shutdown'), 0);
      assert.equal(scene.events.listenerCount('destroy'), 0);
    }
    scene.events.emit('destroy');
    assert.equal(calls, 25);
  });

  test('scene lifetime: a late async result stays cancelled after a new visit', () => {
    const scene = createSceneEvents();
    const firstVisit = lifetime.createSceneLifetime(scene);
    scene.events.emit('shutdown');
    const secondVisit = lifetime.createSceneLifetime(scene);
    assert.equal(firstVisit.aborted, true);
    assert.equal(secondVisit.aborted, false);
    scene.events.emit('destroy');
    assert.equal(secondVisit.aborted, true);
  });

  test('scene input: tap and keyboard compete for a single advance', () => {
    const scene = createSceneEvents();
    let calls = 0;
    lifetime.onceSceneAdvance(scene, () => { calls += 1; });
    scene.input.emit('pointerdown');
    scene.input.keyboard.emit('keydown-ENTER');
    scene.input.keyboard.emit('keydown-SPACE');
    assert.equal(calls, 1);
    assert.equal(scene.events.listenerCount('destroy'), 0);
    lifetime.onceSceneAdvance(scene, () => { calls += 1; });
    scene.events.emit('shutdown');
    scene.input.emit('pointerdown');
    assert.equal(calls, 1);
    assert.equal(scene.input.keyboard.eventNames().length, 0);
  });

  test('storage: a blocked localStorage getter does not break startup', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      /** Simulates a browser denying access to its storage property. */
      get() { throw new Error('blocked'); },
    });
    try {
      assert.equal(browserStorage.getLocalStorage(), null);
      assert.equal(debug.isStoredDebugModeEnabled(), false);
      assert.equal(notices.hasUnreadTitleNotice(), false);
      assert.doesNotThrow(() => debug.setStoredDebugModeEnabled(true));
    } finally {
      Object.defineProperty(window, 'localStorage', descriptor);
    }
  });

  test('storage: failed debug reads and writes are contained', () => {
    const original = window.localStorage;
    /** Simulates a storage operation rejected by the browser. */
    const reject = () => { throw new Error('storage unavailable'); };
    window.localStorage = { getItem: reject, setItem: reject, removeItem: reject };
    try {
      assert.equal(debug.isStoredDebugModeEnabled(), false);
      assert.doesNotThrow(() => debug.setStoredDebugModeEnabled(true));
      assert.doesNotThrow(() => debug.setStoredDebugModeEnabled(false));
    } finally {
      window.localStorage = original;
    }
  });

  test('story clone: nested editing data never aliases the source draft', () => {
    const draft = story.createDefaultStoryCreatorDraft();
    draft.pages[0].placements.push({
      kind: 'actor', side: 'left', x: 100, y: 200, scale: 1,
      flipX: false, motion: 'move', effect: 'none', actorId: 'trainer-haru',
      motionMove: story.createDefaultStoryCreatorMoveMotion(),
      textBox: story.createDefaultStoryCreatorTextBox(),
      shape: story.createDefaultStoryCreatorShape(),
    });
    const before = JSON.stringify(draft);
    const copy = story.cloneStoryCreatorDraft(draft);
    assert.deepEqual(copy, draft);
    copy.pages[0].speaker.kind = 'left';
    copy.pages[0].placements[0].motionMove.startX = 500;
    copy.pages[0].placements[0].textBox.lines[0].text = 'changed';
    copy.pages[0].placements[0].shape.points[0].x = 999;
    copy.pages[0].placements[0].shape.labels.push({ from: 0, to: 1, text: 'new', offset: 0 });
    assert.equal(JSON.stringify(draft), before);
  });

  for (const mode of ['choiceGrid', 'choiceRow', 'choiceColumn', 'multiSelect']) {
    test(`choice answers: ${mode} keeps unique options and its correct answer count`, () => {
      for (const answer of [0, 1, 9, 10, 18, 50]) {
        const problem = { left: answer, right: 0, result: answer, answer, operator: '+', answerSlot: 'result', answerMode: mode };
        const original = JSON.stringify(problem);
        const options = new choices.ChoiceAnswerGenerator(problem, 0, (items) => items).createOptions();
        assert.equal(options.length, 4);
        assert.equal(new Set(options.map((option) => option.label)).size, 4);
        assert.equal(options.filter((option) => option.isCorrect).length, mode === 'multiSelect' ? 2 : 1);
        assert.equal(JSON.stringify(problem), original);
      }
    });
  }

  test('choice answers: decimal choices preserve display precision and scoring', () => {
    const problem = { kind: 'decimal', left: 0.1, right: 0.2, result: 0.3, answer: 0.3, operator: '+', answerSlot: 'result', answerMode: 'choiceGrid', resultDecimalPlaces: 1 };
    const options = new choices.ChoiceAnswerGenerator(problem, 1, (items) => items).createOptions();
    assert.equal(options.length, 4);
    assert.deepEqual(options.filter((option) => option.isCorrect).map((option) => option.label), ['0.3']);
    assert.ok(options.every((option) => /^\d+\.\d$/.test(option.label)));
  });

  test('grid geometry: rectangle and painted groups share bounds without aliasing data', () => {
    const rectangle = { col: 2, row: 1, cols: 2, rows: 3 };
    const cells = geometry.getGridExpressionGroupCells(rectangle);
    assert.equal(cells.length, 6);
    assert.deepEqual(geometry.getGridExpressionGroupBounds(rectangle), { minCol: 2, minRow: 1, maxCol: 3, maxRow: 3 });
    const painted = { cells: [{ col: 4, row: 2 }, { col: 1, row: 5 }] };
    geometry.getGridExpressionGroupCells(painted)[0].col = 99;
    assert.equal(painted.cells[0].col, 4);
    assert.deepEqual(geometry.getGridExpressionGroupBounds(painted), { minCol: 1, minRow: 2, maxCol: 4, maxRow: 5 });
    assert.equal(geometry.getGridExpressionGroupBounds({}), undefined);
  });

  test('answer input: digit limits keep clock, hidden digit, and decimal behavior', () => {
    const base = { left: 1, right: 2, result: 3, answer: 3, operator: '+', answerSlot: 'result' };
    assert.equal(input.getCaptureAnswerMaxDigits(base), 2);
    assert.equal(input.getCaptureAnswerMaxDigits({ ...base, answer: 12345 }), 4);
    assert.equal(input.getCaptureAnswerMaxDigits({ ...base, kind: 'clockTime' }), 4);
    assert.equal(input.getCaptureAnswerMaxDigits({ ...base, kind: 'missingDigitArithmetic', hiddenDigitSlot: 'leftOnes' }), 1);
    assert.equal(input.getCaptureAnswerMaxDigits(base, 2), 7);
    assert.equal(input.getCaptureAnswerDecimalPlaces({ ...base, kind: 'decimal', resultDecimalPlaces: 2 }), 2);
  });
}
