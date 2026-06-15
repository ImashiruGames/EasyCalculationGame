import { monsters } from '../../data/monsters';
import { stages } from '../../data/stages';
import { DEFAULT_TITLE_BACKGROUND_ID, titleBackgrounds } from '../../data/titleBackgrounds';
import { AppSaveState, TitleMonsterPlacementState } from '../../game/types';
import { createDefaultSaveState, getFragmentKey, STAGE_SPEED_STAR_TARGET_MS } from './constants';
import { normalizeSaveState } from './normalize';

export const TRANSFER_CODE_PREFIX = 'KMH1';

const LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_STAGE_MONSTERS = 1;
const TRANSFER_PAYLOAD_VERSION_WITHOUT_SPEED_STARS = 2;
const LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_SPEED_AVERAGES = 3;
const LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_CAPTURE_COUNTS = 4;
const LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_CAPTURE_FLAGS = 5;
const TRANSFER_PAYLOAD_VERSION = 6;

const monsterIds = monsters.map((monster) => monster.id);
const fragmentKeys = Array.from(new Set(monsters.map((monster) => monster.evolutionFamilyId)));
const stageIds = stages.map((stage) => stage.id);
const titleBackgroundIds = titleBackgrounds.map((background) => background.id);

const monsterIndexById = buildIndexMap(monsterIds);
const fragmentIndexByKey = buildIndexMap(fragmentKeys);
const stageIndexById = buildIndexMap(stageIds);
const titleBackgroundIndexById = buildIndexMap(titleBackgroundIds);

type TransferImportFailureStatus = 'badCode' | 'badChecksum' | 'badData' | 'saveFailed';

interface IndexedCountEntry {
  index: number;
  count: number;
}

interface TransferPayload {
  captures: Record<string, number>;
  fragments: Record<string, number>;
  stageCaptures: Record<string, number>;
  stageSpeedStars: Record<string, number>;
  ownedTitleBackgroundIds: string[];
  selectedTitleBackgroundId: string;
  unlockedDexStoryMonsterIds: string[];
}

export interface TransferSummary {
  captureKinds: number;
  titleBackgrounds: number;
  stages: number;
}

export type TransferImportResult =
  | {
      status: 'ok';
      state: AppSaveState;
      summary: TransferSummary;
    }
  | {
      status: TransferImportFailureStatus;
      state?: undefined;
      summary?: undefined;
    };

class ByteWriter {
  readonly bytes: number[] = [];

  /** 1バイトだけを保存用の配列へ追加します。 */
  writeByte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  /** 小さい数ほど短くなる可変長整数として書き込みます。 */
  writeVarint(value: number): void {
    let remaining = Math.max(0, Math.floor(value));
    do {
      let byte = remaining % 128;
      remaining = Math.floor(remaining / 128);
      if (remaining > 0) {
        byte |= 0x80;
      }
      this.writeByte(byte);
    } while (remaining > 0);
  }

  /** 書き込んだバイト列をUint8Arrayへ変換します。 */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

class ByteReader {
  private index = 0;

  /** 読み取り対象のバイト列を受け取って、先頭から読める状態にします。 */
  constructor(private readonly bytes: Uint8Array) {}

  /** 最後まで読み終わっているかを返します。 */
  get isDone(): boolean {
    return this.index >= this.bytes.length;
  }

  /** 次の1バイトを読み、末尾ならnullを返します。 */
  readByte(): number | null {
    if (this.index >= this.bytes.length) {
      return null;
    }

    const value = this.bytes[this.index];
    this.index += 1;
    return value;
  }

  /** 可変長整数を読み、途中で壊れていればnullを返します。 */
  readVarint(): number | null {
    let value = 0;
    let factor = 1;

    for (let index = 0; index < 5; index += 1) {
      const byte = this.readByte();
      if (byte === null) {
        return null;
      }

      value += (byte & 0x7f) * factor;
      if ((byte & 0x80) === 0) {
        return value;
      }

      factor *= 128;
    }

    return null;
  }
}

/** ID配列から、IDを短い番号へ変換するためのMapを作ります。 */
function buildIndexMap(values: string[]): Map<string, number> {
  return new Map(values.map((value, index) => [value, index]));
}

/** 引き継ぎ対象にできる正の整数だけを取り出します。 */
function getPositiveCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const count = Math.floor(value);
  return count > 0 ? count : null;
}

