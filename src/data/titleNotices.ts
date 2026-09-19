export interface TitleNoticeEntry {
  id: string;
  dateLabel: string;
  title: string;
  body: string;
  accentColor: string;
}

export const titleNoticeEntries: TitleNoticeEntry[] = [
  {
    id: 'length-monsters-2026-09-19',
    dateLabel: '2026.09.19',
    title: '長さの なかまが ふえたよ！',
    body: 'ミリミリ星人と センチモンキーが\n長さの ステージに 出るよ！\nつかまえて ずかんで 見よう',
    accentColor: '#70c7ff',
  },
  {
    id: 'total-login-days-2026-09-19',
    dateLabel: '2026.09.19',
    title: 'ログインが 通算になったよ！',
    body: 'お休みしても スタンプはそのまま！\n今までの日数も 入るよ\n7日ごとに レアベルを ゲット！',
    accentColor: '#ffd766',
  },
  {
    id: 'length-seven-steps-2026-09-19',
    dateLabel: '2026.09.19',
    title: '長さの もんだいが ふえたよ！',
    body: 'cmとmmの 読み方から\nたし算・ひき算まで 7ステージ！\n新しい もんだいには new! が出るよ',
    accentColor: '#70c7ff',
  },
  {
    id: 'written-arithmetic-ones-first-2026-09-16',
    dateLabel: '2026.09.16',
    title: 'ひっ算が 入れやすくなったよ！',
    body: '答えは 一のくらいから\n十、百のくらいへ 入れよう\n「けす」で 一つもどれるよ',
    accentColor: '#70c7ff',
  },
  {
    id: 'clock-hour-hand-2026-08-30',
    dateLabel: '2026.08.30',
    title: '時計に 時間のもんだい！',
    body: 'みじかいはりを見て\n何時間たったか 答えるよ',
    accentColor: '#70c7ff',
  },
  {
    id: 'clock-elapsed-split-2026-08-30',
    dateLabel: '2026.08.30',
    title: '時計のもんだいを わけたよ！',
    body: '何分たったかと 何分後を\n時計ありと 文字だけで\nれんしゅうできるよ',
    accentColor: '#70c7ff',
  },
  {
    id: 'clock-elapsed-minutes-2026-08-26',
    dateLabel: '2026.08.26',
    title: '時計のもんだいがふえたよ！',
    body: '左の時計から 右の時計まで\n何分たったか 答えるよ',
    accentColor: '#70c7ff',
  },
  {
    id: 'notice-place-2026-08-15',
    dateLabel: '2026.08.15',
    title: 'おしらせの ばしょができたよ',
    body: 'コインで 買えるものや\nお話が ふえたときなどを\nここで チェックしよう！',
    accentColor: '#ffd766',
  },
  {
    id: 'sample-shop-news',
    dateLabel: 'れい',
    title: 'コインで どうぐが 買えるよ！',
    body: 'ゲージボールや レアベルなど\nショップに ならんだときは\nここで しらせるよ',
    accentColor: '#ff9bc3',
  },
  {
    id: 'sample-story-news',
    dateLabel: 'れい',
    title: 'お話が あいたよ！',
    body: 'だれの お話か\nここで 見られるよ',
    accentColor: '#9bdcf8',
  },
];

/** Returns the newest notice id based on the list order. */
export function getLatestTitleNoticeId(): string | null {
  return titleNoticeEntries[0]?.id ?? null;
}

/** Checks whether a notice should be treated as new for a saved seen id. */
export function isTitleNoticeNewerThan(entryId: string, lastSeenId: string | null): boolean {
  const entryIndex = titleNoticeEntries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) {
    return false;
  }

  if (!lastSeenId) {
    return entryIndex === 0;
  }

  const seenIndex = titleNoticeEntries.findIndex((entry) => entry.id === lastSeenId);
  return seenIndex < 0 || entryIndex < seenIndex;
}
