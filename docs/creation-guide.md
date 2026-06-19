# 作成ガイド

このファイルは、モンスター、ステージ、問題、画像素材など、アプリに「何かを追加する」ときの入口です。

詳しい列の意味や例は個別ガイドに残し、このファイルでは「何を作るときに、どこを触るか」をまとめます。

## 最初に見る順番

1. ルート直下の `first-read.txt`
2. この `docs/creation-guide.md`
3. 作りたい内容に近い個別ガイド
4. 変更するフォルダの `このフォルダについて.txt`

CSVをExcelで編集する場合は、UTF-8 BOM付きで保存してください。日本語が文字化けしにくくなります。

画像を新しく入れる場合は、基本的にWebPを使います。透過が必要な画像は、透過を残したWebPにします。

## 主要な置き場所

| 作るもの | 主な置き場所 | 詳細ガイド |
| --- | --- | --- |
| モンスター本体 | `src/data/csv/monsters.csv` | `docs/monster-csv-authoring-guide.md` |
| モンスター画像 | `public/assets/monsters/` | `docs/monster-csv-authoring-guide.md` |
| ステージ本体 | `src/data/csv/stages.csv` | `docs/stage-csv-authoring-guide.md` |
| ステージ分類 | `src/data/csv/stage_categories.csv` | `docs/stage-csv-authoring-guide.md` |
| ステージの出題ルール | `src/data/csv/stage_problem_rules.csv` | `docs/stage-csv-authoring-guide.md` |
| ステージの出現モンスター | `src/data/csv/stage_monsters.csv` | `docs/stage-csv-authoring-guide.md` |
| ステージ解放条件 | `src/data/csv/stage_unlock_conditions.csv` | `docs/stage-csv-authoring-guide.md` |
| 手作りますしき問題 | `src/data/stageProblems/<stageId>/` | `docs/masushiki-authoring-guide.md` |
| ステージ背景画像 | `public/assets/backgrounds/` | `docs/background-image-addition-guide.txt` |
| トレーナー | `src/data/csv/trainers.csv` | `docs/stage-csv-authoring-guide.md` の「ほかのCSV」 |
| トレーナー画像 | `public/assets/trainers/` | このファイルの「画像素材」 |
| ボスしょうぶ | `src/data/csv/boss_battles.csv` | `docs/boss-battle-csv-authoring-guide.md` |
| ストーリーJSON | `src/data/stories/` | `docs/story-rich-text-tags.txt` |
| ストーリー画像 | `public/assets/story/` | `public/assets/story/このフォルダについて.txt` |

注意: `docs/stage-authoring-guide.md` は古いTypeScript直書き時代の説明を含みます。今のステージ追加では、基本的に `docs/stage-csv-authoring-guide.md` を優先してください。

## モンスターを追加する

主に触るファイル:

- `src/data/csv/monsters.csv`
- `src/data/csv/stage_monsters.csv`
- `public/assets/monsters/<monsterId>.webp`
- `public/assets/monsters/このフォルダについて.txt`

基本手順:

1. モンスターIDを決めます。公開後は変えない前提にします。
2. 画像がある場合は、透過つきWebPを `public/assets/monsters/` に置きます。
3. `monsters.csv` に名前、タイプ、進化系、画像ファイル名などを追加します。
4. 捕まえられるようにするなら `stage_monsters.csv` にも追加します。
5. 画像を追加したら、画像フォルダの `このフォルダについて.txt` を更新します。

画像ファイルだけを置いても、モンスターは増えません。必ず `monsters.csv` に行を追加します。

## ステージを追加する

主に触るファイル:

- `src/data/csv/stages.csv`
- `src/data/csv/stage_problem_rules.csv`
- `src/data/csv/stage_monsters.csv`
- `src/data/csv/stage_unlock_conditions.csv`
- 新しい分類を作る場合のみ `src/data/csv/stage_categories.csv`
- 背景を追加する場合は `public/assets/backgrounds/<backgroundId>.webp`

基本手順:

1. `stages.csv` にステージ本体を追加します。
2. `stage_problem_rules.csv` に出題ルールを1行以上追加します。
3. `stage_monsters.csv` に出現モンスターを1行以上追加します。
4. 必要なら `stage_unlock_conditions.csv` に解放条件を追加します。
5. 新しい背景を使う場合は、WebPを `public/assets/backgrounds/` に置き、`stages.csv` の `backgroundPath` に `assets/backgrounds/<fileName>.webp` と書きます。

1つのステージに複数の出題ルールを書くと、その中からランダムに選ばれます。

## 問題を作る

問題には大きく2種類あります。

### CSVで自動生成する問題

使うファイル:

- `src/data/csv/stage_problem_rules.csv`
- 詳細: `docs/stage-csv-authoring-guide.md`

