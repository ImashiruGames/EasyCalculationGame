import { SHOP_ITEM_IDS, shopItems } from './shopItems';

export type DailyMissionProgressKey = 'stageEntries' | 'captures' | 'battleWins';

export interface DailyMissionReward {
  coins?: number;
  itemId?: string;
  itemCount?: number;
}

export interface DailyMissionDefinition {
  id: string;
  title: string;
  description: string;
  progressKey: DailyMissionProgressKey;
  target: number;
  reward: DailyMissionReward;
  accentColor: string;
}

export const dailyMissions: DailyMissionDefinition[] = [
  {
    id: 'stage-entries-2',
    title: 'ステージへ2かい',
    description: 'ステージに2かいはいる',
    progressKey: 'stageEntries',
    target: 2,
    reward: { coins: 20 },
    accentColor: '#70c7ff',
  },
  {
    id: 'captures-2',
    title: '2ひきゲット',
    description: 'モンスターを2ひきつかまえる',
    progressKey: 'captures',
    target: 2,
    reward: { itemId: SHOP_ITEM_IDS.gaugeBall, itemCount: 1 },
    accentColor: '#80d889',
  },
  {
    id: 'battle-wins-1',
    title: 'しょうぶ1かい',
    description: 'しょうぶに1かいかつ',
    progressKey: 'battleWins',
    target: 1,
    reward: { itemId: SHOP_ITEM_IDS.genkiBread, itemCount: 1 },
    accentColor: '#ffb15e',
  },
];

export const DAILY_MISSION_ALL_CLEAR_REWARD: DailyMissionReward = {
  itemId: SHOP_ITEM_IDS.rareBell,
  itemCount: 1,
};

/** ミッション報酬の中身を、一覧やポップアップで出す短いラベルにします。 */
export function getDailyMissionRewardLabel(reward: DailyMissionReward): string {
  const labels: string[] = [];
  if (reward.coins && reward.coins > 0) {
    labels.push(`コイン${reward.coins}こ`);
  }

  if (reward.itemId && reward.itemCount && reward.itemCount > 0) {
    const item = shopItems.find((candidate) => candidate.id === reward.itemId);
    labels.push(`${item?.name ?? reward.itemId}${reward.itemCount}こ`);
  }

  return labels.join(' + ');
}