/** 個数レコードを、IDではなく番号と個数の並びに圧縮します。 */
function getIndexedCountEntries(
  record: Record<string, number>,
  indexByKey: ReadonlyMap<string, number>,
  normalizeKey: (key: string) => string | null = (key) => key,
): IndexedCountEntry[] {
  const merged = new Map<number, number>();
  for (const [rawKey, rawCount] of Object.entries(record)) {
    const count = getPositiveCount(rawCount);
    const key = normalizeKey(rawKey);
    if (count === null || key === null) {
      continue;
    }

    const index = indexByKey.get(key);
    if (index === undefined) {
      continue;
    }

    merged.set(index, (merged.get(index) ?? 0) + count);
  }

  return Array.from(merged, ([index, count]) => ({ index, count }))
    .sort((left, right) => left.index - right.index);
}

/** 番号つき個数一覧を、前回との差分と個数の列として書き込みます。 */
function writeIndexedCountEntries(writer: ByteWriter, entries: IndexedCountEntry[]): void {
  writer.writeVarint(entries.length);
  let previousIndex = 0;
  entries.forEach((entry) => {
    writer.writeVarint(entry.index - previousIndex);
    writer.writeVarint(entry.count);
    previousIndex = entry.index;
  });
}

/** 差分圧縮された個数一覧を読み、IDをキーにしたレコードへ戻します。 */
function readCountRecord(reader: ByteReader, keys: readonly string[]): Record<string, number> | null {
  const entryCount = reader.readVarint();
  if (entryCount === null || entryCount > keys.length) {
    return null;
  }

  const record: Record<string, number> = {};
  let previousIndex = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const delta = reader.readVarint();
    const count = reader.readVarint();
    if (
      delta === null
      || count === null
      || count <= 0
      || (entryIndex > 0 && delta <= 0)
    ) {
      return null;
    }

    const index = previousIndex + delta;
    const key = keys[index];
    if (!key) {
      return null;
    }

    record[key] = count;
    previousIndex = index;
  }

  return record;
}

/** かけらキーを進化系キーへそろえ、未知のキーは引き継ぎ対象外にします。 */
function normalizeFragmentKey(key: string): string | null {
  if (fragmentIndexByKey.has(key)) {
    return key;
  }

  if (monsterIndexById.has(key)) {
    return getFragmentKey(key);
  }

  return null;
}

/** 個数レコードを番号つき一覧へ変換してから書き込みます。 */
function writeCountRecord(
  writer: ByteWriter,
  record: Record<string, number>,
  indexByKey: ReadonlyMap<string, number>,
  normalizeKey?: (key: string) => string | null,
): void {
  writeIndexedCountEntries(writer, getIndexedCountEntries(record, indexByKey, normalizeKey));
}

/** 捕獲済みモンスターを、回数ではなく発見済みビット列として書き込みます。 */
function writeCaptureFlags(writer: ByteWriter, captures: Record<string, number>): void {
  let byteCount = 0;
  for (const [monsterId, count] of Object.entries(captures)) {
    const monsterIndex = monsterIndexById.get(monsterId);
    if (monsterIndex !== undefined && getPositiveCount(count) !== null) {
      byteCount = Math.max(byteCount, Math.floor(monsterIndex / 8) + 1);
    }
  }

  const bytes = Array.from({ length: byteCount }, () => 0);
  for (const [monsterId, count] of Object.entries(captures)) {
    const monsterIndex = monsterIndexById.get(monsterId);
    if (monsterIndex === undefined || getPositiveCount(count) === null) {
      continue;
    }

    const byteIndex = Math.floor(monsterIndex / 8);
    const bitIndex = monsterIndex % 8;
    bytes[byteIndex] |= 1 << bitIndex;
  }

  writer.writeVarint(bytes.length);
  bytes.forEach((byte) => writer.writeByte(byte));
}

