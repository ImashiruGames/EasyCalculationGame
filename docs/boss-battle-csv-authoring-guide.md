# boss_battles.csv 作成ガイド

`src/data/csv/boss_battles.csv` は、ステージ選択画面の下に出るボスしょうぶを設定するCSVです。  
通常のトレーナー戦とは別で、ステージページごとのまとめボスとして使います。

## たしざんページ別ボスサンプル

`pageIndex` は0始まりです。

- 1ページ目: order 1,2,3 -> `pageIndex` は `0`
- 2ページ目: order 4,5,6 -> `pageIndex` は `1`
- 3ページ目: order 7,8 -> `pageIndex` は `2`

```csv
id,name,title,categoryId,pageIndex,stageId,sourceStageIds,difficultyLevel,hp,problemCount,bossMonsterId,bossMonsterIds,rewardCoins,rewardCandyAttribute,rewardCandyAmount,accentColor,paletteBackground,problemRule
boss-addition-page1,たしボス1,たしざん1-3,addition,0,,,2,170,3,haneppu,,60,くさ,2,#80d889,#edfff0,
boss-addition-page2,たしボス2,たしざん4-6,addition,1,,,3,190,3,kororin,,70,くさ,2,#80d889,#edfff0,
boss-addition-page3,たしボス3,たしざん7-8,addition,2,,,3,210,2,yoru,,80,よる,2,#b9a7ff,#f3efff,
```

このサンプルでは、たしざんのボスモンスターが次のように変わります。

- 1,2,3: `haneppu` / ハネップ
- 4,5,6: `kororin` / コロリン
- 7,8: `yoru` / ヨル

## 列の意味

| 列名 | 必須 | 内容 |
| --- | --- | --- |
| `id` | 必須 | ボス設定のIDです。重複しない文字にします。 |
| `name` | 必須 | 画面に出るボス名です。 |
| `title` | 必須 | バトル画面で使う肩書きです。 |
| `categoryId` | 基本必須 | どのステージカテゴリに出すかです。例: `addition` |
| `pageIndex` | 任意 | 特定ページ専用にする時に書きます。0始まりです。 |
| `stageId` | 任意 | 代表ステージです。空ならカテゴリ内の先頭ステージが使われます。 |
| `sourceStageIds` | 任意 | 出題元ステージを直接指定したい時に `stageA|stageB|stageC` の形で書きます。 |
| `difficultyLevel` | 必須 | 表示や強さに使うレベルです。 |
| `hp` | 必須 | ボス側の基本HPです。 |
| `problemCount` | 任意 | 問題形式数の目安です。空なら通常3です。 |
| `bossMonsterId` | 必須 | 先頭に出るボスモンスターIDです。 |
| `bossMonsterIds` | 任意 | 複数体出す時に `idA|idB|idC` の形で書きます。 |
| `rewardCoins` | 必須 | 勝った時にもらえるコイン数です。 |
| `rewardCandyAttribute` | 任意 | アメ報酬のタイプ名です。 |
| `rewardCandyAmount` | 任意 | アメ報酬の数です。 |
| `accentColor` | 必須 | ボタンや枠線の色です。 |
| `paletteBackground` | 任意 | ボスカード背景色です。空ならボスモンスターの背景色を使います。 |
| `problemRule` | 任意 | CSV側で問題ルールを直接固定したい場合に使います。通常は空で大丈夫です。 |

## 出題元の優先順

ボス戦の問題形式は、次の順で決まります。

1. ステージ選択画面から渡された、今のページのステージ
2. `problemRule` に直接書いた問題ルール
3. `sourceStageIds` に書いたステージの問題ルール
4. `categoryId` と `pageIndex` から見つかるカテゴリ内ステージ
5. 代表ステージの問題ルール

通常のまとめボスでは、`sourceStageIds` と `problemRule` は空にしておくと、ページ送りに合わせて自動で order 1,2,3 や order 4,5,6 の問題形式になります。

## 注意点

- `pageIndex` は0始まりです。1ページ目は `0`、2ページ目は `1` です。
- `sourceStageIds` は最大5件までです。
- `problemCount` は1から5の整数です。
- `name` や `title` は、画面に出るため読みやすい表記にしてください。
- 通常のトレーナー戦は `trainers.csv` 側で管理します。`boss_battles.csv` はステージまとめボス用です。
