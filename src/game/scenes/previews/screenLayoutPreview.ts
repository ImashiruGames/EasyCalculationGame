import * as Phaser from 'phaser';
import type { PreviewProfile } from './screenLayoutFixtures';
import type { ScreenLayoutCase } from './screenLayoutCases';

/** Supplies a complete Storage implementation whose data lasts only for this page. */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    /** Counts the sample keys currently held in memory. */
    get length(): number { return entries.size; },
    /** Clears only the sample entries. */
    clear(): void { entries.clear(); },
    /** Reads a sample value without accessing browser storage. */
    getItem(key: string): string | null { return entries.get(String(key)) ?? null; },
    /** Returns a sample key by insertion order. */
    key(index: number): string | null { return Array.from(entries.keys())[index] ?? null; },
    /** Removes a sample entry. */
    removeItem(key: string): void { entries.delete(String(key)); },
    /** Writes a sample value only to this page's memory. */
    setItem(key: string, value: string): void { entries.set(String(key), String(value)); },
  };
}

/** Fails closed before importing any game module that could read or write a save. */
function installPreviewStorage(): void {
  if (!import.meta.env.DEV) throw new Error('This preview is available only in the development server.');
  const memory = createMemoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: createMemoryStorage() });
  if (window.localStorage !== memory) throw new Error('Could not isolate preview storage.');
  memory.setItem('one-digit-capture-game-bgm-volume-v1', '0');
}

