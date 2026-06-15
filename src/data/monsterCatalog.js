const EXP_TABLES = {
  fast: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 8 },
    { level: 3, totalExp: 22 },
    { level: 4, totalExp: 44 },
    { level: 5, totalExp: 74 },
    { level: 6, totalExp: 112 },
  ],
  standard: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 10 },
    { level: 3, totalExp: 28 },
    { level: 4, totalExp: 55 },
    { level: 5, totalExp: 92 },
    { level: 6, totalExp: 140 },
  ],
  slow: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 14 },
    { level: 3, totalExp: 36 },
    { level: 4, totalExp: 70 },
    { level: 5, totalExp: 118 },
    { level: 6, totalExp: 180 },
  ],
  rare: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 18 },
    { level: 3, totalExp: 44 },
    { level: 4, totalExp: 84 },
    { level: 5, totalExp: 140 },
    { level: 6, totalExp: 210 },
  ],
};

const BASE_GOAL_GAUGE = 100;
const RARE_GOAL_GAUGE = 200;

const STAGE_GOAL_BONUS = {
  grasslands: 0,
  iceCave: 10,
  fireMountain: 10,
  thunderHighland: 20,
  waterGarden: 20,
  moonRuins: 30,
  clockTenMinuteHour: 20,
  tenTower: 20,
  minusOneTrail: 10,
  minusTwoTrail: 10,
  subtractionForest: 20,
  marketSteps: 20,
  twentySteps: 20,
  teenMinusBridge: 25,
  twoDigitMinusTrail: 25,
  stoneValley: 30,
  borrowCliff: 30,
  borrowRidge: 35,
};

