# ますしき問題の作成とランダム表示

このメモは、ますしきエディタで作った問題をアプリに入れて、ステージやトレーナーでランダムに出すための手順です。

## 基本の考え方

ますしき問題は、計算式を自動生成するのではなく、JSONで手作りします。

- 問題本体は `src/data/stageProblems/<stageId>/pNNN.json` に置きます。
- `stageId` は、使いたいステージIDに合わせます。
- `problemNo` は、そのステージ内で重ならない問題番号にします。
- 表示時に `stageProblemNo` を指定しなければ、その `stageId` の全ますしき問題からランダムに選ばれます。
- 表示時に `stageProblemNo` を指定すると、その番号の問題だけが出ます。

## 作成の流れ

1. デバッグ画面から `ますしき` エディタを開きます。
2. 方眼サイズ、キャラクター配置、まとまりの枠、式、答えを設定します。
3. `stageId` と `problemNo` を設定します。
4. `JSON` ボタンで `pNNN.json` をダウンロードします。
5. ダウンロードしたJSONを `src/data/stageProblems/<stageId>/` に置きます。
6. ステージまたはトレーナーの問題ルールから、その `stageId` を参照します。

例:

```text
src/data/stageProblems/stage4_1/p001.json
src/data/stageProblems/stage4_1/p002.json
src/data/stageProblems/stage4_1/p003.json
```

この状態で `stageProblemStageId` に `stage4_1` を指定し、`stageProblemNo` を空にすると、`p001` から `p003` の中からランダムに出ます。

## 問題JSONの形

```json
{
  "problem": {
    "id": "stage4_1-p001",
    "stageId": "stage4_1",
    "problemNo": 1,
    "kind": "gridExpression",
    "title": "絵を見て しきをつくろう",
    "grid": {
      "cols": 8,
      "rows": 5
    },
    "chars": [
      "picoleaf",
      "mokotane"
    ],
    "objects": [
      { "char": 0, "col": 0, "row": 0 },
      { "char": 0, "col": 1, "row": 0 },
      { "char": 1, "col": 4, "row": 2 }
    ],
    "expression": "3 × □ = 12",
    "answer": 4
  }
}
```

主な項目:

- `id`: `<stageId>-pNNN` がおすすめです。
- `stageId`: ステージIDです。置くフォルダ名と合わせます。
- `problemNo`: 問題番号です。ランダムではなく固定表示したい時に使います。
- `grid.cols` / `grid.rows`: 方眼の横マス数と縦マス数です。
- `chars`: 問題内で使うキャラクターIDの一覧です。
- `objects`: マスに置くキャラクターです。`char` は `chars` の何番目かを表します。
- `expression`: 表示する式です。空欄は `□` で書きます。
- `answer`: テンキーで入力する答えです。

`col` と `row` は 0 から数えます。左上が `{ "col": 0, "row": 0 }` です。

## キャラクター指定

`chars` で最初に使うキャラクターを決めておくと、`objects` では番号だけで呼べます。

```json
"chars": ["picoleaf", "mokotane"]
```

この場合:

- `{ "char": 0, "col": 0, "row": 0 }` は `picoleaf`
- `{ "char": 1, "col": 0, "row": 1 }` は `mokotane`

同じキャラクターを何度も書かなくてよいので、問題数が増えても編集しやすくなります。

## まとまり線を出したい時

エディタでは2種類のまとまり枠を作れます。

- `しかく`: 開始マスから終了マスまでドラッグして、長方形の枠を作ります。
- `ぬる`: ドラッグで通ったセルを1つのまとまりにします。L型などに使います。

ドラッグを離すとラベル入力が出ます。空欄でOKを押すと、ラベルなしの枠になります。

JSONでは `groups` として保存されます。

長方形の例:

```json
"groups": [
  { "col": 0, "row": 0, "cols": 3, "rows": 1, "label": "3こ" },
  { "col": 5, "row": 0, "cols": 3, "rows": 1, "label": "3こ" }
]
```

L型の例:

```json
"groups": [
  {
    "cells": [
      { "col": 0, "row": 0 },
      { "col": 1, "row": 0 },
      { "col": 0, "row": 1 },
      { "col": 0, "row": 2 }
    ],
    "label": "4こ"
  }
]
```

