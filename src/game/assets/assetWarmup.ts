import type * as Phaser from 'phaser';

export interface ImageWarmupAsset {
  key: string;
  path: string;
}

interface QueuedWarmupAsset extends ImageWarmupAsset {
  gapMs: number;
}

interface ImageWarmupOptions {
  startDelayMs?: number;
  gapMs?: number;
  maxAssets?: number;
}

const DEFAULT_START_DELAY_MS = 900;
const DEFAULT_GAP_MS = 550;
const HIDDEN_TAB_RETRY_MS = 2000;

const warmedAssetKeys = new Set<string>();
const queuedAssetKeys = new Set<string>();
const warmupQueue: QueuedWarmupAsset[] = [];
let isRunning = false;
let timerId: ReturnType<typeof window.setTimeout> | null = null;

/** 次に使いそうな画像を少しずつ先読みし、画面遷移時の待ち時間を減らします。 */
export function scheduleImageAssetWarmup(
  scene: Phaser.Scene,
  assets: Iterable<ImageWarmupAsset | null | undefined>,
  options: ImageWarmupOptions = {},
): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (prefersReducedData()) {
    return;
  }

  const uniqueAssets = new Map<string, ImageWarmupAsset>();
  for (const asset of assets) {
    if (!asset || scene.textures.exists(asset.key)) {
      if (asset) {
        warmedAssetKeys.add(asset.key);
      }
      continue;
    }

    uniqueAssets.set(asset.key, asset);
  }

  const maxAssets = options.maxAssets ?? Number.POSITIVE_INFINITY;
  const gapMs = options.gapMs ?? DEFAULT_GAP_MS;
  [...uniqueAssets.values()].slice(0, maxAssets).forEach((asset) => {
    if (warmedAssetKeys.has(asset.key) || queuedAssetKeys.has(asset.key)) {
      return;
    }

    queuedAssetKeys.add(asset.key);
    warmupQueue.push({ ...asset, gapMs });
  });

  if (!isRunning && warmupQueue.length > 0) {
    scheduleNextWarmup(options.startDelayMs ?? DEFAULT_START_DELAY_MS);
  }
}

/** 連続読み込みで重くならないよう、次の先読みタイマーを予約します。 */
function scheduleNextWarmup(delayMs: number): void {
  if (timerId !== null) {
    return;
  }

  isRunning = true;
  timerId = window.setTimeout(() => {
    timerId = null;
    warmNextAsset();
  }, Math.max(0, delayMs));
}

/** キューの先頭画像を読み込み、終わったら次の画像へ進めます。 */
function warmNextAsset(): void {
  const asset = warmupQueue.shift();
  if (!asset) {
    isRunning = false;
    return;
  }

  queuedAssetKeys.delete(asset.key);
  if (warmedAssetKeys.has(asset.key)) {
    scheduleNextWarmup(asset.gapMs);
    return;
  }

  if (document.visibilityState === 'hidden') {
    queuedAssetKeys.add(asset.key);
    warmupQueue.unshift(asset);
    scheduleNextWarmup(HIDDEN_TAB_RETRY_MS);
    return;
  }

  const image = new Image();
  image.decoding = 'async';

  /** 成功・失敗どちらでも先読み済み扱いにして、キューを止めないようにします。 */
  const finish = (): void => {
    warmedAssetKeys.add(asset.key);
    scheduleNextWarmup(asset.gapMs);
  };

  image.onload = () => {
    const decodePromise = image.decode ? image.decode().catch(() => undefined) : Promise.resolve();
    void decodePromise.finally(finish);
  };
  image.onerror = finish;
  image.src = resolveAssetUrl(asset.path);
}

/** 相対パスを現在ページ基準のURLへ変換し、失敗時は元の文字列を使います。 */
function resolveAssetUrl(path: string): string {
  try {
    return new URL(path, window.location.href).toString();
  } catch {
    return path;
  }
}

/** 端末がデータ節約を希望している場合、先読みを控えるための判定を返します。 */
function prefersReducedData(): boolean {
  const navigatorWithConnection = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
    };
  };

  return Boolean(navigatorWithConnection.connection?.saveData);
}