const families = [
  family('picoleaf', 'grasslands', 'くさ', 'standard', [
    form('picoleaf', 'ピコリーフ', 'sprout', 12, ['リーフタップ', 'たねジャンプ'], '小さなはっぱで ぴょんとすすむ。', palette('#7fd77b', '#ffcf59', '#248552', '#e8ffe8')),
    form('futaleaf', 'フタリーフ', 'sprout', 19, ['リーフタップ', 'ふたばガード'], '二まいのはっぱで まえに立つ。', palette('#65c96e', '#ffd766', '#1f7d4a', '#e4ffe8')),
    form('morileaf', 'モリリーフ', 'sprout', 31, ['リーフタップ', 'もりのエール'], 'もりのようなはっぱで 元気にする。', palette('#49b85e', '#ffe28a', '#196a3d', '#e1ffea')),
  ]),
  family('mokotane', 'grasslands', 'くさ', 'fast', [
    form('mokotane', 'モコタネ', 'puff', 10, ['わたげパンチ', 'ころころ'], 'ふわふわのたねをだいて 昼ねする。', palette('#9be27e', '#ff9f68', '#3e9e65', '#f2ffe4')),
    form('mokoleaf', 'モコリーフ', 'puff', 22, ['わたげパンチ', 'リーフクッション'], 'はっぱまじりのわたげで ころがる。', palette('#82d56d', '#ffb17b', '#2f8f55', '#efffe2')),
  ]),
  family('haneppu', 'grasslands', 'くさ', 'fast', [
    form('haneppu', 'ハネップ', 'rabbit', 16, ['はねキック', 'くさむらダッシュ'], '長い耳で 風をよみ くさをぬける。', palette('#6fd3a0', '#ffe36d', '#268c70', '#e4fff4')),
  ]),
  family('hanahana', 'grasslands', 'くさ', 'standard', [
    form('hanahana', 'ハナハナ', 'sprout', 11, ['つぼみタッチ', 'あまいかおり'], 'つぼみをゆらして 朝の光をあつめる。', palette('#f4a0c7', '#8edb72', '#a84f7d', '#fff0f7')),
    form('hanabell', 'ハナベル', 'puff', 21, ['つぼみタッチ', 'はなびらスピン'], '花びらを回して、まわりに小さな風を作る。', palette('#f07db7', '#8edb72', '#9b3e71', '#fff0f8')),
    form('hanalord', 'ハナロード', 'sprout', 34, ['はなびらスピン', 'フラワーエール'], '大きな花で なかまをてらす。', palette('#dc5aa0', '#b8ec82', '#7f2e5e', '#ffe9f5')),
  ]),
  family('kororin', 'grasslands', 'くさ', 'fast', [
    form('kororin', 'コロリン', 'puff', 14, ['ころがる', 'くさだんご'], '丸いからだで さかをころがる。', palette('#a8df72', '#f2d05c', '#609b38', '#f3ffe5')),
  ]),
  family('midorin', 'grasslands', 'くさ', 'fast', [
    form('midorin', 'ミドリン', 'rabbit', 13, ['みどりキック', 'ぴょんステップ'], 'みどりの足あとで 元気にはねる。', palette('#77d68b', '#f8e071', '#2b8b53', '#ecfff1')),
    form('midorian', 'ミドリアン', 'rabbit', 25, ['みどりキック', 'リーフジャンプ'], 'ジャンプで はっぱがふわりとまう。', palette('#5fc675', '#ffe28c', '#237a48', '#e9fff0')),
  ]),

  family('yukipon', 'iceCave', 'こおり', 'standard', [
    form('yukipon', 'ユキポン', 'snowball', 12, ['こなゆき', 'ころん'], '小さな雪玉で つるつるすべる。', palette('#d6f5ff', '#7cc8ff', '#6daed6', '#eefaff')),
    form('yukiron', 'ユキロン', 'snowball', 21, ['こなゆき', 'アイスころがり'], 'つららの音で いい道を見つける。', palette('#bfefff', '#69bdf7', '#579cc7', '#e9faff')),
    form('yukigran', 'ユキグラン', 'crystal', 35, ['アイスころがり', 'ひょうけつベル'], '大きなこおりで どうくつを光らせる。', palette('#a7e7ff', '#e7fbff', '#438ab6', '#e7f8ff')),
  ]),
  family('koorin', 'iceCave', 'こおり', 'slow', [
    form('koorin', 'コオリン', 'crystal', 15, ['こおりのつぶ', 'きらめき'], '角のこおりに 答えがうつる。', palette('#b6ecff', '#6aaef9', '#5196cf', '#eaf8ff')),
    form('koorion', 'コオリオン', 'crystal', 30, ['こおりのつぶ', 'クリスタルライン'], 'こおりの線で 出口をおしえる。', palette('#98ddff', '#d9f8ff', '#3d86bd', '#e7f6ff')),
  ]),
  family('kirapon', 'iceCave', 'こおり', 'fast', [
    form('kirapon', 'キラポン', 'puff', 17, ['キラタッチ', 'ひんやり'], 'いきをはくと 光のつぶがふわり。', palette('#c7f2ff', '#fff8b2', '#62a9c9', '#effcff')),
  ]),
  family('hyokoro', 'iceCave', 'こおり', 'standard', [
    form('hyokoro', 'ヒョコロ', 'seal', 13, ['すべりこみ', 'こおりみず'], 'おなかですべって ゆっくりすすむ。', palette('#bfefff', '#8bd8ff', '#5ca2cb', '#effbff')),
    form('hyokuru', 'ヒョクル', 'seal', 24, ['すべりこみ', 'スノーカーブ'], 'こおりのカーブが とくい。', palette('#aee8ff', '#d8f7ff', '#4b91be', '#ecfaff')),
    form('hyogan', 'ヒョウガン', 'snowball', 37, ['スノーカーブ', 'グレイシャル'], '止まると 足元にこおりの道ができる。', palette('#91dcff', '#e5fbff', '#377fad', '#e8f8ff')),
  ]),
  family('tsururin', 'iceCave', 'こおり', 'fast', [
    form('tsururin', 'ツルリン', 'rabbit', 18, ['つるりん', 'アイスステップ'], 'つるつるのゆかで くるっと回る。', palette('#d3f7ff', '#a8e8ff', '#69aecd', '#f0fcff')),
  ]),
  family('sunomaru', 'iceCave', 'こおり', 'rare', [
    form('sunomaru', 'スノマル', 'seal', 27, ['スノーバンプ', 'まるまり'], '丸くなってねむる レアな子。', palette('#c9f0ff', '#98d7ff', '#5ba1d1', '#effbff'), true),
  ]),

  family('hinokoro', 'fireMountain', 'ほのお', 'standard', [
    form('hinokoro', 'ヒノコロ', 'ember', 15, ['ひのこ', 'ころがり'], '小さな火をけさずに ゆっくり歩く。', palette('#ff9b57', '#ffd05f', '#d46a37', '#fff0dd')),
    form('hinobou', 'ヒノボウ', 'ember', 27, ['ひのこ', 'あつあつパンチ'], 'しっぽの火が強くなるほど、足どりも強くなる。', palette('#ff8448', '#ffe06a', '#b94f2d', '#fff0df')),
    form('hinogard', 'ヒノガルド', 'spark', 41, ['あつあつパンチ', 'ブレイズガード'], '火のわで なかまをまもる番人。', palette('#f2683a', '#ffd45a', '#903924', '#ffeadd')),
  ]),
  family('merarun', 'fireMountain', 'ほのお', 'fast', [
    form('merarun', 'メラルン', 'spark', 14, ['メラタッチ', 'ひばな'], '気分が上がると頭の火花がぱちぱち鳴る。', palette('#ffbd54', '#ffef7a', '#d98228', '#fff4d9')),
    form('merarion', 'メラリオン', 'spark', 29, ['メラタッチ', 'フレアステップ'], '火花でリズムをとり はねる。', palette('#ffa63f', '#fff08a', '#c46f1e', '#fff1d7')),
  ]),
  family('pokkuma', 'fireMountain', 'ほのお', 'standard', [
    form('pokkuma', 'ポックマ', 'coal', 19, ['ぽかぽか', 'くまパンチ'], 'あたたかい岩で なかまをたすける。', palette('#7c5a49', '#ffb15e', '#44312a', '#fff0e6')),
  ]),
  family('yakorin', 'fireMountain', 'ほのお', 'standard', [
    form('yakorin', 'ヤコリン', 'rabbit', 13, ['やけどダッシュ', 'ほのおキック'], 'あつい土の上でも かるくはねる。', palette('#ff9b68', '#ffe28a', '#bd5a37', '#fff0e5')),
    form('yakibunny', 'ヤキバニー', 'rabbit', 26, ['ほのおキック', 'バーニングホップ'], 'ジャンプあとに 星の火花がのこる。', palette('#ff7e50', '#ffda6a', '#a4472f', '#ffeadf')),
    form('yakibanigon', 'ヤキバニゴン', 'ember', 39, ['バーニングホップ', 'ドラゴンフレア'], '火山の風をすって 大きな火にする。', palette('#ee623f', '#ffd15b', '#873123', '#ffe8df')),
  ]),
  family('kogemaru', 'fireMountain', 'ほのお', 'fast', [
    form('kogemaru', 'コゲマル', 'coal', 18, ['こげころ', 'あついけむり'], '黒い石のふりをして休む。楽しくなると中から赤く光る。', palette('#5f4d48', '#ff9b54', '#2f2726', '#fff0e4')),
  ]),
  family('achichin', 'fireMountain', 'ほのお', 'rare', [
    form('achichin', 'アチチン', 'coal', 32, ['アチチパンチ', 'ホットコア'], 'めったに見えない あつい石。', palette('#5b4b54', '#ff814c', '#2d2630', '#fff0e6'), true),
  ]),

  family('biricoro', 'thunderHighland', 'かみなり', 'standard', [
    form('biricoro', 'ビリコロ', 'spark', 14, ['ビリタッチ', 'ころピカ'], '体にたまった電気で、草を少しだけ光らせる。', palette('#ffe56b', '#ffffff', '#d5ad24', '#fff8d7')),
    form('biriran', 'ビリラン', 'spark', 26, ['ビリタッチ', 'でんきラン'], '走るたび 足元がぴかっと光る。', palette('#ffd94f', '#fff7a8', '#bd981f', '#fff6c8')),
    form('biribiriman', 'ビリビリマン', 'spark', 40, ['でんきラン', 'サンダーエール'], 'かみなり音で なかまに合図する。', palette('#f6c941', '#fff5a6', '#a97f16', '#fff4bf')),
  ]),
  family('raimaru', 'thunderHighland', 'かみなり', 'fast', [
    form('raimaru', 'ライマル', 'puff', 16, ['ライボール', 'しびれわた'], 'ふわふわの毛に電気をため、夜道を明るくする。', palette('#f7d94a', '#8bd8ff', '#bd981f', '#fff6c8')),
    form('raijinmaru', 'ライジンマル', 'puff', 33, ['ライボール', 'かみなりわた'], '大きな毛玉が ぴかっとはれる。', palette('#efc935', '#bdefff', '#9c7814', '#fff2bc')),
  ]),
  family('kumorin', 'thunderHighland', 'かみなり', 'standard', [
    form('kumorin', 'クモリン', 'snowball', 18, ['くもパンチ', 'ピカしずく'], '小さな雲にのって ふわりと行く。', palette('#fff2a4', '#9edfff', '#c9a93b', '#fff9dc')),
  ]),
  family('chirip', 'thunderHighland', 'かみなり', 'fast', [
    form('chirip', 'チリチリ', 'rabbit', 13, ['チリコード', 'スパークキック'], '耳の先が光ると 雨が近い。', palette('#ffe071', '#ffffff', '#bd922a', '#fff8d6')),
    form('chirichiri', 'チリコード', 'rabbit', 25, ['スパークキック', 'ジグザグライト'], 'ジグザグに走り 光の線をのこす。', palette('#ffd458', '#fff6a5', '#a9821d', '#fff6ce')),
    form('godchiri', 'ゴッド・チリ', 'spark', 38, ['ジグザグライト', 'ボルトジャンプ'], '高台からジャンプして すぐ下りる。', palette('#f0c140', '#fff28a', '#916b12', '#fff2c4')),
  ]),
  family('pikopiko', 'thunderHighland', 'かみなり', 'fast', [
    form('pikopiko', 'ピコピコ', 'spark', 17, ['ピコショック', 'ピカダッシュ'], '数を数えると テンポが早くなる。', palette('#ffe982', '#ffffff', '#c49d26', '#fff8d4')),
  ]),
  family('goropeka', 'thunderHighland', 'かみなり', 'rare', [
    form('goropeka', 'ゴロペカ', 'crystal', 34, ['ゴロピカ', 'レアスパーク'], 'かみなり音の夜に あらわれる。', palette('#ffd84f', '#fff7a8', '#c69b22', '#fff9dd'), true),
  ]),

  family('awapon', 'waterGarden', 'みず', 'standard', [
    form('awapon', 'アワポン', 'snowball', 11, ['あわタッチ', 'ぷかぷか'], 'あわの中で 昼ねする。', palette('#9de8ff', '#5bbcff', '#4da5d7', '#e9fbff')),
    form('awazarashi', 'アワザラシ', 'seal', 23, ['あわタッチ', 'バブルカーブ'], 'あわをつないで 小川をわたる。', palette('#82dcff', '#d7f8ff', '#359dcc', '#e8f8ff')),
    form('awagran', 'アワグラン', 'seal', 36, ['バブルカーブ', 'アクアベル'], '大きなあわの音で なかまをよぶ。', palette('#65ccf6', '#e7fbff', '#267fa8', '#e4f7ff')),
  ]),
  family('namirin', 'waterGarden', 'みず', 'fast', [
    form('namirin', 'ナミリン', 'seal', 15, ['なみタックル', 'みずしぶき'], '小さな水に合わせて ゆらゆら。', palette('#78d7ff', '#d7f8ff', '#359dcc', '#e8f8ff')),
    form('namiou', 'ナミオウ', 'seal', 31, ['なみタックル', 'ウェーブガード'], '水の形を読んで みずべをまもる。', palette('#57c6f2', '#dffaff', '#217fa9', '#e4f6ff')),
  ]),
  family('pururunrun', 'waterGarden', 'みず', 'fast', [
    form('pururunrun', 'プルルンルン', 'puff', 17, ['ぷるタッチ', 'しずくガード'], 'ぷるぷるの体で しずくとあそぶ。', palette('#9eefff', '#ffffff', '#55aac9', '#edfcff')),
  ]),
  family('shizukuchan', 'waterGarden', 'みず', 'standard', [
    form('shizukuchan', 'シズクチャン', 'sprout', 12, ['しずくパンチ', 'みずのめ'], 'はっぱの先から 水をぽたり。', palette('#8bdfff', '#78d889', '#3c9fc2', '#eafffb')),
    form('shizurun', 'シズクネキ', 'sprout', 24, ['しずくパンチ', 'レインステップ'], '雨のリズムで しずかにおどる。', palette('#70d3f8', '#a8e88a', '#2d8dad', '#e7fbf7')),
    form('shizuroad', 'シズロード', 'crystal', 37, ['レインステップ', 'アクアロード'], '水の道をかいて 池まであんない。', palette('#58c4ef', '#d7f8ff', '#207fa2', '#e3f8ff')),
  ]),
  family('potapon', 'waterGarden', 'みず', 'fast', [
    form('potapon', 'ポタポン', 'puff', 16, ['ぽたぽた', 'しずくジャンプ'], 'しずくの音で 高くジャンプする。', palette('#a8efff', '#ffffff', '#57a9c9', '#effdff')),
  ]),
  family('mizukira', 'waterGarden', 'みず', 'rare', [
    form('mizukira', 'ミズキラ', 'crystal', 33, ['キラしずく', 'レアウェーブ'], '朝だけ水にうつる レアな子。', palette('#7fe2ff', '#ffffff', '#48a6d1', '#ecfbff'), true),
  ]),

  family('kagemaru', 'moonRuins', 'よる', 'standard', [
    form('kagemaru', 'カゲマル', 'coal', 13, ['かげタッチ', 'こそこそ'], '月明かりの下で かくれんぼ。', palette('#706b9a', '#cfc4ff', '#383653', '#f1efff')),
    form('kagebouya', 'カゲボウヤ', 'coal', 25, ['かげタッチ', 'ムーンステップ'], 'かげを長くして 音を聞く。', palette('#625c90', '#d8ceff', '#302d4a', '#f1eeff')),
    form('kageou', 'カゲオウ', 'coal', 39, ['ムーンステップ', 'ナイトサイン'], 'よるのいせきで 道をてらす。', palette('#514b7e', '#e0d8ff', '#28243e', '#eeeaff')),
  ]),
  family('tsukinoko', 'moonRuins', 'よる', 'fast', [
    form('tsukinoko', 'ツキノコ', 'puff', 15, ['つきのこパンチ', 'ほしのこな'], '月の形のかさで 星をあつめる。', palette('#b7a6ff', '#ffe77c', '#7865c4', '#f5f1ff')),
    form('ootsukinoko', 'オオツキノコ', 'puff', 30, ['つきのこパンチ', 'ムーンリング'], '光のわを回して 道をてらす。', palette('#a28ef0', '#fff28a', '#6654ad', '#f3efff')),
  ]),
  family('nemuriko', 'moonRuins', 'よる', 'fast', [
    form('nemuriko', 'ネムリコ', 'rabbit', 14, ['ねむねむ', 'ゆめキック'], 'ねむそうでも すばやく走る。', palette('#a999ee', '#ffeaa0', '#6655ad', '#f4f0ff')),
  ]),
  family('lumina', 'moonRuins', 'よる', 'standard', [
    form('lumina', 'ルミナ', 'crystal', 12, ['ルミライト', 'きらめき'], '小さな光をむねに 夜を歩く。', palette('#c7b8ff', '#fff08a', '#7461c7', '#f5f1ff')),
    form('lumiel', 'ルミエル', 'crystal', 24, ['ルミライト', 'スターライン'], '星の線をなぞって とびらを見つける。', palette('#b5a3ff', '#fff4a2', '#6754b4', '#f3efff')),
    form('lumiroad', 'ルミロード', 'spark', 38, ['スターライン', 'ナイトロード'], '光の道で まいごを家へおくる。', palette('#9f8df2', '#fff7b0', '#5a48a0', '#f1edff')),
  ]),
  family('yoru', 'moonRuins', 'よる', 'fast', [
    form('yoru', 'ヨル', 'snowball', 17, ['よるころん', 'ムーンバンプ'], '夜の石道を ころころすすむ。', palette('#8f80d8', '#ffe98a', '#55479d', '#f4f0ff')),
  ]),
  family('hoshimimi', 'moonRuins', 'よる', 'rare', [
    form('hoshimimi', 'ホシミミ', 'rabbit', 34, ['ほしキック', 'レアムーン'], '星の夜だけ あらわれる。', palette('#9d8cf4', '#fff28a', '#6254b0', '#f3f0ff'), true),
  ]),

  family('mokousagi', 'clockTenMinuteHour', '時計', 'standard', [
    form('mokousagi', 'モコウサギ', 'rabbit', 14, ['10分ジャンプ', 'ふわ時計'], '10分ごとに ふわりとはねる。時計の音が すき。', palette('#fbf6d4', '#f6bed3', '#78919a', '#dcf5d7')),
    form('mokokousagi', 'モココウサギ', 'rabbit', 26, ['ふわ時計', 'ふたりジャンプ'], 'ふたりで 10分を 数える。耳を見て ならぶ。', palette('#fbf6d4', '#f3bdd3', '#3c3a4a', '#dcf5d7')),
  ]),
  family('rabimajo','moonRuins','よる', 'standard',[
    form('rabimajo', 'ラビマジョ', 'rabbit', 40, ['1時間まほう', 'ラビエール'], '1時間の まほうで みんなを 元気にする。', palette('#f9f4d4', '#f47fa7', '#38425b', '#d5f1d9')),
  ]),
  family('tsubutako', 'clockTenMinuteHour', '時計', 'fast', [
    form('tsubutako', 'ツブタコ', 'puff', 16, ['タコタイム', '10分タップ'], '10分のしるしを 足でトントンする。', palette('#c94f7a', '#f8a3bd', '#7a254d', '#a8f0c2')),
    form('tsuruttako', 'ツルッタコ', 'seal', 32, ['タコタイム', 'つる10分'], '1時間まで つるっと すすむ。分の数を 見る。', palette('#ec1682', '#f7d7bf', '#5d175d', '#a8f4c0')),
  ]),
  family('tokekokko', 'clockTenMinuteHour', '時計', 'standard', [
    form('tokekokko', 'トケコッコ', 'puff', 15, ['コッコタイム', 'はねどけい'], '小さな時計の音に あわせて 羽をぱたぱたする。', palette('#f5d86b', '#f37b9d', '#9a6d31', '#fff7dc')),
    form('pironos', 'ピロノス', 'spark', 31, ['はねどけい', 'クロックウィング'], '大きな金の羽で 1時間の流れを まっすぐ見つける。', palette('#f7cf42', '#b98224', '#805020', '#fff2c5')),
    form('tsukuyomi', 'ツクヨミ', 'crystal', 46, ['クロックウィング', 'ツクヨミベル'], '月と時計の力を ひらき、時間の輪を しずかに守る。', palette('#e5c151', '#8dcfff', '#5e4220', '#fff2cc')),
  ]),

  family('tenpico', 'tenTower', '10', 'standard', [
    form('tenpico', 'テンピコ', 'sprout', 12, ['テンタッチ', 'いちたす'], '10のとうで 数を数える。', palette('#ffe276', '#7fd77b', '#c9a52b', '#fff8da')),
    form('tenril', 'テンリル', 'sprout', 25, ['テンタッチ', 'ぴったり10'], '足音が10回で にっこり止まる。', palette('#ffd85f', '#91df82', '#b58d20', '#fff6d4')),
    form('tenroad', 'テンロード', 'crystal', 40, ['ぴったり10', 'テンロード'], '10のまとまりで かねを鳴らす。', palette('#f4c94f', '#dff7a0', '#9c7715', '#fff4c9')),
  ]),
  family('maruten', 'tenTower', '10', 'fast', [
    form('maruten', 'マルテン', 'puff', 14, ['まるタッチ', 'テンボール'], '丸をあつめて 10こずつしまう。', palette('#ffd96a', '#ffffff', '#bd922a', '#fff7d6')),
    form('maruteon', 'マルテオン', 'puff', 29, ['まるタッチ', 'テンリング'], '10この丸で まどをかざる。', palette('#f4c856', '#fff7bd', '#a77d1b', '#fff5cd')),
  ]),
  family('icchoku', 'tenTower', '10', 'fast', [
    form('icchoku', 'イッチョク', 'rabbit', 16, ['いっちょくせん', 'テンジャンプ'], 'まっすぐ走り 10歩ではねる。', palette('#ffe58a', '#8bd8ff', '#b99025', '#fff9dd')),
  ]),
  family('soroban', 'tenTower', '10', 'standard', [
    form('soroban', 'ソロバン', 'coal', 13, ['そろえる', 'たまパンチ'], '玉をそろえる音が すき。', palette('#b89b68', '#ffe28a', '#6b5434', '#fff5df')),
    form('sorobal', 'ソロバル', 'coal', 27, ['たまパンチ', 'テンカウント'], '玉をはじいて、10のまとまりを合図する。', palette('#a88755', '#ffe89c', '#5f482b', '#fff2d9')),
    form('soroking', 'ソロキング', 'crystal', 42, ['テンカウント', 'キングアバカス'], '大きな玉を一つで 答えがそろう。', palette('#967546', '#fff0ac', '#4e3920', '#fff0d5')),
  ]),
  family('kazumaru', 'tenTower', '10', 'fast', [
    form('kazumaru', 'カズマル', 'snowball', 17, ['かぞえる', 'テンステップ'], '丸い体で 数をおぼえる。', palette('#ffe891', '#9de8ff', '#b58f25', '#fff9df')),
  ]),
  family('rainbow', 'tenTower', '10', 'rare', [
    form('rainbow', 'レインボー', 'crystal', 35, ['にじカウント', 'レアテン'], '10もんれんぞく正かいで あらわれる。', palette('#ffdf70', '#9de8ff', '#b98d25', '#fff9df'), true),
  ]),

  family('sagarun', 'minusOneTrail', 'ひき算', 'standard', [
    form('sagarun', 'サガルン', 'sprout', 12, ['サガタッチ', 'ひとつもどる'], '数の道を一歩ずつもどる。', palette('#88d986', '#f3e28a', '#2f8c53', '#efffec')),
    form('sagarii', 'サガリィ', 'sprout', 24, ['ひとつもどる', 'のこりライン'], '足あとを光らせて おしえる。', palette('#70ce74', '#f6e98f', '#247a46', '#ecffe8')),
    form('sagalord', 'サガロード', 'crystal', 38, ['のこりライン', 'マイナスロード'], '数の道をまっすぐにする。', palette('#55bd63', '#fff0a0', '#1f6c3f', '#e8ffe6')),
  ]),
  family('hikikoma', 'minusTwoTrail', 'ひき算', 'fast', [
    form('hikikoma', 'ヒキコマ', 'coal', 17, ['こまひき', 'くるりマイナス'], '引く数だけ 目じるしをたおす。', palette('#8a806f', '#ffe28a', '#4c453b', '#f7f1e6')),
  ]),
  family('nokobou', 'marketSteps', 'ひき算', 'fast', [
    form('nokobou', 'ノコボウ', 'puff', 14, ['のこりぼう', 'テンチェック'], '小さなぼうで のこりを見る。', palette('#9adf93', '#fff0a0', '#4a9651', '#f0ffec')),
    form('nokobolt', 'ノコボルト', 'spark', 29, ['テンチェック', 'リマインドボルト'], '数が合うと 頭がぴかっと光る。', palette('#82d77e', '#ffe978', '#358349', '#edffe9')),
  ]),
  family('kurisaru', 'borrowCliff', 'ひき算', 'slow', [
    form('kurisaru', 'クリサル', 'crystal', 18, ['くりさげ', 'ひとつかりる'], '足りない時は となりからかりる。', palette('#90c7ff', '#ffe58a', '#3f78a8', '#eef8ff')),
    form('kurisage', 'クリサージ', 'crystal', 33, ['ひとつかりる', 'くらいチェンジ'], '十のくらいから 一のくらいへわける。', palette('#72b8f4', '#fff0a0', '#2f6798', '#eaf6ff')),
    form('kurigaon', 'クリガオン', 'coal', 45, ['くらいチェンジ', 'マイナスガード'], '大きな手で ひき算をささえる。', palette('#5f94c8', '#fff2aa', '#264d75', '#e7f3ff')),
  ]),
  family('zerogardx', 'borrowRidge', 'ひき算', 'slow', [
    form('zerogardx', 'ゼロガードX', 'coal', 24, ['ゼロまもり', 'のこりシールド'], '答えが0でも あわてない子。', palette('#6f7684', '#dff68e', '#39404b', '#eef3f5')),
  ]),

  family('hikine', 'subtractionForest', 'もり', 'standard', [
    form('hikine', 'ヒキネ', 'sprout', 12, ['ひきタッチ', 'はっぱひき'], 'はっぱを一まいずつ 数える。', palette('#78d47f', '#d3f08d', '#2d8d52', '#efffea')),
    form('hikiron', 'ヒキロン', 'sprout', 24, ['はっぱひき', 'のこりサイン'], '引いた後の数を 形でおしえる。', palette('#62c86f', '#dff68e', '#247b45', '#ebffe8')),
    form('hikigami', 'ヒキガミ', 'rabbit', 37, ['のこりサイン', 'フォレストマイナス'], '森の道を きれいにする。', palette('#4eb75e', '#e5f89c', '#1d6d3d', '#e8ffe5')),
  ]),
  family('nokorin', 'subtractionForest', 'もり', 'fast', [
    form('nokorin', 'ノコリン', 'rabbit', 15, ['のこりキック', 'ぴょんひき'], 'のこった木のみを 数える。', palette('#8fe0a0', '#fff0a1', '#3f9b61', '#ecfff0')),
    form('nokorion', 'ノコリオン', 'rabbit', 30, ['のこりキック', 'リマインドジャンプ'], 'とびながら 数をおぼえる。', palette('#74d489', '#fff2a8', '#31844f', '#eaffee')),
  ]),
  family('hikizuru', 'subtractionForest', 'もり', 'fast', [
    form('hikizuru', 'ヒキズル', 'seal', 16, ['ずるずる', 'のこりガード'], '長いしっぽで 線を引く。', palette('#a2e3a7', '#fff0a1', '#4c9a58', '#f0fff0')),
  ]),
  family('keshipa', 'subtractionForest', 'もり', 'standard', [
    form('keshipa', 'ケシパ', 'puff', 11, ['けしけし', 'リーフワイプ'], 'まちがえた足あとを けす。', palette('#98dda0', '#dff68e', '#4b9654', '#efffec')),
    form('keshipal', 'ケシパル', 'puff', 23, ['リーフワイプ', 'クリアステップ'], 'はっぱをあつめて 道をきれいにする。', palette('#81d18b', '#e7f99e', '#3b8548', '#ecffe9')),
    form('keshidon', 'ケシドン', 'coal', 36, ['クリアステップ', 'マイナスドン'], '大きな手で 森の道をならす。', palette('#65bd72', '#f0f7a6', '#2f7240', '#e8ffe6')),
  ]),
  family('zubagiri', 'subtractionForest', 'もり', 'fast', [
    form('zubagiri', 'ズバギリ', 'puff', 16, ['のこりポン', 'マイナスジャンプ'], 'のこりを数えて はこにしまう。', palette('#9ce5a5', '#fff1a0', '#4b9656', '#efffee')),
  ]),
  family('komorebi', 'subtractionForest', 'もり', 'rare', [
    form('komorebi', 'コモレビ', 'seal', 34, ['こもれび', 'レアリーフ'], '木もれ日の丸いばしょに出るレアな子。', palette('#a4e6a5', '#ffe071', '#4fa05d', '#f0fff0'), true),
  ]),

  family('ishikoro', 'stoneValley', 'いし', 'standard', [
    form('ishikoro', 'イシコロ', 'coal', 14, ['いしころ', 'ごつん'], '小石のふりで ころっとする。', palette('#9b958c', '#ffd08a', '#5c5752', '#f6f2ea')),
    form('ishigoro', 'イシゴロ', 'coal', 27, ['ごつん', 'ロックロール'], 'さか道を ころがって止まらない。', palette('#878078', '#ffc477', '#4e4943', '#f3eee7')),
    form('ishigaon', 'イシガオン', 'coal', 41, ['ロックロール', 'ストーンガード'], '谷の岩を組み 風からまもる。', palette('#746d66', '#ffb863', '#403b36', '#f0e9e2')),
  ]),
  family('sabimaru', 'stoneValley', 'いし', 'slow', [
    form('sabimaru', 'サビマル', 'snowball', 16, ['さびタックル', 'ごろごろ'], '古い石の色をしていて、夕方の谷にとけこむ。', palette('#b8aca1', '#ffb166', '#74695e', '#f8f1ea')),
    form('sabigon', 'サビゴン', 'coal', 33, ['さびタックル', 'アイアンころがり'], 'かたい体で 道の石をたいらにする。', palette('#9e9186', '#ffa152', '#62564d', '#f6eee6')),
  ]),
  family('sunasuna', 'stoneValley', 'いし', 'fast', [
    form('sunasuna', 'スナスナ', 'puff', 15, ['すなはらい', 'たまガード'], 'すなをまとって 丸くなる。', palette('#d8bf8a', '#fff0a1', '#96753d', '#fff5df')),
  ]),
  family('ganpiro', 'stoneValley', 'いし', 'standard', [
    form('ganpiro', 'ガンピロ', 'crystal', 12, ['がんせき', 'ピカロック'], 'たいらな石の上で 日なたぼっこ。', palette('#b8b1a9', '#ffe28a', '#6f675f', '#f5f1eb')),
    form('ganroku', 'ガンロク', 'crystal', 25, ['ピカロック', 'ロックライン'], '岩の線をなぞり 谷の地図をおぼえる。', palette('#9f978f', '#ffe9a0', '#5f5750', '#f2ece6')),
    form('gantetsu', 'ガンテツ', 'coal', 39, ['ロックライン', 'テツガード'], 'おもい体で はしをささえる。', palette('#817970', '#ffd08a', '#4c453f', '#eee7df')),
  ]),
  family('maruishi', 'stoneValley', 'いし', 'fast', [
    form('maruishi', 'マルイシ', 'snowball', 17, ['まるいし', 'ころストーン'], '丸い石で 道にならぶ。', palette('#b9b0a6', '#ffd38a', '#6c625a', '#f5efe8')),
  ]),
  family('kiramekisama', 'stoneValley', 'いし', 'rare', [
    form('kiramekisama', 'キラメキサマ', 'crystal', 36, ['きらめき', 'レアストーン'], '朝日が谷にさす時 石から出る。', palette('#c7b9ff', '#fff28a', '#7b69c9', '#f5f0ff'), true),
  ]),
];