/** 発見済みビット列を読み、捕獲済みモンスターを1回ずつのレコードへ戻します。 */
function readCaptureFlags(reader: ByteReader): Record<string, number> | null {
  const byteCount = reader.readVarint();
  const maxByteCount = Math.ceil(monsterIds.length / 8);
  if (byteCount === null || byteCount > maxByteCount) {
    return null;
  }

  const captures: Record<string, number> = {};
  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    const byte = reader.readByte();
    if (byte === null) {
      return null;
    }

    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      if ((byte & (1 << bitIndex)) === 0) {
        continue;
      }

      const monsterId = monsterIds[byteIndex * 8 + bitIndex];
      if (!monsterId) {
        return null;
      }

      captures[monsterId] = 1;
    }
  }

  return captures;
}

/** モンスターIDの一覧を、番号の差分として短く書き込みます。 */
function writeMonsterIdList(writer: ByteWriter, ids: readonly string[]): void {
  const indexes = Array.from(new Set(
    ids
      .map((monsterId) => monsterIndexById.get(monsterId))
      .filter((index): index is number => index !== undefined),
  )).sort((left, right) => left - right);

  writer.writeVarint(indexes.length);
  let previousIndex = 0;
  indexes.forEach((index) => {
    writer.writeVarint(index - previousIndex);
    previousIndex = index;
  });
}

/** 番号の差分として入っているモンスターID一覧を読み戻します。 */
function readMonsterIdList(reader: ByteReader): string[] | null {
  const entryCount = reader.readVarint();
  if (entryCount === null || entryCount > monsterIds.length) {
    return null;
  }

  const ids: string[] = [];
  let previousIndex = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const delta = reader.readVarint();
    if (delta === null || (entryIndex > 0 && delta <= 0)) {
      return null;
    }

    const index = previousIndex + delta;
    const monsterId = monsterIds[index];
    if (!monsterId) {
      return null;
    }

    ids.push(monsterId);
    previousIndex = index;
  }

  return ids;
}

/** QRに入れるステージクリア数を、実績にも使えるよう正の整数だけに整えます。 */
function getTransferStageCaptures(record: Record<string, number>): Record<string, number> {
  const normalizedRecord: Record<string, number> = {};
  for (const [stageId, count] of Object.entries(record)) {
    const positiveCount = getPositiveCount(count);
    if (positiveCount !== null) {
      normalizedRecord[stageId] = positiveCount;
    }
  }

  return normalizedRecord;
}

/** スピード星を達成済みのステージだけ、1のレコードとして作ります。 */
function getTransferStageSpeedStars(state: AppSaveState): Record<string, number> {
  const speedStars: Record<string, number> = {};
  for (const stage of stages) {
    if (state.stageSpeedStars[stage.id] === true) {
      speedStars[stage.id] = 1;
    }
  }

  return speedStars;
}

/** 旧形式の平均時間から、スピード星達成済みステージのレコードへ変換します。 */
function convertSpeedAveragesToStars(record: Record<string, number>): Record<string, number> {
  const speedStars: Record<string, number> = {};
  for (const stage of stages) {
    const averageMs = getPositiveCount(record[stage.id]);
    const targetMs = getPositiveCount(stage.speedStarAverageMs) ?? STAGE_SPEED_STAR_TARGET_MS;
    if (averageMs !== null && averageMs <= targetMs) {
      speedStars[stage.id] = 1;
    }
  }

  return speedStars;
}

/** スピード星レコードを、ローカル保存用の達成状態へ戻します。 */
function convertSpeedStarsToStateRecord(record: Record<string, number>): Record<string, boolean> {
  const speedStars: Record<string, boolean> = {};
  for (const stage of stages) {
    if (getPositiveCount(record[stage.id]) !== null) {
      speedStars[stage.id] = true;
    }
  }

  return speedStars;
}

