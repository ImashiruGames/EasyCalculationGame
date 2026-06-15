export type CsvRow = Record<string, string>;

/** CSV文字列を行と列に分け、先頭行を見出しとしてオブジェクト配列に変換します。 */
export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  const source = text.replace(/^\uFEFF/, '');
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      record.push(cell);
      cell = '';
    } else if (character === '\n') {
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (cell.length > 0 || record.length > 0) {
    record.push(cell);
    records.push(record);
  }

  const [headers, ...rows] = records.filter((row) => row.some((value) => value.trim().length > 0));
  if (!headers) {
    return [];
  }

  return rows.map((row) => {
    const result: CsvRow = {};
    headers.forEach((header, index) => {
      result[header.trim()] = row[index]?.trim() ?? '';
    });
    return result;
  });
}

/** 必須列の値を取り出し、空なら行番号つきのエラーにします。 */
export function requireCsvValue(row: CsvRow, column: string, rowNumber: number): string {
  const value = row[column]?.trim() ?? '';
  if (!value) {
    throw new Error(`CSV row ${rowNumber} column "${column}" is empty.`);
  }

  return value;
}

/** 任意列の値を整え、空文字なら未指定として扱います。 */
export function optionalCsvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed || undefined;
}

/** 必須列を数値として読み、数値でない場合はCSVの不備として止めます。 */
export function parseCsvNumber(row: CsvRow, column: string, rowNumber: number): number {
  const value = requireCsvValue(row, column, rowNumber);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be a number.`);
  }

  return parsed;
}

/** 任意列を数値として読み、未指定ならundefinedを返します。 */
export function parseOptionalCsvNumber(row: CsvRow, column: string, rowNumber: number): number | undefined {
  const value = optionalCsvValue(row[column]);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be a number.`);
  }

  return parsed;
}

/** `|`区切りのCSVセルを、空要素を除いた文字列リストにします。 */
export function parseCsvList(value: string | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
