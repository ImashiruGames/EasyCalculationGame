# つかまえるステージ追加ガイド

新しい「つかまえる」ステージは、基本的に `src/data/stages.ts` に1ブロック追加します。

## 先に見るもの

作業に迷ったら、まず `docs/code-map.txt` を見ます。つかまえる画面の入口は主に次のファイルです。

- `src/data/stages.ts`: ステージ名、カテゴリ、問題ルール、出るモンスター、背景、解放条件
- `src/game/mathProblems.ts`: 問題の作り方そのもの
- `src/state/progression.ts`: ステージ解放条件の判定
- `src/game/scenes/StageSelectScene.ts`: ジャンル一覧とステージ一覧
- `src/game/scenes/StageIntroScene.ts`: 出発前のステージ紹介
- `src/game/scenes/CaptureGameScene.ts`: つかまえるゲーム本体
- `src/game/scenes/ResultScene.ts`: 捕獲後の結果画面

日本語を含むファイルはUTF-8で扱います。PowerShellで読むときは `Get-Content -Encoding UTF8` を使います。

```ts
{
  id: 'newStageId',
  stageCategoryId: 'addition',
  name: '新規ステージ名',
  subtitle: 'ステージの短い説明',
  themeLabel: '画面に出す問題形式の表示',
  problemRule: [
    { operator: 'plus', left: [4, 6], right: [0, 9], result: [0, 99] },
    { operator: 'plus', left: [0, 9], right: [4, 6], result: [0, 99] },
  ],
  monsterIds: ['picoleaf', 'mokotane', 'haneppu'],
  backgroundPath: 'assets/backgrounds/newStageId.png',
  accentColor: COLORS.grass,
  unlockConditions: [{ type: 'uniqueDexCount', count: 5 }],
},
```

## よく変えるところ

- `id`: 英数字のステージIDです。ほかのステージとかぶらない名前にします。
- `stageCategoryId`: ステージ選択で入れる計算ジャンルです。
- `name`: ステージ名です。
- `subtitle`: ステージ選択に出る短い説明です。
- `themeLabel`: 問題形式のラベルです。
- `problemRule`: 実際に出る問題形式です。
- `monsterIds`: 出るモンスターIDです。
- `backgroundPath`: 背景画像です。画像がまだない場合は、この行を消しても動きます。
- `accentColor`: 枠やボタンの色です。`COLORS.grass` などから選びます。
- `unlockConditions`: 解放条件です。複数書くと、全部満たしたときに解放されます。

## 計算ジャンル

ステージ選択は、まず計算ジャンルを選び、その中からステージを選ぶ二段階です。

使えるジャンルは `src/data/stages.ts` の `stageCategories` にあります。

- `addition`: たし算
- `subtraction`: ひき算
- `multiplication`: かけ算
- `makeTen`: □・10の山

新しいステージをどこに入れるかは、ステージ定義の `stageCategoryId` に書きます。

```ts
stageCategoryId: 'subtraction',
```

計算ジャンル自体を増やしたいときは、`stageCategories` に1ブロック追加し、その `id` をステージ側の `stageCategoryId` に使います。

```ts
{
  id: 'division',
  name: 'わり算',
  subtitle: 'わり算の れんしゅう',
  accentColor: COLORS.moon,
},
```

## 使える問題形式

`problemRule` には、問題の作り方を複数入れられます。どれか1つがランダムに選ばれます。

```ts
problemRule: [
  { operator: 'plus', left: [4, 4], right: [0, 9], result: [0, 99] },
  { operator: 'plus', left: [0, 9], right: [4, 4], result: [0, 99] },
],
```

これは「左右どちらかが4の足し算」です。

- `operator`: `plus`、`minus`、`times` が使えます。
- `left`: 左の数に使える範囲です。
- `right`: 右の数に使える範囲です。
- `result`: 答えに使える範囲です。
- `digitRule`: くりさがりの条件です。必要なときだけ書きます。
- `[4, 4]`: 4だけ出ます。
- `[4, 6]`: 4、5、6のどれかが出ます。
- `[0, 9]`: 0から9まで出ます。
- `[]`: ここが `□` になります。

どこにも `[]` がない場合は、`=` の後ろが `□` になります。`result` の範囲は、出してよい答えの範囲として使われます。

## 問題形式の例

```ts
problemRule: [
  { operator: 'plus', left: [4, 6], right: [0, 9], result: [0, 99] },
  { operator: 'plus', left: [0, 9], right: [4, 6], result: [0, 99] },
],
```

4、5、6の足し算です。

```ts
problemRule: [
  { operator: 'minus', left: [10, 10], right: [0, 9], result: [0, 99] },
],
```

