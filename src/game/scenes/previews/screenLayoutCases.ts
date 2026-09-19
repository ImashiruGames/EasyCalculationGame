import * as Phaser from 'phaser';
import { monsters } from '../../../data/monsters';
import { stages } from '../../../data/stages';
import { trainers } from '../../../data/trainers';
import { debugTalkStoryScript } from '../../../data/storyScripts';
import { getDailyLoginBonusStatus, loadSaveState } from '../../../state/save';
import { SceneKeys } from '../../sceneKeys';
import { showGameMenu } from '../../ui/common/gameMenu';
import { showRankUpOverlayIfNeeded } from '../../ui/achievements/rankUpOverlay';
import { AchievementsScene } from '../achievements/AchievementsScene';
import { BattleGameScene } from '../battle/BattleGameScene';
import { BattleSelectScene } from '../battle/BattleSelectScene';
import { CaptureGameScene } from '../capture/CaptureGameScene';
import { ResultScene } from '../capture/ResultScene';
import { StageIntroScene } from '../capture/StageIntroScene';
import { StageSelectScene } from '../capture/StageSelectScene';
import { DailyMissionsScene } from '../dailyMissions/DailyMissionsScene';
import { EvolutionScene } from '../evolution/EvolutionScene';
import { LoadingScene } from '../loading/LoadingScene';
import { LoginBonusScene } from '../login/LoginBonusScene';
import { DebugBgmScene } from '../menu/DebugBgmScene';
import { GridProblemEditorScene } from '../menu/GridProblemEditorScene';
import { MainMenuScene } from '../menu/MainMenuScene';
import { StoryCreatorScene } from '../story/StoryCreatorScene';
import { StoryListScene } from '../story/StoryListScene';
import { StoryPreviewScene } from '../story/StoryPreviewScene';
import { StoryScene } from '../story/StoryScene';
import { TitleEditScene } from '../title/TitleEditScene';
import { TitleNoticeScene } from '../title/TitleNoticeScene';
import { TitleScene } from '../title/TitleScene';
import { TransferScene } from '../transfer/TransferScene';
import { BattlePreviewScene } from './BattlePreviewScene';
import { DexPreviewScene } from './DexPreviewScene';
import { ShopPreviewScene } from './ShopPreviewScene';
import { createLayoutStory, seedLayoutFixtures, type PreviewProfile } from './screenLayoutFixtures';

export { seedLayoutFixtures };

export const layoutSceneTypes = [
  TitleScene, TitleNoticeScene, LoadingScene, LoginBonusScene, MainMenuScene,
  StageSelectScene, StageIntroScene, CaptureGameScene, ResultScene, EvolutionScene,
  BattleSelectScene, BattleGameScene, DexPreviewScene, ShopPreviewScene, AchievementsScene,
  DailyMissionsScene, TitleEditScene, TransferScene, StoryScene, StoryListScene,
  StoryCreatorScene, StoryPreviewScene, DebugBgmScene, GridProblemEditorScene, BattlePreviewScene,
];

interface PreviewMethodCall { method: string; args?: unknown[]; }
export interface ScreenLayoutCase {
  id: string;
  title: string;
  scene: string;
  source: string;
  notes: string[];
  steps: string;
  data?: object;
  prepare?: 'battleResult';
  calls?: PreviewMethodCall[];
  fields?: Record<string, unknown>;
  overlay?: 'menu' | 'rank' | 'loginReward';
  freezeTime?: boolean;
}

