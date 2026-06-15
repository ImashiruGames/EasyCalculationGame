# ステージCSV作成ガイド

この文書は開発者向けです。アプリ内に表示される文言ではありません。

ステージは次のCSVで管理します。

| CSV | 役割 |
| --- | --- |
| `src/data/csv/stage_categories.csv` | ステージジャンル |
| `src/data/csv/stages.csv` | ステージ本体 |
| `src/data/csv/stage_problem_rules.csv` | 出題ルール |
| `src/data/csv/stage_monsters.csv` | 出現モンスター |
| `src/data/csv/stage_unlock_conditions.csv` | 解放条件 |

アプリ側では `src/data/stages.ts` がCSVを読み、`src/data/stageCsvLoader.ts` で `StageDefinition[]` に組み立てます。画面側のコードはCSVを直接見ません。

## まず知っておくこと

CSVはUTF-8で保存してください。Excelで開く場合は、UTF-8 BOM付きのまま保存すると日本語が崩れにくいです。

アプリに表示される列は、プロジェクトの漢字制限を守ってください。特に `name`, `subtitle`, `themeLabel`, `label` は画面に出ます。

空欄は、多くの場合「指定なし」です。ただし `stage_problem_rules.csv` の `blankSlot` に指定した場所は「答え欄」として扱われます。

`order` は表示順です。同じグループ内で小さい順に並びます。

CSVのセルにカンマを入れたい場合は `"..."` で囲みます。セル内に `"` を入れる場合は `""` と書きます。

`id` は保存データ、解放条件、画面遷移で使われます。追加後は軽く変更しないでください。

## 新しいステージを作る流れ

新しいステージを足すときは、この順に行を追加します。

1. `stages.csv` にステージ本体を1行追加する
2. `stage_problem_rules.csv` に出題ルールを1行以上追加する
3. `stage_monsters.csv` に出現モンスターを1行以上追加する
4. 必要なら `stage_unlock_conditions.csv` に解放条件を追加する
5. `npx tsc --noEmit`, `npm test`, `npm run build-nolog` で確認する

新しいジャンル自体を足す場合だけ、先に `stage_categories.csv` に行を追加します。

## 最短サンプル

たとえば `samplePlus` という「1から9のたし算」ステージを足すなら、最低限この4つを追加します。

`stages.csv`

```csv
id,order,stageCategoryId,name,subtitle,themeLabel,backgroundPath,accentColor,comingSoon,playLimitDisabled,minPracticeLevel,maxPracticeLevel,captureGaugeGain
samplePlus,999,addition,れんしゅうステージ,1から9のたし算,〇+〇=□,,#80d889,,,,,33
```

`stage_problem_rules.csv`

```csv
stageId,order,legacyRule,kind,operator,blankSlot,leftMin,leftMax,rightMin,rightMax,resultMin,resultMax,denominatorMin,denominatorMax,leftDenominatorMin,leftDenominatorMax,rightDenominatorMin,rightDenominatorMax,resultDenominatorMin,resultDenominatorMax,digitRule,minuteStep,leftDecimalPlaces,rightDecimalPlaces,resultDecimalPlaces,remainderMin,remainderMax,remainderRule,rootMode,answerMode
samplePlus,1,,integer,plus,,1,9,1,9,0,18,,,,,,,,,,,,,,,,,,
```

`stage_monsters.csv`

```csv
stageId,order,monsterId,weight
samplePlus,1,picoleaf,45
samplePlus,2,mokotane,40
samplePlus,3,haneppu,15
```

`stage_unlock_conditions.csv`

```csv
stageId,order,type,targetStageId,monsterId,achievementId,itemId,trainerId,count,label
samplePlus,1,stageClearCount,grasslands,,,,,5,
```

この場合、読み込み後のステージはだいたい次のような形になります。

```ts
{
  id: 'samplePlus',
  stageCategoryId: 'addition',
  name: 'れんしゅうステージ',
  subtitle: '1から9のたし算',
  themeLabel: '〇+〇=□',
  accentColor: '#80d889',
  captureGaugeGain: 33,
  problemRule: [
    {
      operator: 'plus',
      left: [1, 9],
      right: [1, 9],
      result: [0, 18],
    },
  ],
  monsterIds: [
    { monsterId: 'picoleaf', weight: 45 },
    { monsterId: 'mokotane', weight: 40 },
    { monsterId: 'haneppu', weight: 15 },
  ],
  unlockConditions: [
    { type: 'stageClearCount', stageId: 'grasslands', count: 5 },
  ],
}
```