/** ステージ別・モンスター別の捕獲数を、バイト列から復元します。 */
function readStageMonsterCaptures(reader: ByteReader): Record<string, Record<string, number>> | null {
  const groupCount = reader.readVarint();
  if (groupCount === null || groupCount > stageIds.length) {
    return null;
  }

  const record: Record<string, Record<string, number>> = {};
  let previousStageIndex = 0;
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const delta = reader.readVarint();
    if (delta === null || (groupIndex > 0 && delta <= 0)) {
      return null;
    }

    const stageIndex = previousStageIndex + delta;
    const stageId = stageIds[stageIndex];
    if (!stageId) {
      return null;
    }

    const captures = readCountRecord(reader, monsterIds);
    if (captures === null) {
      return null;
    }

    record[stageId] = captures;
    previousStageIndex = stageIndex;
  }

  return record;
}

/** 所持タイトル背景を、初期背景を除いた番号一覧として書き込みます。 */
function writeTitleBackgroundIds(writer: ByteWriter, backgroundIds: readonly string[]): void {
  const indexes = Array.from(new Set(
    backgroundIds
      .map((backgroundId) => titleBackgroundIndexById.get(backgroundId))
      .filter((index): index is number => index !== undefined && titleBackgroundIds[index] !== DEFAULT_TITLE_BACKGROUND_ID),
  )).sort((left, right) => left - right);

  writer.writeVarint(indexes.length);
  let previousIndex = 0;
  indexes.forEach((index) => {
    writer.writeVarint(index - previousIndex);
    previousIndex = index;
  });
}

/** 所持タイトル背景の番号一覧を読み、背景IDへ戻します。 */
function readTitleBackgroundIds(reader: ByteReader): string[] | null {
  const entryCount = reader.readVarint();
  if (entryCount === null || entryCount > titleBackgroundIds.length) {
    return null;
  }

  const backgroundIds: string[] = [];
  let previousIndex = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const delta = reader.readVarint();
    if (delta === null || (entryIndex > 0 && delta <= 0)) {
      return null;
    }

    const index = previousIndex + delta;
    const backgroundId = titleBackgroundIds[index];
    if (!backgroundId || backgroundId === DEFAULT_TITLE_BACKGROUND_ID) {
      return null;
    }

    backgroundIds.push(backgroundId);
    previousIndex = index;
  }

  return backgroundIds;
}

/** 選択中タイトル背景を、初期背景なら0、それ以外なら番号+1で書き込みます。 */
function writeSelectedTitleBackgroundId(writer: ByteWriter, backgroundId: string): void {
  const index = titleBackgroundIndexById.get(backgroundId);
  writer.writeVarint(index === undefined || backgroundId === DEFAULT_TITLE_BACKGROUND_ID ? 0 : index + 1);
}

/** 選択中タイトル背景の番号を読み、背景IDへ戻します。 */
function readSelectedTitleBackgroundId(reader: ByteReader): string | null {
  const selectedIndexCode = reader.readVarint();
  if (selectedIndexCode === null || selectedIndexCode > titleBackgroundIds.length) {
    return null;
  }

  if (selectedIndexCode === 0) {
    return DEFAULT_TITLE_BACKGROUND_ID;
  }

  return titleBackgroundIds[selectedIndexCode - 1] ?? null;
}

/** 保存データのうち引き継ぐ項目だけを、短いバイト列へ詰め込みます。 */
function encodePayload(state: AppSaveState): Uint8Array {
  const writer = new ByteWriter();
  writer.writeByte(TRANSFER_PAYLOAD_VERSION);
  writeCaptureFlags(writer, state.captures);
  writeCountRecord(writer, state.fragments, fragmentIndexByKey, normalizeFragmentKey);
  writeCountRecord(writer, getTransferStageCaptures(state.stageCaptures), stageIndexById);
  writeCountRecord(writer, getTransferStageSpeedStars(state), stageIndexById);
  writeTitleBackgroundIds(writer, state.ownedTitleBackgroundIds);
  writeSelectedTitleBackgroundId(writer, state.selectedTitleBackgroundId);
  writeMonsterIdList(writer, state.unlockedDexStoryMonsterIds);
  return writer.toUint8Array();
}

