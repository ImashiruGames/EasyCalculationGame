export const DEBUG_STAGE_CATEGORY_ID = 'debug';

/** URLにdebug=1があり、開発中のときだけデバッグ用データを使えるようにします。 */
export function isDebugModeEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined' || typeof window.location === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('debug') === '1';
}

/** デバッグ中だけ、同じヘッダーを持つCSVのデータ行を通常CSVへ足します。 */
export function appendDebugCsvRows(baseCsv: string, debugCsv: string): string {
  if (!isDebugModeEnabled()) {
    return baseCsv;
  }

  const debugRows = debugCsv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0);

  if (debugRows.length <= 1) {
    return baseCsv;
  }

  return `${baseCsv.trimEnd()}\n${debugRows.slice(1).join('\n')}`;
}