function family(familyId, stageId, attribute, experienceKind, forms) {
  return { familyId, stageId, attribute, experienceKind, forms };
}

function form(id, name, shape, attack, moveNames, dexDescription, paletteValue, isRare = false) {
  return { id, name, shape, attack, moveNames, dexDescription, palette: paletteValue, isRare };
}

function palette(body, accent, shadow, background) {
  return { body, accent, shadow, background };
}

function getEvolutionRequirement(formCount, index) {
  if (formCount === 3) {
    return [6, 14, null][index];
  }

  if (formCount === 2) {
    return [8, null][index];
  }

  return null;
}

function getGoalGauge(familyDefinition, formDefinition, formCount, index) {
  if (formDefinition.isRare) {
    return RARE_GOAL_GAUGE;
  }

  const stageBonus = STAGE_GOAL_BONUS[familyDefinition.stageId] ?? 0;
  const evolutionBonus = formCount === 3 ? index * 30 : index * 40;
  const singleFormBonus = familyDefinition.stageId === 'grasslands' || formCount > 1 ? 0 : 10;

  // 正解1回につき10ゲージ進むため、100なら10問、200なら20問で捕獲になります。
  return BASE_GOAL_GAUGE + stageBonus + evolutionBonus + singleFormBonus;
}

function getBattleHp(familyDefinition, formDefinition, formCount, index) {
  const experienceBonus = {
    fast: 0,
    standard: 8,
    slow: 18,
    rare: 24,
  }[formDefinition.isRare ? 'rare' : familyDefinition.experienceKind];
  const shapeBonus = {
    sprout: 4,
    puff: 2,
    rabbit: -2,
    snowball: 8,
    crystal: 10,
    seal: 8,
    ember: 4,
    spark: 0,
    coal: 12,
  }[formDefinition.shape] ?? 0;
  const evolutionBonus = formCount === 3 ? index * 18 : index * 20;
  const rareBonus = formDefinition.isRare ? 18 : 0;

  // 対戦では攻撃力だけでなく、進化段階や形でも少し個性が出るようにHPを作ります。
  return Math.max(48, Math.round(58 + formDefinition.attack * 1.25 + experienceBonus + shapeBonus + evolutionBonus + rareBonus));
}

