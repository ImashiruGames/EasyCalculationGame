export type StoryCreatorActorMotion = 'none' | 'bounce' | 'sway' | 'twitch' | 'slide';
export type StoryCreatorActorEffect = 'none' | 'glow' | 'shrink' | 'grow' | 'silhouette';
export type StoryCreatorSide = 'left' | 'right';
export type StoryCreatorSpeakerKind = 'narration' | 'left' | 'right' | 'actor';
export type StoryCreatorPlacementKind = 'actor' | 'textBox' | 'shape';
export type StoryCreatorTextAlign = 'left' | 'center' | 'right';

export interface StoryCreatorSpeaker {
  kind: StoryCreatorSpeakerKind;
  actorId?: string;
}

export interface StoryCreatorTextLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  color: string;
  align: StoryCreatorTextAlign;
}

export interface StoryCreatorTextBox {
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  lines: StoryCreatorTextLine[];
}

export interface StoryCreatorShapePoint {
  x: number;
  y: number;
}

export interface StoryCreatorShapeLabel {
  from: number;
  to: number;
  text: string;
  offset: number;
}

export interface StoryCreatorShape {
  points: StoryCreatorShapePoint[];
  closed: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  labels: StoryCreatorShapeLabel[];
}

export interface StoryCreatorPlacement {
  kind: StoryCreatorPlacementKind;
  actorId?: string;
  side: StoryCreatorSide;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
  motion: StoryCreatorActorMotion;
  effect: StoryCreatorActorEffect;
  textBox?: StoryCreatorTextBox;
  shape?: StoryCreatorShape;
}

export interface StoryCreatorPage {
  text: string;
  speaker: StoryCreatorSpeaker;
  placements: StoryCreatorPlacement[];
  soundEffectId?: string;
}

export interface StoryCreatorDraft {
  id?: string;
  name: string;
  pages: StoryCreatorPage[];
  updatedAt: number;
}

export interface StoryCreatorSceneTemplate {
  id: string;
  name: string;
  page: StoryCreatorPage;
  updatedAt: number;
}

interface StoredStoryCreatorDrafts {
  version: 1;
  drafts: StoryCreatorDraft[];
}

interface StoredStoryCreatorSceneTemplates {
  version: 1;
  templates: StoryCreatorSceneTemplate[];
}

const STORAGE_KEY = 'story-creator-drafts-v1';
const SCENE_TEMPLATE_STORAGE_KEY = 'story-creator-scene-templates-v1';
const DEFAULT_DRAFT_NAME = 'お話1';
const DEFAULT_SCENE_TEMPLATE_NAME = 'シーン';
const MAX_DRAFT_COUNT = 20;
const MAX_SCENE_TEMPLATE_COUNT = 30;
const DEFAULT_TEXT_BOX_WIDTH = 164;
const DEFAULT_TEXT_BOX_HEIGHT = 220;

/** 空の解説ボックス用データを作ります。 */
export function createDefaultStoryCreatorTextBox(): StoryCreatorTextBox {
  return {
    width: DEFAULT_TEXT_BOX_WIDTH,
    height: DEFAULT_TEXT_BOX_HEIGHT,
    fillColor: '#ffffff',
    strokeColor: '#47647d',
    lines: [
      {
        text: 'せつめい',
        x: 0,
        y: 0,
        fontSize: 24,
        bold: true,
        color: '#263143',
        align: 'center',
      },
      {
        text: '',
        x: 0,
        y: 46,
        fontSize: 18,
        bold: false,
        color: '#263143',
        align: 'left',
      },
    ],
  };
}

/** ストーリー配置を、入れ子の行データまで含めて複製します。 */
/** さいしょにおく三点のずけいデータを作ります。 */
export function createDefaultStoryCreatorShape(): StoryCreatorShape {
  return {
    points: [
      { x: -64, y: 48 },
      { x: 64, y: 48 },
      { x: 20, y: -58 },
    ],
    closed: true,
    fillColor: '#fff1a8',
    strokeColor: '#263143',
    strokeWidth: 4,
    labels: [
      {
        from: 0,
        to: 1,
        text: '6cm',
        offset: 22,
      },
    ],
  };
}