## `stage_categories.csv`

ジャンル一覧に出る大きな分類です。`addition`, `clock`, `root` のような単位です。

| 列 | 必須 | 内容 |
| --- | --- | --- |
| `id` | 必須 | ジャンルID。`stages.csv` の `stageCategoryId` から参照します |
| `order` | 必須 | ジャンル一覧の表示順 |
| `name` | 必須 | ジャンル名 |
| `subtitle` | 必須 | ジャンルの短い説明 |
| `accentColor` | 必須 | ジャンル色。例: `#80d889` |
| `minPracticeLevel` | 任意 | 表示する最小学年 |
| `maxPracticeLevel` | 任意 | 表示する最大学年 |

学年の値は次のように扱います。

| 値 | 意味 |
| --- | --- |
| `2` | 2年生 |
| `3` | 3年生 |
| `4` | 4年生 |
| `5` | 5年生 |
| `6` | 6年生 |
| `7` | 中学、または中学1年生 |
| `8` | 中学2年生 |
| `9` | 中学3年生 |

学年選択が `ぜんぶ` のときは、学年範囲を無視して全部表示します。

## `stages.csv`

ステージ本体の情報です。1行が1ステージです。

| 列 | 必須 | 内容 |
| --- | --- | --- |
| `id` | 必須 | ステージID。保存データにも使われます |
| `order` | 必須 | 表示順 |
| `stageCategoryId` | 必須 | 所属ジャンルID。`stage_categories.csv` の `id` と合わせます |
| `name` | 必須 | ステージ名 |
| `subtitle` | 必須 | ステージの短い説明 |
| `themeLabel` | 必須 | どんな問題が出るかの表示 |
| `backgroundPath` | 任意 | 背景画像。例: `assets/backgrounds/grasslands.png` |
| `accentColor` | 必須 | ステージ色。例: `#80d889` |
| `comingSoon` | 任意 | 未公開なら `true`。通常は空欄 |
| `playLimitDisabled` | 任意 | 10分ごとのプレイ制限を外すなら `true`。通常は空欄 |
| `minPracticeLevel` | 任意 | このステージだけ表示学年を変えたい場合に入れます |
| `maxPracticeLevel` | 任意 | このステージだけ表示学年を変えたい場合に入れます |
| `captureGaugeGain` | 任意 | 1問正解したときに増える捕獲ゲージ量。空欄なら20。例: 33なら約3〜4問、70なら約2問で通常モンスターを捕獲しやすくなります |

`comingSoon` と `playLimitDisabled` は、`true`, `1`, `yes`, `false`, `0`, `no` が使えます。

`backgroundPath` が空欄なら、専用背景なしで表示されます。

## `stage_problem_rules.csv`

1行が1つの出題ルールです。1つのステージに複数行を書くと、その中からランダムに使われます。

### 共通列

| 列 | 内容 |
| --- | --- |
| `stageId` | 対象ステージID |
| `order` | ルール内の順番 |
| `legacyRule` | 古い短縮ルール名。新しく作るときは基本的に空欄 |
| `kind` | 問題の種類。空欄なら `integer` と同じ |
| `operator` | 演算子 |
| `blankSlot` | 答え欄にする場所 |
| `leftMin`, `leftMax` | 左側の数や分子の範囲 |
| `rightMin`, `rightMax` | 右側の数や分子の範囲 |
| `resultMin`, `resultMax` | 計算結果や答え側分子の範囲 |
| `denominatorMin`, `denominatorMax` | 共通分母の範囲 |
| `leftDenominatorMin`, `leftDenominatorMax` | 左分母の範囲 |
| `rightDenominatorMin`, `rightDenominatorMax` | 右分母の範囲 |
| `resultDenominatorMin`, `resultDenominatorMax` | 答え側分母の範囲 |
| `digitRule` | くり上がり、くり下がりの指定 |
| `minuteStep` | 時計問題の分の刻み |
| `leftDecimalPlaces`, `rightDecimalPlaces`, `resultDecimalPlaces` | 小数のけた数 |
| `remainderMin`, `remainderMax` | あまり、または√で残る根号内数の範囲 |
| `remainderRule` | わり算のあまり指定 |
| `rootMode` | √問題の出し方 |
| `answerMode` | 二枠入力など、答え方の指定 |

### `kind`