`10-〇` の練習です。

```ts
problemRule: [
  { operator: 'minus', left: [10, 99], right: [10, 99], result: [0, 99], digitRule: 'noBorrow' },
],
```

くりさがりなしの `2けた-2けた` です。

```ts
problemRule: [
  { operator: 'minus', left: [10, 99], right: [1, 9], result: [0, 99], digitRule: 'borrowRequired' },
],
```

くりさがりが必ず入る `2けた-1けた` です。`digitRule` は今のところ `noBorrow` と `borrowRequired` が使えます。

```ts
problemRule: [
  { operator: 'times', left: [2, 2], right: [1, 9], result: [0, 99] },
],
```

`2×〇` の練習です。

かけ算カテゴリには、`src/data/stages.ts` の `createMultiplicationTableStage` で1の段から9の段までをまとめて作っています。各段は次の2種類を出します。

```ts
[
  { operator: 'times', left: [2, 2], right: [1, 9], result: [0, 99] },
  { operator: 'times', left: [2, 2], right: [], result: [2, 18] },
]
```

上は `2×1〜9=□`、下は `2×□=2〜18` です。真ん中が `□` のほうは、結果の範囲を `段の数〜段の数×9` にすることで、`2×□=99` のように割り切れない式や、`□` が1〜9から外れる式が出ないようにしています。

```ts
problemRule: [
  { operator: 'plus', left: [1, 9], right: [], result: [10, 10] },
],
```

`1+□=10` のように、途中を答える問題です。

古い書き方の `plusOne`、`plusTwo`、`plusThree`、`noCarryAdd`、`makeTen`、`noBorrowSubtract`、`multiplication`、`twoDigitMinusOneDigit`、`makeTenMissingResult` もそのまま使えます。

## 使える解放条件

解放条件は `src/data/stages.ts` の `unlockConditions` にすべて書きます。
同じジャンルの中で前にあるステージを5回クリアすると次のステージが開く条件も、自動では追加されません。

```ts
unlockConditions: [{ type: 'stageClearCount', stageId: 'grasslands', count: 5 }]
```

前のステージ以外や、5回以外の条件にしたい場合も `stageId` と `count` を変えるだけで指定できます。

```ts
unlockConditions: [{ type: 'uniqueDexCount', count: 10 }]
```

図鑑が10種類まで埋まったら解放します。

```ts
unlockConditions: [{ type: 'monsterCaptured', monsterId: 'tenpico', label: 'テンピコを とうろく' }]
```

特定モンスターを図鑑登録したら解放します。

```ts
unlockConditions: [{ type: 'achievementUnlocked', achievementId: 'dex-20', label: 'ずかん20しゅるいの トロフィー' }]
```

特定トロフィーを開放したら解放します。

```ts
unlockConditions: [{ type: 'itemOwned', itemId: 'rareBell', label: 'レアベルを もつ' }]
```

特定アイテムを持っていたら解放します。

```ts
unlockConditions: [{ type: 'trainerDefeated', trainerId: 'trainer-raito', label: 'ライトに かつ' }]
```

特定トレーナーを倒したら解放します。

`label` を入れると、ロック中のステージカードに出る文も自分で変えられます。`label` を省略した場合は、IDを使った簡単な文が出ます。

## 背景画像

背景画像を使う場合は、画像を `public/assets/backgrounds/` に入れて、`backgroundPath` に `assets/backgrounds/画像名.png` と書きます。

画像がない、または `backgroundPath` を書かないステージは、`accentColor` に近い既存の背景画像が自動で使われます。

画像パスには `public/` を付けません。モンスター画像を追加する場合は、画像を `public/assets/monsters/` に置き、`src/data/csv/monsters.csv` の `imageFileName` に登録します。

## IDの注意

`stageId`、`monsterId`、`trainerId`、`itemId` は、データ、画像登録、保存処理、画面遷移で同じ文字列を使います。ステージIDを変えると、保存済みのステージ捕獲数や画面遷移にも影響します。

## 保存や解放条件を増やすとき

今ある `unlockConditions` で足りない解放条件を作る場合は、`src/state/progression.ts` を更新します。保存する値そのものを増やす場合は、`src/game/types.ts` の `AppSaveState` と `src/state/save.ts` の初期値、読み込み時の補正を一緒に更新します。

## 変更後の確認

変更後は少なくとも次を確認します。

```bash
npx tsc --noEmit
```

見た目、ボタン、画面遷移、背景画像を触った場合は、ブラウザで実際に `MainMenuScene -> StageSelectScene -> StageIntroScene -> CaptureGameScene -> ResultScene` の流れも確認します。