export function cloneStoryCreatorPlacement(placement: StoryCreatorPlacement): StoryCreatorPlacement {
  const kind = placement.kind ?? (placement.textBox ? 'textBox' : placement.shape ? 'shape' : 'actor');
  return {
    ...placement,
    kind,
    textBox: placement.textBox
      ? {
        ...placement.textBox,
        lines: placement.textBox.lines.map((line) => ({ ...line })),
      }
      : undefined,
    shape: placement.shape
      ? {
        ...placement.shape,
        points: placement.shape.points.map((point) => ({ ...point })),
        labels: placement.shape.labels.map((label) => ({ ...label })),
      }
      : undefined,
  };
}

/** ストーリーの1ページを、配置や解説行まで含めて複製します。 */
export function cloneStoryCreatorPage(page: StoryCreatorPage): StoryCreatorPage {
  return {
    text: page.text,
    speaker: { ...(page.speaker ?? { kind: 'narration' }) },
    placements: page.placements.map((placement) => cloneStoryCreatorPlacement(placement)),
    soundEffectId: page.soundEffectId,
  };
}

/** 空のストーリーページを作ります。 */
export function createDefaultStoryCreatorPage(): StoryCreatorPage {
  return {
    text: '',
    speaker: { kind: 'narration' },
    placements: [],
    soundEffectId: undefined,
  };
}

/** 文章クリエイト用の初期データを作ります。 */
export function createDefaultStoryCreatorDraft(): StoryCreatorDraft {
  return {
    id: createStoryCreatorDraftId(),
    name: DEFAULT_DRAFT_NAME,
    pages: [createDefaultStoryCreatorPage()],
    updatedAt: Date.now(),
  };
}

/** 保存済みの名まえと重ならない新しい下書きを作ります。 */
export function createNextStoryCreatorDraft(): StoryCreatorDraft {
  const usedNames = new Set(loadStoryCreatorDrafts().map((draft) => draft.name));
  let index = 1;
  while (usedNames.has(`お話${index}`)) {
    index += 1;
  }

  return {
    ...createDefaultStoryCreatorDraft(),
    name: `お話${index}`,
  };
}

/** 保存済みの文章クリエイトデータをすべて読み込みます。 */
export function loadStoryCreatorDrafts(): StoryCreatorDraft[] {
  const storage = getLocalStorage();
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<StoredStoryCreatorDrafts> | null;
    if (!parsed || !Array.isArray(parsed.drafts)) {
      return [];
    }

    return parsed.drafts
      .map((draft) => normalizeDraft(draft))
      .filter((draft): draft is StoryCreatorDraft => Boolean(draft))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  } catch {
    return [];
  }
}

/** 最後に保存した文章クリエイトデータか、空のデータを返します。 */
export function loadLatestStoryCreatorDraft(): StoryCreatorDraft {
  return loadStoryCreatorDrafts()[0] ?? createDefaultStoryCreatorDraft();
}

/** 登録済みのシーンテンプレートをすべて読み込みます。 */
export function loadStoryCreatorSceneTemplates(): StoryCreatorSceneTemplate[] {
  const storage = getLocalStorage();
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(SCENE_TEMPLATE_STORAGE_KEY) ?? 'null') as Partial<StoredStoryCreatorSceneTemplates> | null;
    if (!parsed || !Array.isArray(parsed.templates)) {
      return [];
    }

    return parsed.templates
      .map((template) => normalizeSceneTemplate(template))
      .filter((template): template is StoryCreatorSceneTemplate => Boolean(template))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  } catch {
    return [];
  }
}

/** 文章クリエイトデータを名前つきでブラウザ内に保存します。 */
export function saveStoryCreatorDraft(draft: StoryCreatorDraft, previousName?: string): StoryCreatorDraft {
  const storage = getLocalStorage();
  const normalizedDraft = normalizeDraft({ ...draft, updatedAt: Date.now() }) ?? createDefaultStoryCreatorDraft();
  const savedDraft = {
    ...normalizedDraft,
    id: normalizedDraft.id ?? createStoryCreatorDraftId(),
    name: normalizedDraft.name.trim() || DEFAULT_DRAFT_NAME,
  };

  if (!storage) {
    return savedDraft;
  }

  const nextDrafts = [
    savedDraft,
    ...loadStoryCreatorDrafts().filter((existingDraft) => (
      !(savedDraft.id && existingDraft.id === savedDraft.id)
      && existingDraft.name !== savedDraft.name
      && existingDraft.name !== previousName
    )),
  ].slice(0, MAX_DRAFT_COUNT);

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, drafts: nextDrafts }));
  } catch {
    return savedDraft;
  }

  return savedDraft;
}

