import { monsters } from '../../../data/monsters';
import { stages } from '../../../data/stages';
import { trainers } from '../../../data/trainers';
import { shopItems } from '../../../data/shopItems';
import { titleNoticeEntries } from '../../../data/titleNotices';
import { createDefaultSaveState } from '../../../state/save/constants';
import { saveState } from '../../../state/save/storage';
import { createDefaultStoryCreatorDraft, saveStoryCreatorDraft, type StoryCreatorDraft } from '../../../state/storyCreator';

export type PreviewProfile = 'standard' | 'long' | 'empty';

/** Builds an isolated example story without reading a user's saved stories. */
export function createLayoutStory(isLong: boolean): StoryCreatorDraft {
  const draft = createDefaultStoryCreatorDraft();
  draft.name = isLong ? '海で見つけた小さな友だちと長い長いお話' : '森のさんぽ';
  draft.pages[0].text = isLong
    ? '今日は みんなで 森へ 行きます。小さな 花や 大きな 木を 見つけました。\n'.repeat(8)
    : '今日は みんなで 森へ 行きます。\n小さな 花を 見つけたよ。';
  draft.pages[0].placements.push({
    kind: 'actor', actorId: 'picoleaf', side: 'left', x: 104, y: 350,
    scale: 1, flipX: false, motion: 'none', effect: 'none',
  });
  return draft;
}

/** Seeds only the in-memory store installed by the preview entry point. */
export function seedLayoutFixtures(profile: PreviewProfile): void {
  const state = createDefaultSaveState();
  state.acknowledgedAchievementRankIndex = 99;
  if (profile !== 'empty') {
    state.coins = profile === 'long' ? 999999999 : 12345;
    for (const monster of monsters) {
      state.captures[monster.id] = 3;
      state.fragments[monster.evolutionFamilyId] = 40;
      state.candies[monster.attribute] = 20;
    }
    for (const stage of stages) {
      state.stageCaptures[stage.id] = 20;
      state.stageMonsterCaptures[stage.id] = Object.fromEntries(stage.monsterIds.map(id => [id, 2]));
    }
    for (const trainer of trainers) state.battleWins[trainer.id] = 1;
    for (const item of shopItems) state.items[item.id] = 5;
    state.dailyMissions.captures = 10;
    state.dailyMissions.stageEntries = 10;
    state.dailyMissions.battleWins = 5;
    saveStoryCreatorDraft(createLayoutStory(profile === 'long'));
    const second = createLayoutStory(false);
    second.name = '海のお話';
    saveStoryCreatorDraft(second);
  }
  if (profile === 'long' && titleNoticeEntries[0]) {
    titleNoticeEntries[0] = {
      ...titleNoticeEntries[0],
      title: '長いお話と 新しいなかまが たくさんふえたよ！',
      body: 'みんなで 森へ 行こう。\n新しいなかまに 会えるよ。\n長いお話も 読めるよ。\n友だちと 楽しく あそぼう。',
    };
  }
  saveState(state);
}