`わくけす` モードで枠の中を押すと、後から作った枠から消せます。

`groups` は任意です。セルの線は基本的に表示しない前提なので、まとまりを見せたい時だけ使います。

## ランダム表示の指定

問題生成側では、`stageProblemStageId` の問題を集めます。

`stageProblemNo` を書かない場合:

```json
{
  "kind": "gridExpression",
  "operator": "equal",
  "stageProblemStageId": "stage4_1",
  "left": [0, 0],
  "right": [0, 0],
  "result": [0, 0]
}
```

この指定では、`src/data/stageProblems/stage4_1/` にある全ますしき問題からランダムに1問が選ばれます。

`stageProblemNo` を書く場合:

```json
{
  "kind": "gridExpression",
  "operator": "equal",
  "stageProblemStageId": "stage4_1",
  "stageProblemNo": 2,
  "left": [0, 0],
  "right": [0, 0],
  "result": [0, 0]
}
```

この指定では、`problemNo: 2` の問題だけが出ます。

## トレーナーしょうぶで使う場合

トレーナーCSVの `problemRule` はJSONを書けるので、今の形のまま使えます。

例:

```csv
trainer-grid-editor,マス,ますしき,stage4_1,1,80,"{""kind"":""gridExpression"",""operator"":""equal"",""stageProblemStageId"":""stage4_1"",""left"":[0,0],""right"":[0,0],""result"":[0,0]}",picoleaf,picoleaf|mokotane,10,くさ,0,#ffd766,#ffd766,#fff8da,#b98d25,#fff9df
```

`stageProblemNo` を入れなければランダム、入れれば固定です。

## 普通のつかまえるモードで使う場合

普通のつかまえるモードでは、ステージCSVの問題ルールからますしき問題を呼びます。

使いたい形は次の通りです。

```csv
stageId,order,legacyRule,kind,operator,blankSlot,leftMin,leftMax,rightMin,rightMax,resultMin,resultMax,...,answerMode,stageProblemStageId,stageProblemNo
stage4_1,1,,gridExpression,equal,,0,0,0,0,0,0,...,,stage4_1,
```

注意:

- `stageProblemStageId` に、問題JSONを置いたフォルダ名を書きます。
- `stageProblemNo` を空にするとランダムです。
- `stageProblemNo` に数字を書くと固定です。
- 現在のCSVヘッダーに `stageProblemStageId` と `stageProblemNo` がない場合は、列追加と読み込み処理の対応が必要です。
- 画面表示側も、つかまえる画面で `gridExpression` を描画する処理が必要です。

## 複数問題を1ファイルにまとめたい場合

1ファイル1問がわかりやすいですが、まとめたい場合は `problems` 配列でも読み込めます。

```json
{
  "problems": [
    {
      "id": "stage4_1-p001",
      "stageId": "stage4_1",
      "problemNo": 1,
      "kind": "gridExpression",
      "title": "絵を見て しきをつくろう",
      "grid": { "cols": 8, "rows": 5 },
      "chars": ["picoleaf"],
      "objects": [],
      "expression": "3 × □ = 12",
      "answer": 4
    },
    {
      "id": "stage4_1-p002",
      "stageId": "stage4_1",
      "problemNo": 2,
      "kind": "gridExpression",
      "title": "絵を見て しきをつくろう",
      "grid": { "cols": 8, "rows": 5 },
      "chars": ["picoleaf"],
      "objects": [],
      "expression": "2 × □ = 8",
      "answer": 4
    }
  ]
}
```

ただし、手で直す時に差分が見やすいので、基本は `p001.json`, `p002.json` のように分ける方がおすすめです。

## 作成時のチェック

- `stageId` とフォルダ名が合っているか。
- `problemNo` が同じステージ内で重なっていないか。
- `id` が重なっていないか。
- `answer` がテンキーで入力できる整数になっているか。
- `objects` の `char` が `chars` の範囲内か。
- `col` と `row` が方眼サイズからはみ出していないか。
- ランダムにしたい時、表示側の `stageProblemNo` を空にしているか。