/** 今の1ページをシーンテンプレートとして登録します。 */
export function saveStoryCreatorSceneTemplate(page: StoryCreatorPage, name?: string): StoryCreatorSceneTemplate {
  const storage = getLocalStorage();
  const templates = loadStoryCreatorSceneTemplates();
  const template: StoryCreatorSceneTemplate = {
    id: createStoryCreatorTemplateId(),
    name: getSceneTemplateName(templates, name),
    page: cloneStoryCreatorPage(page),
    updatedAt: Date.now(),
  };

  if (!storage) {
    return template;
  }

  try {
    storage.setItem(
      SCENE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({ version: 1, templates: [template, ...templates].slice(0, MAX_SCENE_TEMPLATE_COUNT) }),
    );
  } catch {
    return template;
  }

  return template;
}

/** 指定した名まえの文章クリエイトデータを削除します。 */
/** JSON文字列からストーリー下書きを読み出します。 */
export function importStoryCreatorDraftFromJsonText(jsonText: string, fallbackName?: string): StoryCreatorDraft | null {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const importedDraft = normalizeDraft(getImportDraftCandidate(parsed));
    if (!importedDraft) {
      return null;
    }

    return {
      ...importedDraft,
      id: importedDraft.id ?? createStoryCreatorDraftId(),
      name: getImportDraftName(importedDraft.name, fallbackName),
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/** 指定した名前のストーリー下書きを削除します。 */
/** ストーリー下書きをJSONファイル用の文字列へ変えます。 */
export function exportStoryCreatorDraftToJsonText(draft: StoryCreatorDraft): string {
  const normalizedDraft = normalizeDraft(draft) ?? createDefaultStoryCreatorDraft();
  const exportDraft = {
    ...normalizedDraft,
    id: normalizedDraft.id ?? createStoryCreatorDraftId(),
  };

  return JSON.stringify({
    version: 1,
    story: exportDraft,
  }, null, 2);
}

/** 指定した名前のストーリー下書きを削除します。 */
export function deleteStoryCreatorDraft(name: string): StoryCreatorDraft[] {
  const storage = getLocalStorage();
  const nextDrafts = loadStoryCreatorDrafts().filter((draft) => draft.name !== name);
  if (!storage) {
    return nextDrafts;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, drafts: nextDrafts }));
  } catch {
    return nextDrafts;
  }

  return nextDrafts;
}

/** 指定したシーンテンプレートを削除します。 */
export function deleteStoryCreatorSceneTemplate(id: string): StoryCreatorSceneTemplate[] {
  const storage = getLocalStorage();
  const nextTemplates = loadStoryCreatorSceneTemplates().filter((template) => template.id !== id);
  if (!storage) {
    return nextTemplates;
  }

  try {
    storage.setItem(SCENE_TEMPLATE_STORAGE_KEY, JSON.stringify({ version: 1, templates: nextTemplates }));
  } catch {
    return nextTemplates;
  }

  return nextTemplates;
}

