import { GAME_HEIGHT, GAME_WIDTH } from './constants';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface VisualPlacement extends LayoutPoint {
  size: number;
}

/**
 * 画像の位置や画面レイアウトを調整するための設定です。
 *
 * 座標は左上が (0, 0) です。
 * x を大きくすると右へ、y を大きくすると下へ動きます。
 * width は横幅、height は高さ、size はモンスターやアイコンの見た目の大きさです。
 */
export const SCREEN_CENTER: LayoutPoint = {
  x: GAME_WIDTH / 2,
  y: GAME_HEIGHT / 2,
};

/** タイトルに飾れるモンスターの最大数です。増やすと保存枠も増えます。 */
export const TITLE_MONSTER_SLOT_COUNT = 5;

/** タイトルに置くモンスターの最小・最大サイズです。 */
export const TITLE_MONSTER_MIN_SIZE = 64;
export const TITLE_MONSTER_MAX_SIZE = 170;

/** 新しくタイトルに置いたときの初期サイズです。 */
export const TITLE_MONSTER_DEFAULT_SIZE = 90;
export const TITLE_MONSTER_RESIZE_STEP = 10;
export const TITLE_MONSTER_ROTATION_STEP = 15;

/** タイトル背景の中で、モンスターを置ける範囲です。 */
export const TITLE_MONSTER_PLACEMENT_BOUNDS = {
  minX: 44,
  maxX: 346,
  minY: 318,
  maxY: 728,
} as const;

/** 背景を買った直後など、タイトルに最初から並ぶモンスターの位置です。 */
export const TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS: VisualPlacement[] = [
  { x: 80, y: 608, size: 82 },
  { x: 150, y: 552, size: 92 },
  { x: 242, y: 552, size: 92 },
  { x: 310, y: 608, size: 82 },
  { x: 196, y: 698, size: 96 },
];

/** タイトル編集でモンスターを追加したとき、順番に使う初期位置です。 */
export const TITLE_EDIT_NEW_MONSTER_POINTS: LayoutPoint[] = [
  { x: 195, y: 560 },
  { x: 128, y: 618 },
  { x: 262, y: 618 },
  { x: 96, y: 684 },
  { x: 294, y: 684 },
];

/** ステージ導入画面の出現モンスター配置です。数が違っても中央寄せに見えるよう分けています。 */
export const STAGE_INTRO_MONSTER_CANDIDATE_POSITIONS: Record<number, LayoutPoint[]> = {
  1: [{ x: SCREEN_CENTER.x, y: 454 }],
  2: [
    { x: 132, y: 454 },
    { x: 258, y: 454 },
  ],
  3: [
    { x: 68, y: 454 },
    { x: 195, y: 454 },
    { x: 322, y: 454 },
  ],
  4: [
    { x: 104, y: 384 },
    { x: 286, y: 384 },
    { x: 104, y: 530 },
    { x: 286, y: 530 },
  ],
  5: [
    { x: 68, y: 384 },
    { x: 195, y: 384 },
    { x: 322, y: 384 },
    { x: 132, y: 530 },
    { x: 258, y: 530 },
  ],
};

/** ログインボーナス画面の下に並ぶ飾りモンスターです。 */
export const LOGIN_BONUS_CHARACTER_PLACEMENTS: Array<VisualPlacement & { monsterId: string }> = [
  { monsterId: 'kirapon', x: 88, y: 680, size: 64 },
  { monsterId: 'tenpico', x: SCREEN_CENTER.x, y: 676, size: 70 },
  { monsterId: 'yukipon', x: 304, y: 680, size: 64 },
];

