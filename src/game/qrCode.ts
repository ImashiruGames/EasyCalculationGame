const DATA_CODEWORDS_LOW = [
  0,
  19, 34, 55, 80, 108, 136, 156, 194, 232, 274,
  324, 370, 428, 461, 523, 589, 647, 721, 795, 861,
  932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735,
  1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956,
] as const;

const ECC_CODEWORDS_PER_BLOCK_LOW = [
  0,
  7, 10, 15, 20, 26, 18, 20, 24, 30, 18,
  20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
  28, 28, 30, 30, 26, 28, 30, 30, 30, 30,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
] as const;

const NUM_ERROR_CORRECTION_BLOCKS_LOW = [
  0,
  1, 1, 1, 1, 1, 2, 2, 2, 2, 4,
  4, 4, 4, 4, 6, 6, 6, 6, 7, 8,
  8, 9, 9, 10, 12, 12, 12, 13, 14, 15,
  16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
] as const;

const ALIGNMENT_PATTERN_POSITIONS: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
] as const;

export interface QrMatrix {
  version: number;
  size: number;
  modules: boolean[][];
}

class BitBuffer {
  private readonly bits: number[] = [];

  /** 現在たまっているビット数を返します。 */
  get length(): number {
    return this.bits.length;
  }

  /** 指定ビット長ぶん、値を上位ビットから追加します。 */
  append(value: number, bitLength: number): void {
    for (let index = bitLength - 1; index >= 0; index -= 1) {
      this.bits.push((value >>> index) & 1);
    }
  }

  /** たまったビット列を、8ビットごとのコード語へ変換します。 */
  toCodewords(): number[] {
    const codewords: number[] = [];
    for (let index = 0; index < this.bits.length; index += 8) {
      let codeword = 0;
      for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
        codeword = (codeword << 1) | (this.bits[index + bitIndex] ?? 0);
      }
      codewords.push(codeword);
    }

    return codewords;
  }
}