| 値 | 作られる問題 |
| --- | --- |
| `integer` | 整数の四則計算 |
| `integerDivision` | あまり対応の整数わり算 |
| `squareRoot` | √問題 |
| `clockTime` | 時計を読んで、時か分を答える問題 |
| `clockMinuteConversion` | 分を「時間と分」に直す問題 |
| `decimal` | 小数のたし算、ひき算 |
| `sameDenominatorFraction` | 同分母の分数 |
| `equivalentFraction` | 同じ大きさの分数 |
| `differentDenominatorFraction` | 異分母の分数 |
| `fractionProductQuotient` | 分数のかけ算、わり算 |

### `operator`

| 書ける値 | 扱い |
| --- | --- |
| `plus`, `+` | たし算 |
| `minus`, `-` | ひき算 |
| `times`, `multiply`, `*`, `×` | かけ算 |
| `divide`, `/`, `÷` | わり算 |
| `equal`, `=` | 等号 |

### `blankSlot`

| 値 | 答え欄になる場所 |
| --- | --- |
| 空欄 | 通常は `result` |
| `left` | 左側 |
| `right` | 右側 |
| `result` | 答え側 |
| `leftDenominator` | 左分母 |
| `rightDenominator` | 右分母 |
| `resultDenominator` | 答え側分母 |

普通の整数、わり算、√、分数では、`blankSlot` に指定した場所の範囲は空欄扱いになります。たとえば `blankSlot=left` なら `leftMin/leftMax` は使われません。答え欄以外の範囲で問題を絞ってください。

`clockTime` と `decimal` だけは例外です。`blankSlot` は「どこを答えさせるか」だけを決め、`leftMin/leftMax` などの範囲はそのまま使われます。

### `digitRule`

| 値 | 意味 |
| --- | --- |
| 空欄 | 指定なし |
| `noCarry` | たし算でくり上がりなし |
| `carryRequired` | たし算でくり上がりあり |
| `noBorrow` | ひき算でくり下がりなし |
| `borrowRequired` | ひき算でくり下がりあり |

小数でも使えます。小数は指定けた数にそろえた整数として判定します。

### `answerMode`

| 値 | 意味 |
| --- | --- |
| 空欄 | 通常の一枠入力 |
| `quotientRemainder` | 商とあまりを別々に入力 |
| `clockHourMinute` | 時間と分を別々に入力 |
| `squareRootPair` | √の正負2つを入力 |
| `squareRootSimplify` | `a√b` の `a` と `b` を入力 |
| `squareRootExpression` | √式の答えを入力 |

多くの場合は自動で付きます。`remainderRule=required` のわり算は `quotientRemainder` になります。`rootMode=pair`, `simplify`, `addLike` などの√問題も自動で専用の答え方になります。

手で入れることが多いのは、`clockMinuteConversion` の `clockHourMinute` です。

## 問題ルール逆引き

ここでは必要な列だけを書いています。実際のCSVには全列があります。使わない列は空欄にしてください。

### 整数の答えを求める

| 作りたい問題 | 主な指定 |
| --- | --- |
| `1から9 + 1から9 = □` | `kind=integer`, `operator=plus`, `leftMin=1`, `leftMax=9`, `rightMin=1`, `rightMax=9`, `resultMin=0`, `resultMax=18` |
| `□ + 1から9 = 10` | `kind=integer`, `operator=plus`, `blankSlot=left`, `rightMin=1`, `rightMax=9`, `resultMin=10`, `resultMax=10` |
| `20から99 - 1から9 = □` | `kind=integer`, `operator=minus`, `leftMin=20`, `leftMax=99`, `rightMin=1`, `rightMax=9` |
| `九九` | `kind=integer`, `operator=times`, `leftMin=1`, `leftMax=9`, `rightMin=1`, `rightMax=9` |

注意点です。

`blankSlot` が空欄で、`left/right/result` の範囲が全部ある場合、答え欄は `result` になります。

`blankSlot=left` や `blankSlot=right` のときは、答え欄にした場所の範囲は使われません。

条件に合う候補が1つもないと、最終的に `1 + 〇` のフォールバック問題が出ます。意図しない問題が出たら、まず範囲の組み合わせを疑ってください。

### 時計を読む

`kind=clockTime` は、時計の針を見て時または分を答える問題です。

