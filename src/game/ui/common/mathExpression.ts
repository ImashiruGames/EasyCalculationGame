export type StoryMathExpressionNode =
  | { kind: 'text'; value: string }
  | { kind: 'sequence'; parts: StoryMathExpressionNode[] }
  | { kind: 'group'; value: StoryMathExpressionNode }
  | { kind: 'call'; name: string; args: StoryMathExpressionNode[] };

/** ストーリーの [math:...] に書かれた短い数式文字列を、描画しやすい木構造へ変えます。 */
export function parseStoryMathExpression(source: string): StoryMathExpressionNode {
  return new StoryMathExpressionParser(source).parse();
}

class StoryMathExpressionParser {
  private index = 0;

  constructor(private readonly source: string) {}

  /** 入力全体を読み取り、残った文字があれば普通の文字として末尾へ足します。 */
  parse(): StoryMathExpressionNode {
    const expression = this.parseSequence(new Set());
    this.skipSpaces();
    if (this.index >= this.source.length) {
      return expression;
    }

    return this.mergeSequence([expression, { kind: 'text', value: this.source.slice(this.index) }]);
  }

  /** カンマや閉じかっこなど、呼び出し元が指定した終端までの式を読みます。 */
  private parseSequence(stopChars: Set<string>): StoryMathExpressionNode {
    const parts: StoryMathExpressionNode[] = [];
    while (this.index < this.source.length) {
      this.skipSpaces();
      const char = this.source[this.index];
      if (!char || stopChars.has(char) || char === ',' || char === '\uFF0C') {
        break;
      }

      parts.push(this.parseTerm());
    }

    return this.mergeSequence(parts);
  }

  /** 関数呼び出し、かっこ、通常文字のどれか1つを読みます。 */
  private parseTerm(): StoryMathExpressionNode {
    const char = this.source[this.index];
    if (char === '(') {
      this.index += 1;
      const value = this.parseSequence(new Set([')']));
      this.consume(')');
      return { kind: 'group', value };
    }

    const identifier = this.readIdentifier();
    if (identifier && this.source[this.index] === '(') {
      return this.parseCall(identifier);
    }
    if (identifier) {
      return { kind: 'text', value: identifier };
    }

    return { kind: 'text', value: this.readLiteral() };
  }

  /** 名前(引数,引数)の形を、関数名と引数の列として読みます。 */
  private parseCall(name: string): StoryMathExpressionNode {
    this.consume('(');
    const args: StoryMathExpressionNode[] = [];
    while (this.index < this.source.length) {
      this.skipSpaces();
      if (this.source[this.index] === ')') {
        this.index += 1;
        break;
      }

      args.push(this.parseSequence(new Set([',', '\uFF0C', ')'])));
      this.skipSpaces();
      const separator = this.source[this.index];
      if (separator === ',' || separator === '\uFF0C') {
        this.index += 1;
        continue;
      }
      if (separator === ')') {
        this.index += 1;
      }
      break;
    }

    return { kind: 'call', name: name.toLowerCase(), args };
  }

  /** 英字だけの関数名を読みます。関数ではない英字列も通常文字として使います。 */
  private readIdentifier(): string | null {
    const match = this.source.slice(this.index).match(/^[a-zA-Z]+/);
    if (!match) {
      return null;
    }

    this.index += match[0].length;
    return match[0];
  }

  /** 特別な区切り文字に当たるまでの通常文字を読みます。 */
  private readLiteral(): string {
    const start = this.index;
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === '(' || char === ')' || char === ',' || char === '\uFF0C') {
        break;
      }
      if (/[a-zA-Z]/.test(char)) {
        break;
      }
      this.index += 1;
    }

    if (this.index === start) {
      this.index += 1;
    }
    return this.source.slice(start, this.index);
  }

  /** 空白を読み飛ばします。 */
  private skipSpaces(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) {
      this.index += 1;
    }
  }

  /** 期待する1文字があれば読み進めます。 */
  private consume(char: string): void {
    if (this.source[this.index] === char) {
      this.index += 1;
    }
  }

  /** 部品が1つならそのまま、複数なら横並びの式としてまとめます。 */
  private mergeSequence(parts: StoryMathExpressionNode[]): StoryMathExpressionNode {
    if (parts.length === 0) {
      return { kind: 'text', value: '' };
    }
    if (parts.length === 1) {
      return parts[0];
    }

    return { kind: 'sequence', parts };
  }
}