たし算、ひき算、かけ算、時計、小数、分数、平方根などはCSVの範囲指定から自動生成します。

同じ `stageId` に複数行を書くと、その中からランダムに出ます。

### 手作りのますしき問題

使うファイル:

- `src/data/stageProblems/<stageId>/pNNN.json`
- 詳細: `docs/masushiki-authoring-guide.md`

ますしきは、方眼にキャラクターを置いて式を作る手作り問題です。

`stageProblemNo` を空にすると、その `stageId` のますしき問題全体からランダムに出ます。`stageProblemNo` に数字を書くと、その番号の問題だけが出ます。

## 画像素材を追加する

基本ルール:

- 新規画像はWebPを優先します。
- 透過が必要な画像は、透過を残したWebPにします。
- CSVやコードから参照するパスには、基本的に `public/` を付けません。

置き場所:

| 種類 | 置き場所 | 参照例 |
| --- | --- | --- |
| 背景 | `public/assets/backgrounds/` | `assets/backgrounds/grasslands.webp` |
| モンスター | `public/assets/monsters/` | `monsters.csv` の `imageFileName` に `picoleaf.webp` |
| トレーナー | `public/assets/trainers/` | トレーナー画像登録側でファイル名を使う |
| ボス報酬画像 | `public/assets/battle-reward/` | 報酬演出側で使う |
| メダル | `public/assets/medals/` | メダル表示側で使う |
| ストーリー素材 | `public/assets/story/` | ストーリー表示や編集で使う |

背景画像をステージで使う場合は、`stages.csv` の `backgroundPath` に `assets/backgrounds/<fileName>.webp` と書きます。

モンスター画像は、`monsters.csv` の `imageFileName` にファイル名だけを書きます。例: `picoleaf.webp`

## トレーナーを追加する

主に触るファイル:

- `src/data/csv/trainers.csv`
- 必要なら `public/assets/trainers/`

`problemRule` には、古い短縮ルール名かJSON形式の問題ルールを書けます。

ますしき問題をトレーナーしょうぶで使う場合は、`problemRule` に `gridExpression` のJSONを書き、`stageProblemStageId` を指定します。詳しくは `docs/masushiki-authoring-guide.md` を見ます。

## ボスしょうぶを追加する

主に触るファイル:

- `src/data/csv/boss_battles.csv`
- 必要なら `public/assets/battle-reward/`

ボスしょうぶは、ステージ選択画面のページごとのまとめボスです。

通常は `categoryId` と `pageIndex` で、今のページに見えているステージの問題から出題します。直接固定したい場合だけ `problemRule` や `sourceStageIds` を使います。

詳しくは `docs/boss-battle-csv-authoring-guide.md` を見ます。

## ストーリーを作る

主に触る場所:

- `src/data/stories/`
- `public/assets/story/`
- `docs/story-rich-text-tags.txt`

ストーリーJSONは `src/data/stories/` に置きます。リッチテキストのタグは `docs/story-rich-text-tags.txt` にまとまっています。

新しい画像素材をストーリーで使う場合は、`public/assets/story/` にWebPを置きます。

## デバッグ用データを追加する

本番データに入れる前に試したい場合は、`debug_` 付きCSVを使います。

| 本番CSV | デバッグCSV |
| --- | --- |
| `monsters.csv` | `debug_monsters.csv` |
| `stages.csv` | `debug_stages.csv` |
| `stage_categories.csv` | `debug_stage_categories.csv` |
| `stage_problem_rules.csv` | `debug_stage_problem_rules.csv` |
| `stage_monsters.csv` | `debug_stage_monsters.csv` |
| `boss_battles.csv` | `debug_boss_battles.csv` |
| `trainers.csv` | `debug_trainers.csv` |

デバッグCSVは、URLに `debug=1` がある開発中だけ読み足されます。

## 変更後の確認

内容によって確認範囲を変えます。

- CSVだけを変えた: CSVのID、必須列、参照先IDを確認します。
- TypeScriptを変えた: `npx tsc --noEmit` を確認します。
- 画面やビルドに関わる変更: `npm run build-nolog` を確認します。
- 見た目や画面配置を変えた: ブラウザで実際の画面を確認します。

このプロジェクトでは、ユーザーが「ブラウザ確認はしなくてよい」と指定している場合があります。その場合は、指示された確認だけ行います。

## 迷ったときの判断

- 画面に出る言葉を増やすなら、小学生向けの読みやすさを優先します。
- `id` は保存データや参照に使うため、追加後に軽く変えません。
- 画像はWebPを優先します。
- 新しいフォルダを作ったら、`first-read.txt` とそのフォルダ直下の `このフォルダについて.txt` を更新します。
- 詳細ガイドとこのファイルが違う場合は、今のCSV実装に近い `docs/stage-csv-authoring-guide.md` と実コードを優先します。