| 作りたい問題 | 主な指定 | 結果 |
| --- | --- | --- |
| ぴったりの時刻で、時を答える | `kind=clockTime`, `operator=equal`, `blankSlot=left`, `leftMin=1`, `leftMax=12`, `rightMin=0`, `rightMax=0`, `minuteStep=60` | `□時` を答える |
| 5分ごとの分を答える | `kind=clockTime`, `operator=equal`, `blankSlot=right`, `leftMin=1`, `leftMax=12`, `rightMin=5`, `rightMax=55`, `minuteStep=5` | `〇時□分` の分を答える |
| 1分ごとの分を答える | `kind=clockTime`, `operator=equal`, `blankSlot=right`, `leftMin=1`, `leftMax=12`, `rightMin=1`, `rightMax=59`, `minuteStep=1` | `〇時□分` の分を答える |
| 時を答える | `blankSlot=left` | `□時13分` のように時を答える |
| 分を答える | `blankSlot=right` | `3時□分` のように分を答える |

`leftMin/leftMax` は時の範囲です。1から12に丸められます。

`rightMin/rightMax` は分の範囲です。0から59に丸められます。

`minuteStep` は分の刻みです。`1` なら1分ごと、`5` なら5分ごと、`60` ならぴったりの時刻です。

`resultMin/resultMax` は、内部では `3時15分` を `315` のようにした値で絞り込みます。通常は空欄で大丈夫です。

### 分を時間と分に直す

`kind=clockMinuteConversion` は、`80分 = 1時間□分` や `80分 = □時間□分` の問題です。

| 作りたい問題 | 主な指定 | 結果 |
| --- | --- | --- |
| `80分 = 1時間□分` のように分だけ答える | `kind=clockMinuteConversion`, `operator=equal`, `blankSlot=result`, `leftMin=60`, `leftMax=110`, `rightMin=1`, `rightMax=1`, `minuteStep=10`, `answerMode` は空欄 | 答え欄は分だけ |
| `80分 = □時間□分` のように両方答える | 上と同じで `answerMode=clockHourMinute` | 時間と分を別々に入力 |

列の意味です。

| 列 | 意味 |
| --- | --- |
| `leftMin/leftMax` | 元の分数。例: 60から110分 |
| `rightMin/rightMax` | 変換後の時間の範囲。例: 1から1なら1時間台だけ |
| `resultMin/resultMax` | 変換後の分の範囲。空欄なら制限なし |
| `minuteStep` | 変換後の分の刻み。10なら `0, 10, 20...` |
| `answerMode=clockHourMinute` | 時間と分を別々に答える |

この形式では `1:20` と `12:00` を同じ数として扱わないため、二枠入力にしたいステージでは必ず `answerMode=clockHourMinute` を使ってください。

古い形として `operator=times` を使うと、`8 × 10 = 20` のように見える問題になりやすいので、新しく作る場合は `operator=equal` を使ってください。

### 小数

`kind=decimal` は小数のたし算、ひき算です。

| 作りたい問題 | 主な指定 |
| --- | --- |
| 小数1けたのたし算 | `kind=decimal`, `operator=plus`, `leftDecimalPlaces=1`, `rightDecimalPlaces=1`, `resultDecimalPlaces=1` |
| 小数2けたのひき算 | `kind=decimal`, `operator=minus`, `leftDecimalPlaces=2`, `rightDecimalPlaces=2`, `resultDecimalPlaces=2` |
| 1けた + 2けた | `leftDecimalPlaces=1`, `rightDecimalPlaces=2`, `resultDecimalPlaces=2` |
| くり上がりなし | `digitRule=noCarry` |
| くり上がりあり | `digitRule=carryRequired` |

`leftMin/leftMax` などは、実際の小数で書きます。例: `0.1` から `9.9`。

小数けた数は0から3までです。空欄なら既定で1けたになります。

`blankSlot=left` や `blankSlot=right` も使えます。この場合も、`leftMin/leftMax` などの範囲はそのまま効きます。

### あまりつきわり算

`kind=integerDivision` は、商とあまりを扱えるわり算です。

| 作りたい問題 | 主な指定 | 結果 |
| --- | --- | --- |
| あまりなし | `kind=integerDivision`, `operator=divide`, `blankSlot=result`, `leftMin=2`, `leftMax=81`, `rightMin=2`, `rightMax=9`, `resultMin=1`, `resultMax=9`, `remainderMin=0`, `remainderMax=0`, `remainderRule=none` | 商だけを答える |
| あまりあり | `kind=integerDivision`, `operator=divide`, `blankSlot=result`, `leftMin=2`, `leftMax=81`, `rightMin=2`, `rightMax=9`, `resultMin=1`, `resultMax=9`, `remainderMin=1`, `remainderMax=8`, `remainderRule=required` | 商とあまりを別々に答える |

