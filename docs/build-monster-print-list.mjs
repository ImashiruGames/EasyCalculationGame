import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(docsDir, '..');
const csvPath = join(rootDir, 'src', 'data', 'csv', 'monsters.csv');
const monsterAssetsDir = join(rootDir, 'public', 'assets', 'monsters');
const outputPath = join(docsDir, 'monster-print-list.html');
const placeholderImageFileName = 'placeholder-question.svg';
const rowsPerPage = 15;

// Splits one CSV line into cells.
function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

// Reads CSV text and returns row objects.
function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const headers = splitCsvLine(lines[0] ?? '');

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

// Escapes text for HTML output.
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Returns a monster image file name or the placeholder.
function getImageFileName(row) {
  const fileName = row.imageFileName?.trim();

  if (!fileName) {
    return placeholderImageFileName;
  }

  return existsSync(join(monsterAssetsDir, fileName)) ? fileName : placeholderImageFileName;
}

// Builds one monster table row.
function renderMonsterRow(row) {
  const imageFileName = getImageFileName(row);
  const imagePath = `../public/assets/monsters/${imageFileName}`;
  const altText = `${row.name} ${row.id}`;

  return [
    '<tr>',
    `  <td class="art"><img src="${escapeHtml(imagePath)}" alt="${escapeHtml(altText)}"></td>`,
    `  <td class="id">${escapeHtml(row.id)}</td>`,
    `  <td class="name">${escapeHtml(row.name)}</td>`,
    '  <td class="memo"></td>',
    '</tr>',
  ].join('\n');
}

// Splits rows into printable page groups.
function chunkRows(rows, size) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

// Builds one printable sheet.
function renderSheet(pageRows, pageIndex, pageCount, totalRows) {
  const rowMarkup = pageRows.map(renderMonsterRow).join('\n');

  return `  <section class="sheet">
    <div class="titlebar">
      <h1>モンスターひょう</h1>
      <div class="count">${pageIndex + 1} / ${pageCount}　ぜんぶ ${totalRows} たい</div>
    </div>
    <table>
      <colgroup>
        <col class="col-art">
        <col class="col-id">
        <col class="col-name">
        <col>
      </colgroup>
      <thead>
        <tr>
          <th>イラスト</th>
          <th>id</th>
          <th>なまえ</th>
          <th>メモ</th>
        </tr>
      </thead>
      <tbody>
${rowMarkup}
      </tbody>
    </table>
  </section>`;
}

// Builds the full printable HTML page.
function renderHtml(rows) {
  const pageGroups = chunkRows(rows, rowsPerPage);
  const sheetsMarkup = pageGroups
    .map((pageRows, pageIndex) => renderSheet(pageRows, pageIndex, pageGroups.length, rows.length))
    .join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>モンスターひょう</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      background: #ffffff;
      color: #111111;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      letter-spacing: 0;
    }

    body {
      padding: 0;
    }

    .sheet {
      width: 190mm;
      min-height: 277mm;
      break-after: page;
      page-break-after: always;
      overflow: hidden;
    }

    .sheet:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .titlebar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8mm;
      margin-bottom: 4mm;
    }

    h1 {
      margin: 0;
      font-size: 16pt;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .count {
      flex: 0 0 auto;
      font-size: 9pt;
      color: #333333;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9pt;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    th,
    td {
      border: 0.25mm solid #555555;
      padding: 1.5mm 2mm;
      vertical-align: middle;
    }

    th {
      height: 7mm;
      background: #f2f2f2;
      text-align: left;
      font-weight: 700;
    }

    td {
      height: 17mm;
    }

    img {
      display: block;
      width: 16mm;
      height: 16mm;
      object-fit: contain;
      margin: 0 auto;
    }

    .col-art {
      width: 22mm;
    }

    .col-id {
      width: 38mm;
    }

    .col-name {
      width: 34mm;
    }

    .art {
      padding: 0.5mm;
      text-align: center;
    }

    .id {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 7.5pt;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .name {
      font-size: 10pt;
      font-weight: 700;
      line-height: 1.2;
    }

    .memo {
      background-image:
        linear-gradient(to bottom, transparent calc(100% - 0.2mm), #d9d9d9 calc(100% - 0.2mm));
      background-size: 100% 5.5mm;
      background-position: left 2mm;
    }

    @media screen {
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12mm;
        padding: 10mm 0;
        background: #e8e8e8;
      }

      .sheet {
        padding: 0;
        background: #ffffff;
        box-shadow: 0 0 18px rgb(0 0 0 / 18%);
      }
    }
  </style>
</head>
<body>
${sheetsMarkup}
</body>
</html>
`;
}

const csvText = readFileSync(csvPath, 'utf8');
const rows = parseCsv(csvText);
writeFileSync(outputPath, renderHtml(rows), 'utf8');

console.log(`Wrote ${rows.length} monsters to ${outputPath}`);