class QrBuilder {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  /** QRバージョンに応じた盤面サイズを用意します。 */
  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => Array.from({ length: this.size }, () => false));
    this.isFunction = Array.from({ length: this.size }, () => Array.from({ length: this.size }, () => false));
  }

  /** マスク候補を試すため、現在の盤面を複製します。 */
  clone(): QrBuilder {
    const clone = new QrBuilder(this.version);
    for (let y = 0; y < this.size; y += 1) {
      clone.modules[y] = [...this.modules[y]];
      clone.isFunction[y] = [...this.isFunction[y]];
    }

    return clone;
  }

  /** 検出パターンやタイミングなど、データ以外の固定パターンを描きます。 */
  drawFunctionPatterns(): void {
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);
    this.drawAlignmentPatterns();
    this.drawTimingPatterns();
    this.reserveFormatBits();
    this.reserveVersionBits();
    this.setFunctionModule(8, this.size - 8, true);
  }

  /** データと誤り訂正コード語を、マスクをかけながらQR盤面へ配置します。 */
  drawCodewords(codewords: readonly number[], mask: number): void {
    let bitIndex = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) {
        right -= 1;
      }

      for (let vertical = 0; vertical < this.size; vertical += 1) {
        const y = ((right + 1) & 2) === 0 ? this.size - 1 - vertical : vertical;
        for (let column = 0; column < 2; column += 1) {
          const x = right - column;
          if (this.isFunction[y][x]) {
            continue;
          }

          const codeword = codewords[bitIndex >>> 3] ?? 0;
          let dark = ((codeword >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;
          if (getMaskBit(mask, x, y)) {
            dark = !dark;
          }
          this.modules[y][x] = dark;
        }
      }
    }
  }

  /** 誤り訂正レベルとマスク番号を示すフォーマット情報を描きます。 */
  drawFormatBits(mask: number): void {
    const data = (1 << 3) | mask;
    let remainder = data;
    for (let index = 0; index < 10; index += 1) {
      remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    }

    const bits = ((data << 10) | remainder) ^ 0x5412;
    for (let index = 0; index <= 5; index += 1) {
      this.setFunctionModule(8, index, getBit(bits, index));
    }
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let index = 9; index < 15; index += 1) {
      this.setFunctionModule(14 - index, 8, getBit(bits, index));
    }

    for (let index = 0; index < 8; index += 1) {
      this.setFunctionModule(this.size - 1 - index, 8, getBit(bits, index));
    }
    for (let index = 8; index < 15; index += 1) {
      this.setFunctionModule(8, this.size - 15 + index, getBit(bits, index));
    }
    this.setFunctionModule(8, this.size - 8, true);
  }

  /** QRとして読み取りやすい見た目かを評価するペナルティ点を合算します。 */
  getPenaltyScore(): number {
    return this.getAdjacentPenalty()
      + this.getBlockPenalty()
      + this.getFinderLikePenalty()
      + this.getBalancePenalty();
  }

  /** 固定パターン用のマスを設定し、データ配置で上書きされないよう印を付けます。 */
  private setFunctionModule(x: number, y: number, dark: boolean): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
      return;
    }

    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  /** QRの三隅に置く大きな検出パターンを描きます。 */
  private drawFinderPattern(centerX: number, centerY: number): void {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        this.setFunctionModule(centerX + dx, centerY + dy, distance <= 3 && distance !== 2);
      }
    }
  }

  /** バージョンに応じて、読み取り位置合わせ用の小さなパターンを配置します。 */
  private drawAlignmentPatterns(): void {
    const positions = ALIGNMENT_PATTERN_POSITIONS[this.version] ?? [];
    positions.forEach((y) => {
      positions.forEach((x) => {
        if (this.isFunction[y]?.[x]) {
          return;
        }

        this.drawAlignmentPattern(x, y);
      });
    });
  }

  /** 1つぶんの位置合わせパターンを描きます。 */
  private drawAlignmentPattern(centerX: number, centerY: number): void {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        this.setFunctionModule(centerX + dx, centerY + dy, distance !== 1);
      }
    }
  }

  /** 検出パターン間に、白黒交互のタイミングパターンを描きます。 */
  private drawTimingPatterns(): void {
    for (let index = 0; index < this.size; index += 1) {
      const dark = index % 2 === 0;
      if (!this.isFunction[6][index]) {
        this.setFunctionModule(index, 6, dark);
      }
      if (!this.isFunction[index][6]) {
        this.setFunctionModule(6, index, dark);
      }
    }
  }

  /** あとでフォーマット情報を書く場所を固定マスとして予約します。 */
  private reserveFormatBits(): void {
    for (let index = 0; index < 9; index += 1) {
      if (index !== 6) {
        this.setFunctionModule(8, index, false);
        this.setFunctionModule(index, 8, false);
      }
    }

    for (let index = 0; index < 8; index += 1) {
      this.setFunctionModule(this.size - 1 - index, 8, false);
      this.setFunctionModule(8, this.size - 1 - index, false);
    }
  }

  /** 大きいQRで使うバージョン情報の場所を予約し、情報を書き込みます。 */
  private reserveVersionBits(): void {
    if (this.version < 7) {
      return;
    }

    let remainder = this.version;
    for (let index = 0; index < 12; index += 1) {
      remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
    }

    const bits = (this.version << 12) | remainder;
    for (let index = 0; index < 18; index += 1) {
      const dark = getBit(bits, index);
      const x = this.size - 11 + (index % 3);
      const y = Math.floor(index / 3);
      this.setFunctionModule(x, y, dark);
      this.setFunctionModule(y, x, dark);
    }
  }

  /** 同じ色が長く続く行や列に対するペナルティを計算します。 */
  private getAdjacentPenalty(): number {
    let penalty = 0;
    for (let y = 0; y < this.size; y += 1) {
      penalty += getLineAdjacentPenalty(this.modules[y]);
    }

    for (let x = 0; x < this.size; x += 1) {
      const column = this.modules.map((row) => row[x]);
      penalty += getLineAdjacentPenalty(column);
    }

    return penalty;
  }

  /** 2x2の同色ブロックが多いほど増えるペナルティを計算します。 */
  private getBlockPenalty(): number {
    let penalty = 0;
    for (let y = 0; y < this.size - 1; y += 1) {
      for (let x = 0; x < this.size - 1; x += 1) {
        const dark = this.modules[y][x];
        if (
          dark === this.modules[y][x + 1]
          && dark === this.modules[y + 1][x]
          && dark === this.modules[y + 1][x + 1]
        ) {
          penalty += 3;
        }
      }
    }

    return penalty;
  }

  /** 検出パターンに似た並びが内部に出る場合のペナルティを計算します。 */
  private getFinderLikePenalty(): number {
    let penalty = 0;
    for (let y = 0; y < this.size; y += 1) {
      penalty += getFinderLikeLinePenalty(this.modules[y]);
    }

    for (let x = 0; x < this.size; x += 1) {
      const column = this.modules.map((row) => row[x]);
      penalty += getFinderLikeLinePenalty(column);
    }

    return penalty;
  }

  /** 黒マスと白マスの比率が50%から離れるほど増えるペナルティを計算します。 */
  private getBalancePenalty(): number {
    const darkCount = this.modules.reduce(
      (total, row) => total + row.filter(Boolean).length,
      0,
    );
    const totalCount = this.size * this.size;
    const step = Math.ceil(Math.abs(darkCount * 20 - totalCount * 10) / totalCount) - 1;
    return Math.max(0, step) * 10;
  }
}