/** 引き継ぎコード内のバイト列を読み、壊れていなければペイロードへ戻します。 */
function decodePayload(bytes: Uint8Array): TransferPayload | null {
  const reader = new ByteReader(bytes);
  const version = reader.readByte();
  if (
    version === null
    || (version !== TRANSFER_PAYLOAD_VERSION
      && version !== LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_CAPTURE_FLAGS
      && version !== LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_CAPTURE_COUNTS
      && version !== LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_SPEED_AVERAGES
      && version !== TRANSFER_PAYLOAD_VERSION_WITHOUT_SPEED_STARS
      && version !== LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_STAGE_MONSTERS)
  ) {
    return null;
  }

  const captures = version >= LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_CAPTURE_FLAGS
    ? readCaptureFlags(reader)
    : readCountRecord(reader, monsterIds);
  const fragments = readCountRecord(reader, fragmentKeys);
  const stageCaptures = readCountRecord(reader, stageIds);
  if (version === LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_STAGE_MONSTERS
    && readStageMonsterCaptures(reader) === null) {
    return null;
  }

  const rawSpeedRecord = version >= LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_SPEED_AVERAGES
    ? readCountRecord(reader, stageIds)
    : {};
  const stageSpeedStars = version === LEGACY_TRANSFER_PAYLOAD_VERSION_WITH_SPEED_AVERAGES
    ? convertSpeedAveragesToStars(rawSpeedRecord ?? {})
    : rawSpeedRecord;
  const ownedTitleBackgroundIds = readTitleBackgroundIds(reader);
  const selectedTitleBackgroundId = readSelectedTitleBackgroundId(reader);
  const unlockedDexStoryMonsterIds = version >= TRANSFER_PAYLOAD_VERSION
    ? readMonsterIdList(reader)
    : [];
  if (
    captures === null
    || fragments === null
    || stageCaptures === null
    || stageSpeedStars === null
    || ownedTitleBackgroundIds === null
    || selectedTitleBackgroundId === null
    || unlockedDexStoryMonsterIds === null
    || !reader.isDone
  ) {
    return null;
  }

  return {
    captures,
    fragments,
    stageCaptures,
    stageSpeedStars,
    ownedTitleBackgroundIds,
    selectedTitleBackgroundId,
    unlockedDexStoryMonsterIds,
  };
}

/** Uint8Arrayを、ブラウザのbase64関数へ渡せるバイナリ文字列にします。 */
function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return binary;
}

/** バイト列を、URLや手入力に使いやすいBase64URL文字列へ変換します。 */
function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
}