`leftMin/leftMax` は割られる数、`rightMin/rightMax` は割る数です。

`resultMin/resultMax` は商の範囲です。

`remainderMin/remainderMax` はあまりの範囲です。

`remainderRule=required` にすると、自動で `answerMode=quotientRemainder` になります。

### √

`kind=squareRoot` は平方根や√の整理です。

| `rootMode` | 作られる問題 | 主な列 |
| --- | --- | --- |
| `principal` | `√16 = □` | `leftMin/leftMax` は√の中、`resultMin/resultMax` は答え |
| `pair` | `√16 = □, □` | `leftMin/leftMax` は√の中、`resultMin/resultMax` は正の答え |
| `simplify` | `√32 = □√□` | `leftMin/leftMax` は√の中、`resultMin/resultMax` は外に出る数、`remainderMin/remainderMax` は残る√の中 |
| `addLike` | `2√3 + 4√3 = □√3` | `left/right` は係数、`remainder` は共通の√の中 |
| `minusLike` | `5√3 - 2√3 = □√3` | `left/right` は係数、`remainder` は共通の√の中 |
| `addSimplifyLike` | `√12 + √27 = □√3` | `left/right` は係数、`leftDenominator/rightDenominator` は整理前の√の中 |
| `minusSimplifyLike` | `√27 - √12 = □√3` | `left/right` は係数、`leftDenominator/rightDenominator` は整理前の√の中 |

√式では、列名に `Denominator` とありますが、分母ではなく「根号内の数」として使う場所があります。

| 列 | √式での意味 |
| --- | --- |
| `leftMin/leftMax` | 左の係数 |
| `rightMin/rightMax` | 右の係数 |
| `resultMin/resultMax` | 答えの係数 |
| `remainderMin/remainderMax` | 答え側に残る√の中 |
| `leftDenominatorMin/leftDenominatorMax` | 左の√の中 |
| `rightDenominatorMin/rightDenominatorMax` | 右の√の中 |

`rootMode=pair`, `simplify`, `addLike`, `minusLike`, `addSimplifyLike`, `minusSimplifyLike` は、答え方が自動で専用モードになります。

### 分数

分数では、`left/right/result` は基本的に分子、`denominator` 系の列は分母です。

| `kind` | 作られる問題 | 主な列 |
| --- | --- | --- |
| `sameDenominatorFraction` | 同じ分母のたし算、ひき算 | `denominatorMin/Max` が共通分母 |
| `equivalentFraction` | 同じ大きさの分数 | `leftDenominatorMin/Max`, `rightDenominatorMin/Max` |
| `differentDenominatorFraction` | 通分するたし算、ひき算 | 左右分母と答え分母 |
| `fractionProductQuotient` | 分数のかけ算、わり算 | 左右分母と答え分母 |

例です。

| 作りたい問題 | 主な指定 |
| --- | --- |
| 同分母のたし算 | `kind=sameDenominatorFraction`, `operator=plus`, `leftMin=1`, `leftMax=8`, `rightMin=1`, `rightMax=8`, `denominatorMin=2`, `denominatorMax=9` |
| 同じ分数で右分母を答える | `kind=equivalentFraction`, `operator=equal`, `blankSlot=rightDenominator`, `leftMin=1`, `leftMax=24`, `rightMin=1`, `rightMax=9`, `leftDenominatorMin=2`, `leftDenominatorMax=36` |
| 異分母のたし算 | `kind=differentDenominatorFraction`, `operator=plus`, `leftDenominatorMin=2`, `leftDenominatorMax=6`, `rightDenominatorMin=2`, `rightDenominatorMax=6`, `resultDenominatorMin=2`, `resultDenominatorMax=30` |
| 分数のかけ算 | `kind=fractionProductQuotient`, `operator=times` |
| 分数のわり算 | `kind=fractionProductQuotient`, `operator=divide` |

異分母の答え分母は最小公倍数です。分数のかけ算とわり算では、約分前の計算結果を使います。

## `stage_monsters.csv`

1行が、そのステージに出るモンスター1体です。

| 列 | 必須 | 内容 |
| --- | --- | --- |
| `stageId` | 必須 | 対象ステージID |
| `order` | 必須 | 表示順 |
| `monsterId` | 必須 | モンスターID |
| `weight` | 任意 | 出現重み |

