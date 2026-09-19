// Development-only visual fixture: production entry points never import this module.
import * as Phaser from 'phaser';
import { stages } from '../../../data/stages';
import { APP_LAYOUT } from '../../layoutConfig';
import { createProblem, formatProblemAnswer, usesChoiceAnswer, usesTwoPartAnswer } from '../../problem/mathProblems';
import { getChoiceCardLayout } from './choiceCardLayout';
import { CaptureGameScene } from '../../scenes/capture/CaptureGameScene';
import type { ConfigurableProblemRule, MathProblem, StageDefinition } from '../../types';
import type { CaptureProblemView } from './CaptureProblemView';

if (!import.meta.env.DEV) throw new Error('The layout preview requires the development server.');

// This test adapter exercises the real scene without adding test hooks to production code.
interface PreviewAccess {
  problem: MathProblem;
  stage: StageDefinition;
  keypadContainer?: Phaser.GameObjects.Container;
  problemView: CaptureProblemView;
  answerInput: string;
  remainderAnswerInput: string;
  activeDivisionAnswerPart: 'quotient' | 'remainder';
  selectedChoiceIds: Set<string>;
  isBusy: boolean;
  feedbackText: Phaser.GameObjects.Text;
  choiceControlsContainer: Phaser.GameObjects.Container;
  startEncounterIntro(): void;
  showNextProblem(): void;
  handleCorrectAnswer(): void;
  renderProblem(): void;
  renderAnswerControls(): void;
  updateAnswerText(): void;
  showCorrectMark(): void;
  setFeedbackMessage(message: string): void;
}

interface PreviewCase { label: string; rule: ConfigurableProblemRule; }
const cases: PreviewCase[] = [];
const seen = new Set<string>();
for (const stage of stages) {
  if (typeof stage.problemRule === 'string') continue;
  for (const rule of Array.isArray(stage.problemRule) ? stage.problemRule : [stage.problemRule]) {
    const label = [rule.kind ?? 'integer', rule.rootMode, rule.answerMode ?? 'single', rule.answerSlot ?? 'result', rule.clockDisplayMode].filter(Boolean).join(' / ');
    if (seen.has(label)) continue;
    seen.add(label);
    cases.push({ label, rule });
  }
}

const select = document.querySelector<HTMLSelectElement>('#case')!;
const status = document.querySelector<HTMLElement>('#status')!;
const regionToggle = document.querySelector<HTMLInputElement>('#regions')!;
cases.forEach((entry, index) => select.add(new Option(`${index + 1}. ${entry.label}`, String(index))));
const scene = new CaptureGameScene();
const access = scene as unknown as PreviewAccess;
let guides: Phaser.GameObjects.Graphics | undefined;
let current: MathProblem;
const boundsIssues: string[] = [];

/** Uses legal two-digit slot input when inspecting pair-answer layouts. */
function fillAnswer(): void {
  access.answerInput = usesTwoPartAnswer(current) ? '12' : String(current.answer);
  access.remainderAnswerInput = '59';
  access.updateAnswerText();
}