/** 指定位置のビットが1かどうかを返します。 */
function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

/** 1行または1列で、同色が5個以上続く場合のペナルティを計算します。 */
function getLineAdjacentPenalty(line: readonly boolean[]): number {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;
  for (let index = 1; index < line.length; index += 1) {
    if (line[index] === runColor) {
      runLength += 1;
      continue;
    }

    if (runLength >= 5) {
      penalty += runLength - 2;
    }
    runColor = line[index];
    runLength = 1;
  }

  return runLength >= 5 ? penalty + runLength - 2 : penalty;
}

/** 指定位置からの白黒並びが、指定パターンと一致するか判定します。 */
function matchesPattern(line: readonly boolean[], start: number, pattern: readonly boolean[]): boolean {
  return pattern.every((dark, index) => line[start + index] === dark);
}

/** 1行または1列の中に、検出パターンに似た並びがないか調べます。 */
function getFinderLikeLinePenalty(line: readonly boolean[]): number {
  const patternA = [true, false, true, true, true, false, true, false, false, false, false] as const;
  const patternB = [false, false, false, false, true, false, true, true, true, false, true] as const;
  let penalty = 0;
  for (let index = 0; index <= line.length - patternA.length; index += 1) {
    if (matchesPattern(line, index, patternA) || matchesPattern(line, index, patternB)) {
      penalty += 40;
    }
  }

  return penalty;
}

/** QRの8種類のマスク式から、指定マスを反転するかを返します。 */
function getMaskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return false;
  }
}

/** 入力データ量が入る最小のQRバージョンを選びます。 */
function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= 40; version += 1) {
    const charCountBits = version < 10 ? 8 : 16;
    const bitLength = 4 + charCountBits + byteLength * 8;
    if (bitLength <= DATA_CODEWORDS_LOW[version] * 8) {
      return version;
    }
  }

  throw new Error('QR data is too long');
}

/** バイトデータをQRのデータコード語へ変換し、終端とパディングを追加します。 */
function createDataCodewords(data: Uint8Array, version: number): number[] {
  const bitBuffer = new BitBuffer();
  const dataCodewordCount = DATA_CODEWORDS_LOW[version];
  const capacityBits = dataCodewordCount * 8;
  bitBuffer.append(0x4, 4);
  bitBuffer.append(data.length, version < 10 ? 8 : 16);
  data.forEach((byte) => bitBuffer.append(byte, 8));

  if (bitBuffer.length > capacityBits) {
    throw new Error('QR data is too long');
  }

  bitBuffer.append(0, Math.min(4, capacityBits - bitBuffer.length));
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.append(0, 1);
  }

  const codewords = bitBuffer.toCodewords();
  for (let padIndex = 0; codewords.length < dataCodewordCount; padIndex += 1) {
    codewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }

  return codewords;
}