export const monsterCatalog = families.flatMap((familyDefinition) => {
  const formCount = familyDefinition.forms.length;
  return familyDefinition.forms.map((formDefinition, index) => ({
    id: formDefinition.id,
    name: formDefinition.name,
    stageId: familyDefinition.stageId,
    elementName: familyDefinition.attribute,
    attribute: familyDefinition.attribute,
    dexDescription: formDefinition.dexDescription,
    experienceTable: EXP_TABLES[formDefinition.isRare ? 'rare' : familyDefinition.experienceKind],
    evolutionRequiredFragments: getEvolutionRequirement(formCount, index),
    previousEvolutionId: familyDefinition.forms[index - 1]?.id ?? null,
    nextEvolutionId: familyDefinition.forms[index + 1]?.id ?? null,
    hp: getBattleHp(familyDefinition, formDefinition, formCount, index),
    attack: formDefinition.attack,
    moveNames: formDefinition.moveNames,
    goalGauge: getGoalGauge(familyDefinition, formDefinition, formCount, index),
    evolutionFamilyId: familyDefinition.familyId,
    evolutionStage: index + 1,
    maxEvolutionStage: formCount,
    isRare: formDefinition.isRare,
    shape: formDefinition.shape,
    palette: formDefinition.palette,
  }));
});