/** Creates numbered cases from current content, keeping the existing audit's screen numbers. */
export function createScreenLayoutCases(profile: PreviewProfile): ScreenLayoutCase[] {
  const longMonster = monsters.reduce((longest, monster) => monster.name.length > longest.name.length ? monster : longest);
  const stage = stages.find(entry => entry.id.startsWith('g2-nagasa-')) ?? stages[0];
  const draft = createLayoutStory(profile === 'long');
  const battleData = { trainerId: trainers[0].id, partyMonsterIds: monsters.slice(0, 3).map(monster => monster.id) };
  return [
    { id: '01', title: 'タイトル', scene: SceneKeys.Title, source: 'title/TitleScene.ts', notes: ['おしらせボタンを上へ、タイトルを下へうごかして、間をあけました。', '「1けた計算で なかまをふやそう」の文は、今後かえることを考えます。'], steps: '「けいさん」の「ん」と、おしらせボタンの間を見てください。' },
    { id: '02', title: 'お知らせ', scene: SceneKeys.TitleNotice, source: 'title/TitleNoticeScene.ts', notes: ['カードの高さを112から136へ広げました。4つのカードの下は y668 です。', '本文をタイトルの下に合わせ、6の間をあけました。まえ・つぎの上は y685 です。'], steps: 'タイトル2行・本文4行のカードを見てください。「長文のサンプル」でも見くらべられます。' },
    { id: '03', title: 'よみこみ', scene: SceneKeys.Loading, source: 'loading/LoadingScene.ts', data: { minimumDisplayMs: 600000 }, notes: ['ユーザーが見て、今のレイアウトはこのままでよいとなりました。', 'よみこみ中の見せ方は、今後考えます。'], steps: '見る時間をとるため、つぎへうつるまで10分にしています。' },
    { id: '04-1', title: 'ログイン', scene: SceneKeys.LoginBonus, source: 'login/LoginBonusScene.ts', freezeTime: true, notes: ['7日分のスタンプと、下の文字の間。'], steps: 'スタンプのはじめで止めてひらきます。' },
    { id: '04-2', title: 'ログインのごほうび', scene: SceneKeys.LoginBonus, source: 'login/LoginBonusScene.ts', freezeTime: true, overlay: 'loginReward', notes: ['ごほうび名が長いときに、パネルの外へ出ないか。'], steps: 'ごほうびのパネルをひらきます。' },
    { id: '05', title: 'ホーム', scene: SceneKeys.MainMenu, source: 'menu/MainMenuScene.ts', notes: ['ユーザーが見て、今のレイアウトはこのままでよいとなりました。', '新しいボタンを入れる時に、もう一度考えます。'], steps: 'ホームをひらきます。デバッグのお話ボタンも出ます。' },
    { id: '06-1', title: 'ジャンル', scene: SceneKeys.StageSelect, source: 'capture/StageSelectScene.ts', data: { openCategoryList: true }, notes: ['カードの間を34から22へせばめ、ページの数字の下に間をあけました。', 'ページの数字は y142、一番上のカードの上は y158 です。'], steps: 'ジャンルのリストをひらきます。学年をかえることもできます。' },
    { id: '06-2', title: 'ステージ', scene: SceneKeys.StageSelect, source: 'capture/StageSelectScene.ts', data: { stageId: stage.id }, notes: ['ユーザーが見て、今のレイアウトはこのままでよいとなりました。'], steps: '長さのジャンルをひらきます。ページをおくって見てください。' },
    { id: '06-3', title: '学年', scene: SceneKeys.StageSelect, source: 'capture/StageSelectScene.ts', data: { openCategoryList: true }, calls: [{ method: 'showPracticeLevelPanel', args: ['grade2'] }], notes: ['ユーザーが見て、今のレイアウトはこのままでよいとなりました。'], steps: '学年をえらぶパネルをひらきます。' },
    { id: '07', title: 'ステージのはじめ', scene: SceneKeys.StageIntro, source: 'capture/StageIntroScene.ts', data: { stageId: stage.id, skipIntroStory: true }, notes: ['ユーザーが見て、今のレイアウトはこのままでよいとなりました。'], steps: '長さのステージを、お話の後からひらきます。' },
    { id: '09', title: 'つかまえた後', scene: SceneKeys.Result, source: 'capture/ResultScene.ts', data: { monsterId: longMonster.id, stageId: stage.id, wasNew: true, captureCount: 3 }, notes: ['かけらとアメの行に広さをとり、アメを14pxの文字にしました。', '「ちがうステージへ」は、今いたジャンルのステージリスト（6-2）へもどります。'], steps: 'アメの数と「ちがうステージへ」を見てください。サンプルのアメは20こです。' },
    { id: '10', title: 'しんか', scene: SceneKeys.Evolution, source: 'evolution/EvolutionScene.ts', freezeTime: true, notes: ['ユーザーが見て、今のレイアウトはこのままでよいとなりました。'], steps: 'サンプルではしんか先も見つけたことにして、画めんを止めています。' },
    { id: '11-1', title: 'しょうぶのあいて', scene: SceneKeys.BattleSelect, source: 'battle/BattleSelectScene.ts', data: { openTrainerList: true }, notes: ['あいての名前・せつめいと、右のボタンの間。'], steps: 'あいてのリストをひらきます。' },
    { id: '11-2', title: 'しょうぶのなかま', scene: SceneKeys.BattleSelect, source: 'battle/BattleSelectScene.ts', data: battleData, notes: ['あいての数・げんきと、さいしょのモンスター名を2行に分けました。', '数え方を、1ぴき・2ひき・3びきのように数に合わせました。'], steps: '上のあいての文字がカードに入っているか見てください。' },
    { id: '12-2a', title: 'しょうぶにかった後', scene: SceneKeys.BattleGame, source: 'battle/BattleGameScene.ts', data: battleData, prepare: 'battleResult', calls: [{ method: 'showWinOverlay' }], notes: ['ごほうびの文が長くなったときと、下のボタンの間。'], steps: '計算をせずに、かった後のパネルをひらきます。' },
    { id: '12-2b', title: 'しょうぶにまけた後', scene: SceneKeys.BattleGame, source: 'battle/BattleGameScene.ts', data: battleData, prepare: 'battleResult', calls: [{ method: 'showLoseOverlay' }], notes: ['メッセージと、もういちど・もどるのボタンの間。'], steps: '計算をせずに、まけた後のパネルをひらきます。' },
    { id: '13-1', title: 'ずかんのリスト', scene: SceneKeys.DexPreview, source: 'previews/DexPreviewScene.ts', notes: ['「タイトルへんしゅう」を1行にし、ボタンのよこを130から158へ広げました。', 'となりのボタンとの間は22です。'], steps: '上の「タイトルへんしゅう」の文字とボタンの間を見てください。' },
    { id: '13-2', title: 'ずかんのくわしい画めん', scene: SceneKeys.DexPreview, source: 'previews/DexPreviewScene.ts', data: { pageIndex: Math.floor(monsters.indexOf(longMonster) / 10) }, calls: [{ method: 'showMonsterDetail', args: [longMonster, loadSaveState()] }], notes: ['「とじる」をパネルの下へうつし、上はモンスター名だけにしました。', '名前が長いときは、よこ306でおりかえします。'], steps: `今のデータで名前が一番長い ${longMonster.name} をひらきます。下の「とじる」も見てください。` },
    { id: '14-1', title: 'ショップ・買った後', scene: SceneKeys.ShopPreview, source: 'previews/ShopPreviewScene.ts', data: { tab: 'buy', message: 'ゲージボールを 買ったよ！' }, notes: ['買った後の文字 y166 が、一番上のカード y156〜272 のうらに入る。', 'アイテム名やせつめいと、右の買うボタンの間。'], steps: '買った後のメッセージを入れてひらきます。サンプルのコインで買うこともできます。' },
    { id: '14-2', title: 'ショップ・はいけい', scene: SceneKeys.ShopPreview, source: 'previews/ShopPreviewScene.ts', data: { tab: 'background' }, notes: ['はいけいの名前・せつめい・ボタンの間。'], steps: 'はいけいのページをひらきます。' },
    { id: '14-3', title: 'ショップ・こうかん', scene: SceneKeys.ShopPreview, source: 'previews/ShopPreviewScene.ts', data: { tab: 'exchange' }, notes: ['かけらとアメの文字・ボタンが画めんの下に入るか。'], steps: 'サンプルでは、かけらとアメをもっています。' },
    { id: '15', title: 'トロフィー', scene: SceneKeys.Achievements, source: 'achievements/AchievementsScene.ts', notes: ['ランク名と「のメダリスト」を2行に分け、よこ206の中に入れました。', 'あつめた数と、つぎまでの数は、その下のべつの行に出します。'], steps: '上のメダルのとなりで、名前と数がかさならないか見てください。' },
    { id: '16', title: '今日のミッション', scene: SceneKeys.DailyMissions, source: 'dailyMissions/DailyMissionsScene.ts', notes: ['せつめいの右は x292、ボタンの左は x278。14だけ同じばしょをつかう。'], steps: 'サンプルでは「もらう」、「はじめから」では「いく」を見られます。' },
    { id: '17', title: 'タイトルをなおす', scene: SceneKeys.TitleEdit, source: 'title/TitleEditScene.ts', notes: ['大きさや角どをかえた絵と、文字・ボタンの間。'], steps: 'サンプルのモンスターでタイトルをなおせます。' },
    { id: '18-1', title: 'ひきつぎ', scene: SceneKeys.Transfer, source: 'transfer/TransferScene.ts', notes: ['QR の下のメッセージと、コピーのボタンの間。'], steps: '出ているコードもサンプルのセーブです。' },
    { id: '18-2', title: 'ひきつぎ・コード', scene: SceneKeys.Transfer, source: 'transfer/TransferScene.ts', calls: [{ method: 'showImportOverlay' }], notes: ['スマホのキーボードを出したときに、下のボタンまで見えるか。'], steps: 'コードを入れるパネルをひらきます。とじると画めんえらびにもどれます。' },
    { id: '19-1', title: '前のお話画めん', scene: SceneKeys.Story, source: 'story/StoryScene.ts', data: { mode: 'talk' }, notes: ['会話の本文と、下のボタンの間。'], steps: '今のホームからはひらかない、前のお話画めんです。' },
    { id: '19-2', title: '前のお話・ログ', scene: SceneKeys.Story, source: 'story/StoryScene.ts', data: { mode: 'talk', talkPageIndex: profile === 'long' ? debugTalkStoryScript.messages.length - 1 : 3 }, calls: [{ method: 'openLog' }], notes: ['本文は y274〜518 の中だけに出して、上下にスクロールできるようにしました。', '「とじる」は本文の下に止めてあります。', '全文の文字のわくが外へ出ていても、見える文字は本文のわくの中だけです。'], steps: '本文を上下になぞるか、マウスホイールで読んでください。「長文のサンプル」では、最後まで読んだログをひらきます。' },
    { id: '20', title: 'お話のリスト', scene: SceneKeys.StoryList, source: 'story/StoryListScene.ts', notes: ['名前の右は x204、本文の右は x212。「みる」の左 x184 と同じばしょをつかう。'], steps: '「長文のサンプル」にすると、長い名前と本文で見くらべられます。' },
    { id: '21', title: 'お話をつくる', scene: SceneKeys.StoryCreator, source: 'story/StoryCreatorScene.ts', data: { draft }, fields: { selectedPlacementIndex: 0 }, calls: [{ method: 'redraw' }], notes: ['キャラの「中へ」はパネルの右より20外に出る。', '数字・大きさ・はんてんの行も見る。'], steps: 'キャラをえらんだパネルをひらきます。' },
    { id: '22', title: 'お話を読む', scene: SceneKeys.StoryPreview, source: 'story/StoryPreviewScene.ts', data: { draft, returnScene: 'list' }, notes: ['本文は y694 から、白いわくの下 y814 まで120。長文の高さの上げんがない。'], steps: '「長文のサンプル」にすると、本文が下へ出るようすを見られます。' },
    { id: '23', title: 'BGM', scene: SceneKeys.DebugBgm, source: 'menu/DebugBgmScene.ts', notes: ['長い ID と名前が、同じ行でかさならないか。'], steps: 'ページをおくってそれぞれ行を見てください。' },
    { id: '24', title: '方がんをつくる', scene: SceneKeys.GridProblemEditor, source: 'menu/GridProblemEditorScene.ts', calls: [{ method: 'resizeGrid', args: [8, 8] }], notes: ['8×8の下は y540、モードボタンの上は y518。22だけ同じばしょをつかう。'], steps: '8×8にしてひらきます。計算のプレイ画めんではなく、作る画めんです。' },
    { id: '25', title: '前のしょうぶ入り口', scene: SceneKeys.BattlePreview, source: 'previews/BattlePreviewScene.ts', notes: ['今はタイトルと、もどるボタンの画めん。'], steps: '今のホームからはひらかない、前の入り口です。' },
    { id: '26-1', title: 'メニュー', scene: SceneKeys.MainMenu, source: 'ui/common/gameMenu.ts', overlay: 'menu', notes: ['ホーム・音・とじるの文字とボタンの間。'], steps: 'ホームにメニューをかさねてひらきます。' },
    { id: '26-2', title: 'ランクアップ', scene: SceneKeys.Achievements, source: 'ui/achievements/rankUpOverlay.ts', overlay: 'rank', notes: ['長いランク名と、下のトロフィー数の間。'], steps: 'サンプルのランクアップをひらきます。「はじめから」では出ないことがあります。' },
  ];
}