export const APP_LAYOUT = {
  title: {
    loadingText: { x: SCREEN_CENTER.x, y: 392 },
    loadingBarFrame: { x: 64, y: 430, width: 262, height: 26, radius: 13 },
    loadingBarFill: { x: 70, y: 436, width: 250, height: 14, radius: 7 },
    titleText: { x: SCREEN_CENTER.x, y: 130 },
    subtitleText: { x: SCREEN_CENTER.x, y: 232 },
    touchPrompt: { x: SCREEN_CENTER.x, y: 792 },
    backgroundTopWash: { x: 0, y: 0, width: GAME_WIDTH, height: 300 },
    titleReadabilityPanel: { x: 52, y: 74, width: 286, height: 194, radius: 28 },
  },

  titleEdit: {
    // 左リストに一度に出すモンスター数です。5件なら縦長画面でもカードとページ操作が収まります。
    pageSize: 5,
    // 画面全体の淡い背景色です。編集領域の外側に見える色になります。
    backgroundColor: '#eef9ff',
    // 右上の丸い太陽飾りです。x/yで位置、radiusで大きさ、colorで色を変えます。
    sun: { x: 330, y: 102, radius: 56, color: '#fff4bd' },
    // 中央の編集エリア全体を支える薄緑の背景色です。
    workspaceColor: '#dff9e8',
    // 左右の縦パネルと下の確認パネルに使う白い面の色です。
    sidePanelColor: '#ffffff',
    // 左右の縦パネルと下の確認パネルの透け具合です。1に近いほど不透明になります。
    sidePanelAlpha: 0.86,
    // 左上の戻るボタン位置です。
    backButton: { x: 42, y: 52 },
    // 画面タイトルの位置と文字サイズです。
    headerTitle: { x: SCREEN_CENTER.x, y: 54, fontSize: 29 },
    // 捕獲数と背景名を出すサブタイトルです。背景名が長いときはcompactFontSizeを使います。
    headerSubtitle: { x: SCREEN_CENTER.x, y: 92, fontSize: 14, compactFontSize: 12 },
    // 編集画面の大きな薄緑パネルです。左右リスト、プレビュー、下の確認欄を包みます。
    workspacePanel: { x: 12, y: 106, width: 366, height: 636, radius: 22 },
    // 左のモンスター置き場パネルです。ページ操作もこの中に収めます。
    shelfPanel: { x: 22, y: 148, width: 78, height: 448, radius: 16 },
    // 右の道具パネルです。削除、大小、回転、変更ボタンを縦に置きます。
    toolPanel: { x: 312, y: 148, width: 58, height: 448, radius: 16 },
    // 下に配置済みモンスターを横並びで置く選択パネルです。ここから編集対象を切り替えます。
    placedSelectorPanel: { x: 22, y: 610, width: 348, height: 122, radius: 16 },
    // 中央のタイトルプレビュー枠です。実際のタイトル画面比率をこの枠に縮小表示します。
    preview: { x: SCREEN_CENTER.x, y: 378, width: 156, height: 338 },
    // プレビュー内に置いたモンスターの見た目と選択リングの設定です。
    previewMonster: {
      // 縮小後のモンスターが小さくなりすぎないための最低表示サイズです。
      minSize: 28,
      // 選択リングの半径をモンスターサイズに対してどれくらいにするかです。
      selectionRadiusRatio: 0.46,
      // 選択リングの線の太さです。
      selectionStrokeWidth: 3,
      // 選択リングの線色です。
      selectionColor: '#4e9ff8',
      // 選択リングの内側色です。透明度0で塗るため、将来の調整用に残しています。
      selectionFillColor: '#ffffff',
      // 未選択モンスターの基本レイヤーです。y座標を足して下にある子ほど手前に見せます。
      depthBase: 20,
      // 編集中モンスター専用のレイヤーです。重なった下の子に触れないよう常に前面にします。
      selectedDepth: 1000,
      // 選択リングのレイヤーです。編集中モンスターの少し下に置いて見やすくします。
      selectionDepth: 999,
    },
    // タイトル上でモンスターを置ける範囲を示すガイド線です。
    placementGuide: { strokeWidth: 1, alpha: 0.48, radius: 8 },
    // ドラッグ中にここへ重ねると削除扱いになる範囲です。右上のごみボタンと同じ場所です。
    trashDropZone: { x: 341, y: 192, width: 46, height: 44 },
    // 中央プレビュー上の「5ひきまで」ラベルです。
    placementLabel: { x: SCREEN_CENTER.x, y: 126, fontSize: 15 },
    // 左パネル上の「モンスター」ラベルです。横幅が狭いため少し小さめにしています。
    choiceLabel: { x: 61, y: 132, fontSize: 13 },
    // 右パネル上の「道具」ラベルです。
    toolLabel: { x: 341, y: 132, fontSize: 15 },
    // 捕獲済みモンスターがいないときに左パネルへ出す空表示です。
    emptyChoiceText: { x: 61, y: 350 },
    // 左パネル内のモンスターカードを並べる起点と間隔です。
    choiceGrid: {
      // 1枚目のカード中心Xです。
      firstX: 61,
      // 1枚目のカード中心Yです。
      firstY: 188,
      // 横並びを使う場合の列間隔です。今は1列なので0です。
      colGap: 0,
      // 縦に並ぶカード同士の間隔です。
      rowGap: 72,
      // 左パネルは細いので1列固定にしています。
      cols: 1,
    },
    // 左パネルに並ぶモンスターカード1枚ぶんの設定です。
    choiceCard: {
      // カードの横幅です。左パネルからはみ出さないよう小さめです。
      width: 66,
      // カードの高さです。名前と絵だけを入れるため状態文字分は削っています。
      height: 62,
      // カード内モンスター絵のXずらし量です。
      monsterOffsetX: 0,
      // カード内モンスター絵の大きさです。
      monsterSize: 32,
      // カード内モンスター絵のYずらし量です。負の値で上に寄せます。
      monsterOffsetY: -10,
      // カード内名前テキストのXずらし量です。
      nameOffsetX: 0,
      // カード内名前テキストのYずらし量です。
      nameOffsetY: 18,
      // カード角丸です。
      radius: 14,
      // 通常の名前文字サイズです。
      nameFontSize: 10,
      // 長い名前のときに使う小さめ文字サイズです。
      compactNameFontSize: 9,
      // 名前の折り返し幅です。カード内に収めるためカード幅より少し狭くしています。
      nameWrapWidth: 58,
    },
    // 下の選択パネル内に出す、配置済みモンスターカード列の設定です。
    placedSelector: {
      // カード列全体の中心Xです。配置数が少ないときも中央寄せになります。
      centerX: SCREEN_CENTER.x,
      // カード中心Yです。下の確認パネル内に置きます。
      y: 672,
      // 横に並べるカード同士の中心間隔です。5体でもパネルからはみ出ない値にしています。
      colGap: 64,
      // 横一列に出す最大カード数です。タイトル配置上限と同じ5体まで収まります。
      maxCards: 5,
      // カード横幅です。5体横並びでも余白が残るようにしています。
      width: 56,
      // カード高さです。「編集中」ラベル、絵、名前が入る高さです。
      height: 78,
      // カード角丸です。
      radius: 12,
      // 選択中カードの枠線の太さです。
      selectedStrokeWidth: 4,
      // 未選択カードの枠線の太さです。
      normalStrokeWidth: 2,
      // 「編集中」ラベルのカード中心からのYずらし量です。
      labelOffsetY: -29,
      // 「編集中」ラベルの文字サイズです。
      labelFontSize: 8,
      // モンスター絵のカード中心からのYずらし量です。
      monsterOffsetY: -7,
      // モンスター絵の大きさです。
      monsterSize: 32,
      // 名前テキストのカード中心からのYずらし量です。
      nameOffsetY: 25,
      // 通常の名前文字サイズです。
      nameFontSize: 9,
      // 長い名前のときに使う小さめ文字サイズです。
      compactNameFontSize: 8,
      // 名前の折り返し幅です。
      nameWrapWidth: 50,
      // 配置済みモンスターがいないときに、選択パネル中央へ出す空表示です。
      emptyText: { x: SCREEN_CENTER.x, y: 672, fontSize: 13 },
    },
    // ページ送りボタンの共通サイズです。
    pageButton: { width: 34, height: 34, fontSize: 17 },
    // 左パネル下部のページ番号です。モンスターカード5枚の下に収まる位置です。
    pageText: { x: 61, y: 534, fontSize: 11 },
    // 前ページボタン位置です。左パネル内に収めます。
    prevPageButton: { x: 41, y: 568 },
    // 次ページボタン位置です。左パネル内に収めます。
    nextPageButton: { x: 81, y: 568 },
    // 下の選択パネルの下端に出すエラーメッセージ位置です。カード列と重ならないよう低めにしています。
    message: { x: SCREEN_CENTER.x, y: 722, fontSize: 12 },
    // ごみボタンの色と文字サイズです。位置と当たり判定はtrashDropZoneを使います。
    trashButton: { fillColor: '#fff4f0', fontSize: 13 },
    // 小さくするボタンです。
    smallButton: { x: 341, y: 252, width: 46, height: 44, fontSize: 16 },
    // 大きくするボタンです。
    bigButton: { x: 341, y: 310, width: 46, height: 44, fontSize: 16 },
    // 回転ボタンです。
    rotateButton: { x: 341, y: 368, width: 46, height: 44, fontSize: 13 },
    // キャラクター変更ボタンです。2文字より長いので少し縦長にしています。
    changeButton: { x: 341, y: 426, width: 46, height: 52, fontSize: 12 },
    // 購入済みのタイトル背景を順送りで切り替えるボタンです。
    backgroundButton: { x: 341, y: 492, width: 46, height: 52, fontSize: 12 },
    // 画面下の保存ボタンです。
    saveButton: { x: SCREEN_CENTER.x, y: 794, width: 150, height: 52, fontSize: 18 },
  },

  titleBackground: {
    previewRadius: 12,
  },

  stageBackdrop: {
    imageDepth: -40,
    panelDepth: -30,
    captureReadabilityPanel: { x: 18, y: 254, width: GAME_WIDTH - 36, height: 548, radius: 28 },
    introHeaderPanel: { x: 20, y: 82, width: GAME_WIDTH - 40, height: 178, radius: 28 },
    introMonsterPanel: { x: 20, y: 276, width: GAME_WIDTH - 40, height: 340, radius: 28 },
  },

  stageIntro: {
    playLimitGauge: { x: SCREEN_CENTER.x, y: 676, squareSize: 11, gap: 3, fontSize: 15 },
    startButton: { x: SCREEN_CENTER.x, y: 724, width: 304, height: 80 },
    rareBellHintPanel: { x: 58, y: 624, width: 274, height: 34, radius: 17 },
    rareBellHintText: { x: SCREEN_CENTER.x, y: 641, wrapWidth: 250 },
    backButton: { x: 42, y: 52 },
    menuButton: { x: 348, y: 52 },
    stageName: { x: SCREEN_CENTER.x, y: 104 },
    problemPanel: { x: 34, y: 148, width: 322, height: 104, radius: 18 },
    problemLabel: { x: SCREEN_CENTER.x, y: 184 },
    themeLabel: { x: SCREEN_CENTER.x, y: 220 },
    monsterSectionLabel: { x: 54, y: 304 },
    monsterCard: {
      width: 88,
      height: 124,
      radius: 16,
      visualOffsetY: -22,
      visualSize: 50,
      nameOffsetY: 24,
      labelOffsetY: 46,
      completeStarOffsetX: 30,
      completeStarOffsetY: -54,
    },
  },

  captureGame: {
    headerBackButton: { x: 42, y: 42 },
    headerMenuButton: { x: 348, y: 42 },
    headerTitle: { x: SCREEN_CENTER.x, y: 42, wrapWidth: 230 },
    monsterPanel: { x: 28, y: 78, width: 334, height: 166, radius: 20 },
    monsterCenter: { x: SCREEN_CENTER.x, y: 154 },
    monsterSize: 88,
    monsterName: { x: 64, y: 104 },
    itemText: { x: 306, y: 104 },
    progressBar: { x: 66, y: 222, width: 258, height: 12, ballRadius: 10 },
    answerText: { x: 0, y: 292 },
    feedbackText: { x: SCREEN_CENTER.x, y: 768 },
    keypad: {
      startX: 82,
      startY: 440,
      colGap: 112,
      rowGap: 82,
      keyWidth: 88,
      keyHeight: 64,
      digitFontSize: 28,
      actionFontSize: 18,
    },
    problemFormula: {
      y: 292,
      slotWidth: 74,
      slotHeight: 68,
      minLeftX: 28,
    },
    encounterPanel: { x: 42, y: 260, width: 306, height: 128, radius: 22 },
    encounterMessage: { x: SCREEN_CENTER.x, y: 324, wrapWidth: 260 },
    countdownPanel: { x: 88, y: 274, width: 214, height: 104, radius: 22 },
    countdownMessageY: 326,
    rareGlowRadii: { inner: 78, outer: 94 },
    throwPanel: { x: 48, y: 174, width: 294, height: 430, radius: 24 },
    throwBall: { x: SCREEN_CENTER.x, y: 362, size: 58 },
    throwLabel: { x: SCREEN_CENTER.x, y: 514 },
    throwArrow: { x: SCREEN_CENTER.x, y: 248 },
    throwDragTopY: 210,
    throwSuccessDistance: 72,
    fallingBallStart: { x: SCREEN_CENTER.x, y: -54, size: 28 },
    getPopupBurst: { x: SCREEN_CENTER.x, y: 304 },
    getPopupMonster: { x: SCREEN_CENTER.x, y: 256, size: 112 },
    getPopupMessage: { x: SCREEN_CENTER.x, y: 410, wrapWidth: 286 },
    getPopupButton: { x: SCREEN_CENTER.x, y: 570, width: 180, height: 62 },
  },

  loginBonus: {
    characters: LOGIN_BONUS_CHARACTER_PLACEMENTS,
  },

  battleSelect: {
    trainerCard: {
      trainer: { x: 70, size: 56 },
      partnerStartX: 106,
      partnerGap: 27,
      partnerSize: 34,
    },
    selectedTrainerSummary: {
      trainer: { x: 66, y: 143, size: 42 },
      partnerStartX: 100,
      partnerGap: 24,
      partnerY: 143,
      partnerSize: 30,
    },
    streakSummary: {
      trainer: { x: 66, y: 143, size: 42 },
      partner: { x: 112, y: 143, size: 34 },
    },
    partyChoice: {
      visualOffsetY: -16,
      visualSize: 44,
    },
  },

  battleGame: {
    opponentPartyIcon: {
      startX: 62,
      gap: 38,
      frameY: 132,
      visualY: 126,
      visualSize: 26,
    },
    opponentVisual: { x: SCREEN_CENTER.x, y: 144, size: 92 },
    partyIcon: {
      startX: 58,
      gap: 58,
      frameY: 348,
      visualY: 338,
      visualSize: 36,
    },
    activeMonster: { x: 314, y: 336, size: 48 },
    trainerIntro: {
      startX: -GAME_WIDTH * 0.85,
      y: SCREEN_CENTER.y + 38,
      size: 660,
      endX: GAME_WIDTH * 0.62,
    },
  },
} as const;
