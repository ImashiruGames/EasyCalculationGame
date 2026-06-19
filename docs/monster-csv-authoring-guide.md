# monsters.csv 作成ガイド

`src/data/csv/monsters.csv` は、モンスター本体を設定するCSVです。  
今は画像がない時も `placeholder-question.svg` を出すため、`shape` や各種Color列は使いません。  
どのステージに出るかは `monsters.csv` ではなく、`src/data/csv/stage_monsters.csv` に書きます。

## 関連ファイル

- `src/data/csv/monsters.csv`
  - モンスターの名前、ID、タイプ、進化系、画像ファイル名、わざ、説明などを設定します。
- `src/data/monsterCsvLoader.ts`
  - CSVを読み、ゲーム内のモンスター定義に変換します。
- `src/data/csv/stage_monsters.csv`
  - ステージごとの出現モンスターを設定します。
- `public/assets/monsters`
  - モンスター画像を置きます。

## 追加の基本手順

1. `monsters.csv` にモンスター行を追加します。
2. 捕まえられるようにしたい場合は、`stage_monsters.csv` にも行を追加します。
3. 画像がある場合は、`public/assets/monsters` に画像ファイルを置き、`imageFileName` にファイル名を書きます。
4. 画像がない場合は、`imageFileName` を空欄にします。

## 必ず書く列

最低限、次の2列があれば読み込めます。

| 列名 | 内容 |
| --- | --- |
| `id` | モンスターIDです。保存データにも使うため、あとから変えないでください。 |
| `name` | 画面に出る名前です。 |

## なるべく書く列

空欄でも既定値が入りますが、ゲーム内で自然に見せるためには書くのがおすすめです。

| 列名 | 空欄時 | 内容 |
| --- | --- | --- |
| `familyId` | `id` と同じ | 進化系IDです。同じ進化系は同じ値にします。 |
| `attribute` | `ふつう` | タイプ名です。例: `くさ`, `こおり`, `ほのお` |
| `experienceKind` | `standard` | 経験値タイプです。`fast`, `standard`, `slow`, `rare` のどれかです。 |
| `evolutionStage` | `1` | 進化段階です。同じ `familyId` 内で1,2,3の連番にします。 |
| `attack` | `10` | 対戦で使う攻撃力です。 |
| `moveNames` | `たいあたり` | わざ名です。複数ある場合は `|` で区切ります。 |
| `dexDescription` | 自動文 | 図鑑などに出る説明です。 |
| `isRare` | `false` | レアなら `true`、通常なら `false` です。 |

## 任意列

| 列名 | 内容 |
| --- | --- |
| `imageFileName` | `public/assets/monsters` 内の画像ファイル名です。空欄なら仮画像を使います。 |
| `faceEyeYRatio` | 画像内の顔位置調整用です。 |
| `faceEyeOffsetRatio` | 画像内の顔位置調整用です。 |
| `faceEyeSizeRatio` | 画像内の顔位置調整用です。 |
| `faceBandageXRatio` | 画像内のばんそうこう位置調整用です。 |
| `faceBandageYRatio` | 画像内のばんそうこう位置調整用です。 |
| `goalGauge` | 捕獲に必要なゲージ量です。空欄なら自動計算します。ステージ側の `captureGaugeGain` が空欄なら、100で約5問、200で約10問が目安です。 |
| `hp` | 対戦用HPです。空欄なら自動計算します。 |
| `evolutionRequiredFragments` | その行のモンスターから次の進化に必要なかけら数です。空欄なら進化段階数から自動計算します。最終進化の行では使われません。 |

## 使える値

`experienceKind`:

- `fast`
- `standard`
- `slow`
- `rare`

## 新規モンスターの例

```csv
id,name,familyId,attribute,experienceKind,evolutionStage,attack,moveNames,dexDescription,isRare,imageFileName,faceEyeYRatio,faceEyeOffsetRatio,faceEyeSizeRatio,faceBandageXRatio,faceBandageYRatio,goalGauge,hp,evolutionRequiredFragments
testmon,テストモン,testmon,くさ,standard,1,12,テストタッチ|ころころ,ためしに出るモンスター。,false,,,,,,,,,
```

この例では `imageFileName` が空なので、画像は `placeholder-question.svg` になります。  
本番画像を使う場合は、たとえば `testmon.png` を `public/assets/monsters` に置き、`imageFileName` に `testmon.png` と書きます。

## ステージに出す

`monsters.csv` に追加しただけでは、ステージに出現しない場合があります。  
捕まえられるようにするには、`stage_monsters.csv` にも追加します。

```csv
stageId,order,monsterId,weight
grasslands,99,testmon,12
```

`order` は同じステージ内の並び順です。  
`weight` は出やすさです。空欄なら通常設定が使われます。数字を大きくすると出やすくなります。

## 進化系の例

同じ `familyId` を使い、`evolutionStage` を連番にします。

```csv
id,name,familyId,attribute,experienceKind,evolutionStage,attack,moveNames,dexDescription,isRare,imageFileName,faceEyeYRatio,faceEyeOffsetRatio,faceEyeSizeRatio,faceBandageXRatio,faceBandageYRatio,goalGauge,hp,evolutionRequiredFragments
testmon,テストモン,testmon,くさ,standard,1,12,テストタッチ|ころころ,ためしに出るモンスター。,false,testmon.png,,,,,,,,
testmon2,テストモン2,testmon,くさ,standard,2,22,テストタッチ|リーフガード,少し大きくなったモンスター。,false,testmon2.png,,,,,,,,
```

2段階進化の場合、1段階目は空欄なら8こで進化、2段階目は進化なしになります。  
3段階進化の場合、1段階目は6こ、2段階目は14こ、3段階目は進化なしになります。

2回目の進化を重くしたい場合は、2段階目の行の `evolutionRequiredFragments` に書きます。  
3段階目の行に書いた値は、次の進化先がないため使われません。

## 画像の扱い

- 画像は `public/assets/monsters` に置きます。
- CSVにはフォルダ名を書かず、ファイル名だけを書きます。
- `imageFileName` が空欄なら `placeholder-question.svg` を使います。
- `imageFileName` に書いたファイルがまだ存在しない場合も、画面では `placeholder-question.svg` に落ちます。
- 画像ファイルを追加しただけではモンスターは増えません。必ず `monsters.csv` に行を追加してください。

## 注意点

- `id` は保存データに使うので、公開後は変えないでください。
- 画面に出る `name`, `moveNames`, `dexDescription` は、小学生向けの読みやすい表記にしてください。
- 同じ `familyId` 内の `evolutionStage` は、1から順番にしてください。
- 1つの進化系は最大3段階までです。
- `stageId`, `shape`, `bodyColor`, `accentColor`, `shadowColor`, `backgroundColor` は、今の `monsters.csv` では使いません。