/** Base64URL文字列をバイト列へ戻し、形式が壊れていればnullにします。 */
function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) {
    return null;
  }

  const padded = `${value.replace(/-/gu, '+').replace(/_/gu, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  let binary = '';
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/** 入力ミス検出用に、短いチェック文字列を作ります。 */
function getChecksum(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(36).toUpperCase().padStart(7, '0');
}

/** 引き継ぎコード入力から、前後空白や途中の空白を取り除きます。 */
function normalizeTransferCodeInput(value: string): string {
  return value.trim().replace(/\s+/gu, '');
}

/** 引き継ぎコードを検査し、成功ならペイロード、失敗なら理由を返します。 */
function decodeTransferCode(code: string): { status: 'ok'; payload: TransferPayload } | { status: TransferImportFailureStatus } {
  const parts = normalizeTransferCodeInput(code).split('.');
  if (parts.length !== 3 || parts[0] !== TRANSFER_CODE_PREFIX || !parts[1] || !parts[2]) {
    return { status: 'badCode' };
  }

  const body = parts[1];
  if (getChecksum(body) !== parts[2].toUpperCase()) {
    return { status: 'badChecksum' };
  }

  const bytes = decodeBase64Url(body);
  if (bytes === null) {
    return { status: 'badCode' };
  }

  const payload = decodePayload(bytes);
  return payload ? { status: 'ok', payload } : { status: 'badData' };
}

/** 捕獲数が1以上あるモンスターIDだけをSetにします。 */
function getCapturedMonsterIds(captures: Record<string, number>): Set<string> {
  return new Set(Object.keys(captures).filter((monsterId) => (captures[monsterId] ?? 0) > 0));
}

/** 未捕獲になったタイトル配置IDを空欄へ戻します。 */
function filterTitleMonsterIds(
  titleMonsterIds: Array<string | null>,
  capturedMonsterIds: ReadonlySet<string>,
): Array<string | null> {
  return titleMonsterIds.map((monsterId) => (monsterId && capturedMonsterIds.has(monsterId) ? monsterId : null));
}

/** 未捕獲モンスターのタイトル配置を取り除きます。 */
function filterTitleMonsterPlacements(
  placements: TitleMonsterPlacementState[],
  capturedMonsterIds: ReadonlySet<string>,
): TitleMonsterPlacementState[] {
  return placements.filter((placement) => capturedMonsterIds.has(placement.monsterId));
}

/** 引き継ぎ結果の確認画面で使う、捕獲種類数などの概要を作ります。 */
export function getTransferSummary(state: AppSaveState): TransferSummary {
  return {
    captureKinds: Object.values(state.captures).filter((count) => count > 0).length,
    titleBackgrounds: 1 + state.ownedTitleBackgroundIds.length,
    stages: Object.values(state.stageCaptures).filter((count) => count > 0).length,
  };
}

/** 保存状態を正規化してから、手入力できる引き継ぎコードへ変換します。 */
export function createTransferCodeFromSaveState(state: AppSaveState): string {
  const normalizedState = normalizeSaveState(state);
  const body = encodeBase64Url(encodePayload(normalizedState));
  return `${TRANSFER_CODE_PREFIX}.${body}.${getChecksum(body)}`;
}

/** 引き継ぎコードを現在の保存状態へ反映し、結果と概要を返します。 */
export function applyTransferCodeToSaveState(currentState: AppSaveState, code: string): TransferImportResult {
  const decoded = decodeTransferCode(code);
  if (decoded.status !== 'ok') {
    return { status: decoded.status };
  }

  const transferState = normalizeSaveState({
    ...createDefaultSaveState(),
    captures: decoded.payload.captures,
    fragments: decoded.payload.fragments,
    stageCaptures: decoded.payload.stageCaptures,
    stageSpeedStars: convertSpeedStarsToStateRecord(decoded.payload.stageSpeedStars),
    ownedTitleBackgroundIds: decoded.payload.ownedTitleBackgroundIds,
    selectedTitleBackgroundId: decoded.payload.selectedTitleBackgroundId,
    unlockedDexStoryMonsterIds: decoded.payload.unlockedDexStoryMonsterIds,
  });
  const capturedMonsterIds = getCapturedMonsterIds(transferState.captures);
  const state = normalizeSaveState({
    ...currentState,
    captures: transferState.captures,
    fragments: transferState.fragments,
    stageCaptures: transferState.stageCaptures,
    stageMonsterCaptures: transferState.stageMonsterCaptures,
    stageSpeedStars: transferState.stageSpeedStars,
    ownedTitleBackgroundIds: transferState.ownedTitleBackgroundIds,
    selectedTitleBackgroundId: transferState.selectedTitleBackgroundId,
    unlockedDexStoryMonsterIds: transferState.unlockedDexStoryMonsterIds,
    titleMonsterIds: filterTitleMonsterIds(currentState.titleMonsterIds, capturedMonsterIds),
    titleMonsterPlacements: filterTitleMonsterPlacements(currentState.titleMonsterPlacements, capturedMonsterIds),
  });

  return {
    status: 'ok',
    state,
    summary: getTransferSummary(state),
  };
}