/** Invokes a private presentation method only inside this disposable development preview. */
function callPresentationMethod(scene: Phaser.Scene, call: PreviewMethodCall): void {
  const method: unknown = Reflect.get(scene, call.method);
  if (typeof method !== 'function') throw new Error(`Preview method missing: ${scene.sys.settings.key}.${call.method}`);
  Reflect.apply(method, scene, call.args ?? []);
}

/** Skips only the battle countdown so a result panel can be inspected immediately. */
function skipBattleIntro(): void {}

/** Installs presentation-only changes before the selected scene starts. */
export function prepareLayoutCase(scene: Phaser.Scene, entry: ScreenLayoutCase): void {
  if (entry.prepare === 'battleResult') Reflect.set(scene, 'showBattleIntro', skipBattleIntro);
}

/** Opens the requested panel after the real scene has completed create. */
export function openLayoutCase(scene: Phaser.Scene, entry: ScreenLayoutCase): void {
  if (entry.freezeTime) {
    scene.time.removeAllEvents();
    scene.tweens.pauseAll();
  }
  for (const [field, value] of Object.entries(entry.fields ?? {})) Reflect.set(scene, field, value);
  for (const call of entry.calls ?? []) callPresentationMethod(scene, call);
  if (entry.overlay === 'menu') showGameMenu(scene);
  if (entry.overlay === 'rank') showRankUpOverlayIfNeeded(scene, { ...loadSaveState(), acknowledgedAchievementRankIndex: -1 });
  if (entry.overlay === 'loginReward') {
    callPresentationMethod(scene, { method: 'showRewardOverlay', args: [getDailyLoginBonusStatus(loadSaveState())] });
  }
}