`weight` は大きいほど出やすくなります。空欄にすると、通常モンスターは通常の既定値、レアモンスターはレア用の既定値になります。

例です。

```csv
stageId,order,monsterId,weight
samplePlus,1,picoleaf,45
samplePlus,2,mokotane,40
samplePlus,3,haneppu,15
samplePlus,4,kirapon,0.5
```

この場合、`picoleaf` と `mokotane` は出やすく、`kirapon` はかなり出にくくなります。

## `stage_unlock_conditions.csv`

必要なステージだけ行を追加します。解放条件がないステージは行なしで大丈夫です。

| 列 | 内容 |
| --- | --- |
| `stageId` | 解放されるステージID |
| `order` | 条件の順番 |
| `type` | 条件タイプ |
| `targetStageId` | `stageClearCount` 用 |
| `monsterId` | `monsterCaptured` 用 |
| `achievementId` | `achievementUnlocked` 用 |
| `itemId` | `itemOwned` 用 |
| `trainerId` | `trainerDefeated` 用 |
| `count` | 必要数 |
| `label` | 表示文を上書きしたいときだけ入力 |

使える `type` は次の通りです。

| type | 意味 | 必要な列 |
| --- | --- | --- |
| `stageClearCount` | 指定ステージを指定回数クリア | `targetStageId`, `count` |
| `uniqueDexCount` | 図鑑の捕獲種類数 | `count` |
| `monsterCaptured` | 指定モンスターを捕獲 | `monsterId` |
| `achievementUnlocked` | 指定実績を達成 | `achievementId` |
| `itemOwned` | 指定アイテムを所持 | `itemId`, 任意で `count` |
| `trainerDefeated` | 指定トレーナーに勝利 | `trainerId`, 任意で `count` |

例です。

```csv
stageId,order,type,targetStageId,monsterId,achievementId,itemId,trainerId,count,label
samplePlus,1,stageClearCount,grasslands,,,,,5,
samplePlus,2,uniqueDexCount,,,,,,4,
samplePlus,3,monsterCaptured,,tenpico,,,,,
```

複数行を書くと、全部満たしたときだけステージが開きます。

`label` を空欄にすると、コード側で自動の説明文を作ります。特別な言い方にしたいときだけ入力してください。

## ほかのCSV

現在、ステージ以外では `src/data/csv/trainers.csv` があります。これは対戦相手のCSVです。

| 列 | 内容 |
| --- | --- |
| `id` | トレーナーID |
| `name` | 名前 |
| `title` | 肩書き |
| `stageId` | 関連ステージ |
| `difficultyLevel` | 難しさ |
| `hp` | HP |
| `problemRule` | 古い短縮ルール名、またはJSON形式の問題ルール |
| `partnerMonsterId` | 代表モンスター |
| `partnerMonsterIds` | パーティ。`haneppu|picoleaf` のように `|` 区切り |
| `rewardCoins` | 勝利時のコイン |
| `rewardCandyAttribute` | ごほうびアメの属性 |
| `rewardCandyAmount` | ごほうびアメの数 |
| `accentColor` | トレーナー色 |
| `paletteCap`, `paletteShirt`, `paletteShadow`, `paletteBackground` | 見た目の色 |

ステージ作成だけなら、まずはステージ系5つのCSVを見れば大丈夫です。

## エラーが出たとき

CSV読み込みでよくあるエラーです。

| エラーの原因 | 直し方 |
| --- | --- |
| 必須列が空欄 | `id`, `stageId`, `order` などを埋める |
| `Min` だけ、または `Max` だけ入っている | `Min/Max` は両方入れるか、両方空欄にする |
| `kind`, `operator`, `blankSlot` の値が違う | このガイドの表にある値へ直す |
| 出題候補がない | 範囲を広げる。特に `resultMin/Max`, `remainderMin/Max`, `digitRule` を確認する |
| ステージに問題ルールがない | `stage_problem_rules.csv` に同じ `stageId` の行を追加する |
| ステージにモンスターがいない | `stage_monsters.csv` に同じ `stageId` の行を追加する |
| `stageCategoryId` が見つからない | `stage_categories.csv` の `id` と合わせる |

## 確認コマンド

編集後は最低限これを確認します。

```bash
npx tsc --noEmit
npm test
npm run build-nolog
```

Viteのビルドがサンドボックス内で `Access is denied` になる場合があります。その場合は同じ `npm run build-nolog` を通常権限で実行して確認します。