/** Gets a required control and reports HTML/entry-point mismatches early. */
function getControl<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing preview control: ${id}`);
  return element as T;
}

/** Collects visible canvas text, retaining parent visibility and alpha. */
function collectVisibleTexts(objects: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text[] {
  const texts: Phaser.GameObjects.Text[] = [];
  for (const object of objects) {
    if (object instanceof Phaser.GameObjects.Container) {
      if (object.visible && object.alpha > 0) texts.push(...collectVisibleTexts(object.list));
    } else if (object instanceof Phaser.GameObjects.Text && object.visible && object.alpha > 0 && object.text.trim()) {
      texts.push(object);
    }
  }
  return texts;
}

/** Reloads a selected sample so timers, DOM inputs, audio and temporary saves start cleanly. */
function navigateCase(id: string, profile: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('screen', id);
  url.searchParams.set('profile', profile);
  url.searchParams.set('debug', '1');
  window.location.assign(url);
}

/** Renders the selected case's code-based review notes next to its real scene. */
function showCaseNotes(entry: ScreenLayoutCase): void {
  getControl('title').textContent = `${entry.id} ${entry.title}`;
  getControl('steps').textContent = entry.steps;
  getControl('source').textContent = entry.source.startsWith('ui/')
    ? `src/game/${entry.source}` : `src/game/scenes/${entry.source}`;
  getControl('notes').replaceChildren(...entry.notes.map(note => {
    const item = document.createElement('li');
    item.textContent = note;
    return item;
  }));
}

/** Boots the isolated game and wires a manual, numbered screen review page. */
async function startPreview(): Promise<void> {
  installPreviewStorage();
  // Dynamic imports are essential: scene fields and data modules can read storage during import/construction.
  const { layoutSceneTypes, createScreenLayoutCases, seedLayoutFixtures, prepareLayoutCase, openLayoutCase } = await import('./screenLayoutCases');
  const { cancelImageAssetWarmup } = await import('../../assets/assetWarmup');
  const { disposeAudio } = await import('../../bgm');
  const params = new URLSearchParams(window.location.search);
  const profile: PreviewProfile = params.get('profile') === 'long' ? 'long' : params.get('profile') === 'empty' ? 'empty' : 'standard';
  seedLayoutFixtures(profile);
  const cases = createScreenLayoutCases(profile);
  const entry = cases.find(item => item.id === params.get('screen')) ?? cases[1];
  const select = getControl<HTMLSelectElement>('screen');
  const profileSelect = getControl<HTMLSelectElement>('profile');
  cases.forEach(item => select.add(new Option(`${item.id} ${item.title}`, item.id)));
  select.value = entry.id;
  profileSelect.value = profile;
  showCaseNotes(entry);
  let game: Phaser.Game;
  let guides: Phaser.GameObjects.Graphics | undefined;
  let pausedSceneKeys: string[] = [];

  /** Takes an on-demand text snapshot; overlapping panels still require visual inspection. */
  function inspectCurrentScreen(): void {
    guides?.destroy();
    guides = undefined;
    const scenes = game.scene.getScenes(true).filter(scene => scene.sys.settings.key !== 'LayoutPreviewBoot');
    for (const key of pausedSceneKeys) {
      const scene = game.scene.getScene(key);
      if (scene && !scenes.includes(scene)) scenes.push(scene);
    }
    const list = getControl('text-list');
    list.replaceChildren();
    let outsideCount = 0;
    let textCount = 0;
    const topScene = scenes[scenes.length - 1];
    if (topScene && getControl<HTMLInputElement>('guides').checked) {
      guides = topScene.add.graphics().setDepth(10000);
    }
    for (const scene of scenes) {
      for (const text of collectVisibleTexts(scene.children.list)) {
        const bounds = text.getBounds();
        const outside = bounds.left < -1 || bounds.top < -1 || bounds.right > 391 || bounds.bottom > 845;
        if (outside) outsideCount += 1;
        textCount += 1;
        if (guides) {
          guides.lineStyle(1, outside ? 0xd72c40 : 0x1976d2, 0.8);
          guides.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
        const item = document.createElement('li');
        item.textContent = `${outside ? '画めん外 ' : ''}${text.text.replace(/\n/g, ' / ')} — x${Math.round(bounds.x)} y${Math.round(bounds.y)} / ${Math.round(bounds.width)}×${Math.round(bounds.height)}`;
        list.append(item);
      }
    }
    getControl('status').textContent = `Scene: ${scenes.map(scene => scene.sys.settings.key).join(', ')}\n文字 ${textCount}こ / 画めん外 ${outsideCount}こ\nかさなり・パネル内のはみ出しは目でチェック`;
  }

  /** Starts the chosen scene after all scene constructors have been registered. */
  class LayoutPreviewBoot extends Phaser.Scene {
    /** Registers a non-product boot scene for this entry point only. */
    constructor() { super('LayoutPreviewBoot'); }
    /** Attaches the case adapter and launches the production scene with sample data. */
    create(): void {
      const target = this.scene.get(entry.scene);
      prepareLayoutCase(target, entry);
      target.events.once(Phaser.Scenes.Events.CREATE, () => {
        openLayoutCase(target, entry);
        requestAnimationFrame(() => inspectCurrentScreen());
      });
      this.scene.start(entry.scene, entry.data);
    }
  }

  game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#fffaf0',
    fps: { target: 30, limit: 30 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 390, height: 844 },
    scene: [LayoutPreviewBoot, ...layoutSceneTypes],
  });
  game.events.once(Phaser.Core.Events.DESTROY, () => { cancelImageAssetWarmup(); disposeAudio(); });
  select.addEventListener('change', () => navigateCase(select.value, profileSelect.value));
  profileSelect.addEventListener('change', () => navigateCase(select.value, profileSelect.value));
  getControl('reset').addEventListener('click', () => navigateCase(entry.id, profile));
  for (const [id, delta] of [['previous', -1], ['next', 1]] as const) {
    getControl(id).addEventListener('click', () => {
      const index = (cases.indexOf(entry) + delta + cases.length) % cases.length;
      navigateCase(cases[index].id, profile);
    });
  }
  getControl('inspect').addEventListener('click', inspectCurrentScreen);
  getControl('guides').addEventListener('change', inspectCurrentScreen);
  getControl('pause').addEventListener('click', () => {
    if (pausedSceneKeys.length) {
      pausedSceneKeys.forEach(key => game.scene.resume(key));
      pausedSceneKeys = [];
    } else {
      pausedSceneKeys = game.scene.getScenes(true).map(scene => scene.sys.settings.key);
      pausedSceneKeys.forEach(key => game.scene.pause(key));
    }
    getControl('pause').textContent = pausedSceneKeys.length ? 'うごかす' : 'うごきを止める';
    inspectCurrentScreen();
  });
  if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
}

/** Keeps startup failures visible in the review panel instead of leaving a blank canvas. */
function showPreviewError(error: unknown): void {
  getControl('status').textContent = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
}

window.addEventListener('error', event => showPreviewError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => showPreviewError(event.reason));
void startPreview().catch(showPreviewError);