/** 誤り訂正で使うガロア体上の掛け算を行います。 */
function gfMultiply(left: number, right: number): number {
  let product = 0;
  let factor = left;
  let value = right;
  while (value > 0) {
    if ((value & 1) !== 0) {
      product ^= factor;
    }
    factor <<= 1;
    if ((factor & 0x100) !== 0) {
      factor ^= 0x11d;
    }
    value >>>= 1;
  }

  return product & 0xff;
}

/** Reed-Solomon誤り訂正用の生成多項式を作ります。 */
function createReedSolomonDivisor(degree: number): number[] {
  const result = Array.from({ length: degree }, () => 0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let coefIndex = 0; coefIndex < degree; coefIndex += 1) {
      result[coefIndex] = gfMultiply(result[coefIndex], root);
      if (coefIndex + 1 < degree) {
        result[coefIndex] ^= result[coefIndex + 1];
      }
    }
    root = gfMultiply(root, 0x02);
  }

  return result;
}

/** データコード語から、Reed-Solomon誤り訂正コード語を計算します。 */
function createReedSolomonRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = Array.from({ length: divisor.length }, () => 0);
  data.forEach((byte) => {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });

  return result;
}

/** データコード語に誤り訂正コード語を付け、QR配置用の順序に並べます。 */
function addErrorCorrection(dataCodewords: readonly number[], version: number): number[] {
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS_LOW[version];
  const blockEccLength = ECC_CODEWORDS_PER_BLOCK_LOW[version];
  const rawCodewordCount = DATA_CODEWORDS_LOW[version] + blockEccLength * blockCount;
  const shortBlockCount = blockCount - (rawCodewordCount % blockCount);
  const shortBlockDataLength = Math.floor(rawCodewordCount / blockCount) - blockEccLength;
  const divisor = createReedSolomonDivisor(blockEccLength);
  const blocks: Array<{ data: number[]; ecc: number[] }> = [];
  let offset = 0;

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    const dataLength = shortBlockDataLength + (blockIndex < shortBlockCount ? 0 : 1);
    const data = dataCodewords.slice(offset, offset + dataLength);
    offset += dataLength;
    blocks.push({
      data,
      ecc: createReedSolomonRemainder(data, divisor),
    });
  }

  const result: number[] = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.data.length));
  for (let index = 0; index < maxDataLength; index += 1) {
    blocks.forEach((block) => {
      if (index < block.data.length) {
        result.push(block.data[index]);
      }
    });
  }

  for (let index = 0; index < blockEccLength; index += 1) {
    blocks.forEach((block) => {
      result.push(block.ecc[index]);
    });
  }

  return result;
}

/** 文字列からQRコードの白黒マトリクスを作り、最もペナルティの低いマスクを選びます。 */
export function createQrMatrix(text: string): QrMatrix {
  const data = new TextEncoder().encode(text);
  const version = chooseVersion(data.length);
  const dataCodewords = createDataCodewords(data, version);
  const codewords = addErrorCorrection(dataCodewords, version);
  const baseBuilder = new QrBuilder(version);
  baseBuilder.drawFunctionPatterns();

  let bestBuilder: QrBuilder | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const builder = baseBuilder.clone();
    builder.drawCodewords(codewords, mask);
    builder.drawFormatBits(mask);
    const penalty = builder.getPenaltyScore();
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestBuilder = builder;
    }
  }

  if (!bestBuilder) {
    throw new Error('QR data is empty');
  }

  return {
    version,
    size: bestBuilder.size,
    modules: bestBuilder.modules.map((row) => [...row]),
  };
}
