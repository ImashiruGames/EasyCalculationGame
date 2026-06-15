import { cloneStoryCreatorPlacement, type StoryCreatorDraft, type StoryCreatorPage } from '../../state/storyCreator';

interface EmbeddedStoryJson {
  version?: number;
  story?: StoryCreatorDraft;
  stories?: StoryCreatorDraft[];
}

type EmbeddedStoryTriggerKind = 'monsterDex' | 'stageIntro';

interface EmbeddedStoryTrigger {
  kind: EmbeddedStoryTriggerKind;
  targetId: string;
  storyId: string;
}

const embeddedStoryTriggers: EmbeddedStoryTrigger[] = [
  {
    kind: 'monsterDex',
    targetId: 'picoleaf',
    storyId: 'story-dex-picoleaf',
  },
  {
    kind: 'monsterDex',
    targetId: 'godchiri',
    storyId: 'story-dex-godchiri',
  },
];

const storyJsonModules = import.meta.glob<EmbeddedStoryJson>('./*.json', {
  eager: true,
  import: 'default',
});

const embeddedStoryDrafts = [
  ...Object.values(storyJsonModules).flatMap((module) => getStoryDraftsFromJsonModule(module)),
].filter((story): story is StoryCreatorDraft => Boolean(story?.id && Array.isArray(story?.pages)));

/** JSONモジュールの単体または複数ストーリーを、検索しやすい配列へそろえます。 */
function getStoryDraftsFromJsonModule(module: EmbeddedStoryJson): StoryCreatorDraft[] {
  return [
    module.story,
    ...(Array.isArray(module.stories) ? module.stories : []),
  ].filter((story): story is StoryCreatorDraft => Boolean(story?.id && Array.isArray(story?.pages)));
}

/** 埋め込み用ストーリーをIDから探し、画面側で変更しても元データが壊れないよう複製して返します。 */
export function getEmbeddedStoryDraftById(id: string): StoryCreatorDraft | undefined {
  const draft = embeddedStoryDrafts.find((story) => story.id === id);
  return draft ? cloneStoryDraft(draft) : undefined;
}

/** モンスターずかんで対象モンスターにひもづくストーリーを返します。 */
export function getEmbeddedStoryDraftForMonsterDex(monsterId: string): StoryCreatorDraft | undefined {
  return getFirstEmbeddedStoryDraftForTarget('monsterDex', monsterId)
    ?? getEmbeddedStoryDraftById(getMonsterDexStoryId(monsterId));
}

/** ステージ開始前に対象ステージへひもづくストーリーを返します。 */
export function getEmbeddedStoryDraftForStageIntro(stageId: string): StoryCreatorDraft | undefined {
  return getFirstEmbeddedStoryDraftForTarget('stageIntro', stageId);
}

/** 呼び出し場所と対象IDに合う最初のストーリーを、登録表から探します。 */
function getFirstEmbeddedStoryDraftForTarget(kind: EmbeddedStoryTriggerKind, targetId: string): StoryCreatorDraft | undefined {
  const trigger = embeddedStoryTriggers.find((entry) => entry.kind === kind && entry.targetId === targetId);
  return trigger ? getEmbeddedStoryDraftById(trigger.storyId) : undefined;
}

/** モンスターIDから、ずかん用ストーリーの標準IDを作ります。 */
function getMonsterDexStoryId(monsterId: string): string {
  return `story-dex-${monsterId}`;
}

/** ストーリー下書き全体を複製します。 */
function cloneStoryDraft(draft: StoryCreatorDraft): StoryCreatorDraft {
  return {
    id: draft.id,
    name: draft.name,
    updatedAt: draft.updatedAt,
    pages: draft.pages.map((page) => cloneStoryPage(page)),
  };
}

/** ストーリーの1ページを複製します。 */
function cloneStoryPage(page: StoryCreatorPage): StoryCreatorPage {
  return {
    text: page.text,
    speaker: { ...page.speaker },
    placements: page.placements.map((placement) => cloneStoryCreatorPlacement(placement)),
    soundEffectId: page.soundEffectId,
  };
}