/** localStorageを安全に取り出します。 */
/** ストーリーを内部から呼び出すためのIDを作ります。 */
function createStoryCreatorDraftId(): string {
  return `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** シーンテンプレートを内部で管理するためのIDを作ります。 */
function createStoryCreatorTemplateId(): string {
  return `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** localStorageを安全に取り出します。 */
function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 外部から読んだ下書きデータを使える形へ整えます。 */
function normalizeDraft(value: unknown): StoryCreatorDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  const pages = Array.isArray(value.pages)
    ? value.pages.map((page) => normalizePage(page)).filter((page): page is StoryCreatorPage => Boolean(page))
    : [];

  return {
    ...(typeof value.id === 'string' && value.id.trim() ? { id: value.id.trim() } : {}),
    name: typeof value.name === 'string' && value.name.trim() ? value.name : DEFAULT_DRAFT_NAME,
    pages: pages.length ? pages : [createDefaultStoryCreatorPage()],
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

/** 外部から読んだページデータを使える形へ整えます。 */
/** JSONの包み方が違っても下書き本体を取り出します。 */
function getImportDraftCandidate(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if (isRecord(value.draft)) {
    return value.draft;
  }

  if (isRecord(value.story)) {
    return value.story;
  }

  if (Array.isArray(value.drafts)) {
    return value.drafts[0] ?? null;
  }

  return value;
}

/** 保存済みテンプレートと重ならないシーンテンプレート名を決めます。 */
function getSceneTemplateName(templates: StoryCreatorSceneTemplate[], name?: string): string {
  const trimmedName = name?.trim().slice(0, 12) ?? '';
  if (trimmedName) {
    return trimmedName;
  }

  const usedNames = new Set(templates.map((template) => template.name));
  let index = 1;
  while (usedNames.has(`${DEFAULT_SCENE_TEMPLATE_NAME}${index}`)) {
    index += 1;
  }

  return `${DEFAULT_SCENE_TEMPLATE_NAME}${index}`;
}

/** JSON読み込み時に使う下書き名を決めます。 */
function getImportDraftName(importedName: string, fallbackName?: string): string {
  if (importedName.trim() && importedName !== DEFAULT_DRAFT_NAME) {
    return importedName.trim();
  }

  const trimmedFallbackName = fallbackName?.trim() ?? '';
  return trimmedFallbackName ? trimmedFallbackName.slice(0, 10) : importedName;
}

/** 外部から読んだページデータを使える形へ整えます。 */
function normalizePage(value: unknown): StoryCreatorPage | null {
  if (!isRecord(value)) {
    return null;
  }

  const placements = Array.isArray(value.placements)
    ? value.placements
      .map((placement) => normalizePlacement(placement))
      .filter((placement): placement is StoryCreatorPlacement => Boolean(placement))
    : [];

  return {
    text: typeof value.text === 'string' ? value.text : '',
    speaker: normalizeSpeaker(value.speaker),
    placements: dedupePlacementsBySide(placements),
    ...(typeof value.soundEffectId === 'string' && value.soundEffectId.trim()
      ? { soundEffectId: value.soundEffectId.trim() }
      : {}),
  };
}

/** 外部から読んだシーンテンプレートを使える形へ整えます。 */
function normalizeSceneTemplate(value: unknown): StoryCreatorSceneTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  const page = normalizePage(value.page);
  if (!page) {
    return null;
  }

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : createStoryCreatorTemplateId(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name : DEFAULT_SCENE_TEMPLATE_NAME,
    page,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

/** 外部から読んだ話者データを使える形へ整えます。 */
function normalizeSpeaker(value: unknown): StoryCreatorSpeaker {
  if (!isRecord(value)) {
    return { kind: 'narration' };
  }

  if (value.kind === 'narration' || value.kind === 'left' || value.kind === 'right') {
    return { kind: value.kind };
  }

  if (value.kind === 'actor' && typeof value.actorId === 'string') {
    return {
      kind: 'actor',
      actorId: value.actorId,
    };
  }

  return { kind: 'narration' };
}

/** 外部から読んだキャラ配置を使える形へ整えます。 */
function normalizePlacement(value: unknown): StoryCreatorPlacement | null {
  if (!isRecord(value)) {
    return null;
  }

  const isTextBox = value.kind === 'textBox' || isRecord(value.textBox);
  const isShape = value.kind === 'shape' || isRecord(value.shape);
  const textBox = isTextBox ? normalizeTextBox(value.textBox) : undefined;
  const shape = isShape ? normalizeShape(value.shape) : undefined;
  if (!isTextBox && !isShape && typeof value.actorId !== 'string') {
    return null;
  }

  return {
    kind: isShape ? 'shape' : isTextBox ? 'textBox' : 'actor',
    ...(typeof value.actorId === 'string' ? { actorId: value.actorId } : {}),
    side: getSafeSide(value.side, value.x),
    x: typeof value.x === 'number' ? value.x : isShape ? 195 : isTextBox ? 230 : 100,
    y: typeof value.y === 'number' ? value.y : isShape ? 330 : isTextBox ? 330 : 430,
    scale: typeof value.scale === 'number' ? value.scale : 1,
    flipX: typeof value.flipX === 'boolean' ? value.flipX : false,
    motion: getSafeMotion(value.motion),
    effect: getSafeEffect(value.effect),
    ...(textBox ? { textBox } : {}),
    ...(shape ? { shape } : {}),
  };
}

/** 外部から読んだ解説ボックスを使える形へ整えます。 */
function normalizeTextBox(value: unknown): StoryCreatorTextBox {
  const fallback = createDefaultStoryCreatorTextBox();
  if (!isRecord(value)) {
    return fallback;
  }

  const lines = Array.isArray(value.lines)
    ? value.lines.map((line) => normalizeTextLine(line)).filter((line): line is StoryCreatorTextLine => Boolean(line))
    : [];

  return {
    width: clampNumber(value.width, 96, 300, fallback.width),
    height: clampNumber(value.height, 86, 330, fallback.height),
    fillColor: typeof value.fillColor === 'string' ? value.fillColor : fallback.fillColor,
    strokeColor: typeof value.strokeColor === 'string' ? value.strokeColor : fallback.strokeColor,
    lines: lines.length ? lines : fallback.lines,
  };
}

/** 外部から読んだ解説の1行を使える形へ整えます。 */
/** そとからきたずけいデータを、つかえる形にそろえます。 */
function normalizeShape(value: unknown): StoryCreatorShape {
  const fallback = createDefaultStoryCreatorShape();
  if (!isRecord(value)) {
    return fallback;
  }

  const points = Array.isArray(value.points)
    ? value.points.map((point) => normalizeShapePoint(point)).filter((point): point is StoryCreatorShapePoint => Boolean(point))
    : [];
  const safePoints = points.length >= 2 ? points.slice(0, 12) : fallback.points;
  const labels = Array.isArray(value.labels)
    ? value.labels
      .map((label) => normalizeShapeLabel(label, safePoints.length))
      .filter((label): label is StoryCreatorShapeLabel => Boolean(label))
    : [];

  return {
    points: safePoints,
    closed: typeof value.closed === 'boolean' ? value.closed : safePoints.length >= 3,
    fillColor: typeof value.fillColor === 'string' ? value.fillColor : fallback.fillColor,
    strokeColor: typeof value.strokeColor === 'string' ? value.strokeColor : fallback.strokeColor,
    strokeWidth: clampNumber(value.strokeWidth, 1, 10, fallback.strokeWidth),
    labels,
  };
}

/** そとからきた点データを、がめん内でつかいやすい数にそろえます。 */
function normalizeShapePoint(value: unknown): StoryCreatorShapePoint | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    x: clampNumber(value.x, -180, 180, 0),
    y: clampNumber(value.y, -240, 240, 0),
  };
}

/** そとからきた線ラベルを、ある点どうしだけをつなぐ形にそろえます。 */
function normalizeShapeLabel(value: unknown, pointCount: number): StoryCreatorShapeLabel | null {
  if (!isRecord(value) || pointCount < 2) {
    return null;
  }

  const from = Math.floor(clampNumber(value.from, 0, pointCount - 1, 0));
  const to = Math.floor(clampNumber(value.to, 0, pointCount - 1, (from + 1) % pointCount));
  if (from === to) {
    return null;
  }

  return {
    from,
    to,
    text: typeof value.text === 'string' ? value.text : '',
    offset: clampNumber(value.offset, -80, 80, 22),
  };
}

function normalizeTextLine(value: unknown): StoryCreatorTextLine | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    text: typeof value.text === 'string' ? value.text : '',
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    fontSize: clampNumber(value.fontSize, 10, 42, 18),
    bold: typeof value.bold === 'boolean' ? value.bold : false,
    color: typeof value.color === 'string' ? value.color : '#263143',
    align: getSafeTextAlign(value.align),
  };
}