/** Walks display containers so the audit can inspect the actual rendered text. */
function collectTexts(objects: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text[] {
  return objects.flatMap((object) => object instanceof Phaser.GameObjects.Text ? [object]
    : object instanceof Phaser.GameObjects.Container ? collectTexts(object.list) : []);
}

/** Checks text bounds against the region used by this problem and its choices. */
function inspectLayout(): string[] {
  const regions = APP_LAYOUT.captureGame.regions;
  const region = current.kind === 'gridExpression' ? regions.gridQuestion
    : usesChoiceAnswer(current) ? regions.choiceQuestion : regions.question;
  const view = access.problemView;
  const questionObjects = view.gridProblemLayer ? [view.gridProblemLayer]
    : [view.equationContainer, view.answerText, ...(view.remainderAnswerText ? [view.remainderAnswerText] : [])];
  const issues: string[] = [];
  for (const text of collectTexts(questionObjects)) {
    if (!text.text || !text.visible) continue;
    const box = text.getBounds();
    if (box.left < region.x - 1 || box.right > region.x + region.width + 1 || box.top < region.y - 1 || box.bottom > region.y + region.height + 1) {
      issues.push(`${text.text}: (${box.x.toFixed(1)}, ${box.y.toFixed(1)}, ${box.width.toFixed(1)}, ${box.height.toFixed(1)})`);
    }
  }
  for (const object of access.choiceControlsContainer.list) {
    if (!(object instanceof Phaser.GameObjects.Container)) continue;
    for (const text of collectTexts(object.list)) {
      const box = text.getBounds();
      if (box.top < regions.choices.y || box.bottom > regions.choiceActions.y + regions.choiceActions.height
        || box.left < 20 || box.right > 370) issues.push(`Choice: ${text.text}`);
    }
  }
  return issues;
}

/** Draws non-interactive guides over the same coordinates used by the game. */
function drawGuides(): void {
  guides?.destroy();
  guides = scene.add.graphics().setDepth(100);
  if (!regionToggle.checked) return;
  const regions = APP_LAYOUT.captureGame.regions;
  const question = current.kind === 'gridExpression' ? regions.gridQuestion
    : usesChoiceAnswer(current) ? regions.choiceQuestion : regions.question;
  for (const region of [question, usesChoiceAnswer(current) ? regions.choices : regions.keypad, regions.feedback]) {
    guides.lineStyle(1, 0xe14574, 0.8);
    guides.strokeRect(region.x, region.y, region.width, region.height);
  }
}

/** Renders a real generated question, bypassing encounter, reward and save operations. */
function showCase(): void {
  try {
    current = createProblem(cases[Number(select.value)].rule);
    access.stage = { ...access.stage, problemRule: cases[Number(select.value)].rule };
    access.keypadContainer?.destroy(true);
    access.keypadContainer = undefined;
    access.problem = current;
    access.answerInput = '';
    access.remainderAnswerInput = '';
    access.activeDivisionAnswerPart = 'quotient';
    access.selectedChoiceIds.clear();
    access.isBusy = false;
    access.renderProblem();
    access.renderAnswerControls();
    access.feedbackText.setText('');
    drawGuides();
    const issues = inspectLayout();
    status.textContent = `${select.selectedOptions[0].text}\n${issues.length ? issues.join('\n') : 'Text bounds: OK'}`;
  } catch (error) {
    status.textContent = `ERROR: ${String(error)}`;
    throw error;
  }
}

access.startEncounterIntro = showCase;
access.showNextProblem = showCase;
/** Shows the real correct mark without awarding captures or consuming inventory. */
access.handleCorrectAnswer = (): void => {
  access.showCorrectMark();
  access.isBusy = false;
};

/** Moves the fixture selector and redraws the real question controls. */
function moveCase(delta: number): void {
  select.value = String((Number(select.value) + delta + cases.length) % cases.length);
  showCase();
}

select.addEventListener('change', showCase);
document.querySelector('#next')!.addEventListener('click', () => moveCase(1));
document.querySelector('#previous')!.addEventListener('click', () => moveCase(-1));
regionToggle.addEventListener('change', drawGuides);
/** Fills answer slots to expose bounds that are invisible when the input is empty. */
document.querySelector('#fill')!.addEventListener('click', () => {
  fillAnswer();
  status.textContent = inspectLayout().join('\n') || 'Filled text bounds: OK';
});
document.querySelector('#feedback')!.addEventListener('click', () => access.setFeedbackMessage(`こたえは ${formatProblemAnswer(current)}`));
/** Samples every configured display path and reports visible text outside its region. */
document.querySelector('#audit')!.addEventListener('click', () => {
  boundsIssues.length = 0;
  const original = select.value;
  cases.forEach((entry, index) => {
    select.value = String(index);
    for (let sample = 0; sample < 3; sample += 1) {
      showCase();
      fillAnswer();
      access.setFeedbackMessage(`こたえは ${formatProblemAnswer(current)}`);
      boundsIssues.push(...inspectLayout().map((issue) => `${entry.label}: ${issue}`));
      const feedback = access.feedbackText.getBounds();
      const region = APP_LAYOUT.captureGame.regions.feedback;
      if (feedback.top < region.y || feedback.bottom > region.y + region.height) {
        boundsIssues.push(`${entry.label}: feedback overflow`);
      }
    }
  });
  select.value = original;
  showCase();
  const words = getChoiceCardLayout(scene, ['センチメートル', 'ミリメートル', 'ミリリットル', 'デシリットル'], 'choiceGrid');
  status.textContent = `${cases.length} cases × 3 samples (filled + feedback)\n${boundsIssues.length ? boundsIssues.join('\n') : 'Text bounds: OK'}\nWord choices: ${words.width}px × ${words.height}px / ${words.fontSize}px`;
});

new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#fffaf0',
  scale: { mode: Phaser.Scale.FIT, width: 390, height: 844, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene], audio: { noAudio: true },
});