/** 数値を指定範囲に収め、数値でない時は初期値を返します。 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number'
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** 同じ側に重なった配置は最後の一つだけ残します。 */
function dedupePlacementsBySide(placements: StoryCreatorPlacement[]): StoryCreatorPlacement[] {
  const placementBySide = new Map<StoryCreatorSide, StoryCreatorPlacement>();
  placements.forEach((placement) => {
    placementBySide.set(placement.side, placement);
  });

  return Array.from(placementBySide.values());
}

/** 配置データの側指定を読み、ない時はx座標から左右を決めます。 */
function getSafeSide(value: unknown, x: unknown): StoryCreatorSide {
  if (value === 'left' || value === 'right') {
    return value;
  }

  return typeof x === 'number' && x > 195 ? 'right' : 'left';
}

/** 動きの指定が使える値か調べ、使えない時はなしにします。 */
function getSafeMotion(value: unknown): StoryCreatorActorMotion {
  if (value === 'bounce' || value === 'sway' || value === 'twitch' || value === 'slide') {
    return value;
  }

  return 'none';
}

/** 行ぞろえの指定が使える値か調べ、使えない時は左にします。 */
function getSafeTextAlign(value: unknown): StoryCreatorTextAlign {
  if (value === 'center' || value === 'right') {
    return value;
  }

  return 'left';
}

/** エフェクトの指定が使える値か調べ、使えない時はなしにします。 */
function getSafeEffect(value: unknown): StoryCreatorActorEffect {
  if (value === 'glow' || value === 'shrink' || value === 'grow' || value === 'silhouette') {
    return value;
  }

  return 'none';
}

/** unknown値がオブジェクトとして読めるか調べます。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
