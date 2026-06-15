import { monsters } from './monsters';

export type StoryCreatorActorKind = 'trainer' | 'monster';

export interface StoryCreatorActorChoice {
  id: string;
  name: string;
  kind: StoryCreatorActorKind;
  trainerId?: string;
  monsterId?: string;
  visualSize: number;
  defaultScale: number;
  tagColor: string;
  group: 'person' | 'character';
}

const storyCreatorPersonChoices: StoryCreatorActorChoice[] = [
  {
    id: 'imashiru',
    name: 'イマシル',
    kind: 'trainer',
    trainerId: 'trainer-imashiru',
    visualSize: 248,
    defaultScale: 1,
    tagColor: '#eadcff',
    group: 'person',
  },
  {
    id: 'haru',
    name: 'ハル',
    kind: 'trainer',
    trainerId: 'trainer-haru',
    visualSize: 184,
    defaultScale: 1,
    tagColor: '#dff6ed',
    group: 'person',
  },
  {
    id: 'noko',
    name: 'ノコ',
    kind: 'trainer',
    trainerId: 'trainer-noko',
    visualSize: 184,
    defaultScale: 1,
    tagColor: '#dff6ed',
    group: 'person',
  },
];

const storyCreatorMonsterChoices: StoryCreatorActorChoice[] = monsters.map((monster) => ({
  id: monster.id,
  name: monster.name,
  kind: 'monster',
  monsterId: monster.id,
  visualSize: 146,
  defaultScale: 1,
  tagColor: monster.palette.background,
  group: 'character',
}));

export const storyCreatorActorChoices: StoryCreatorActorChoice[] = [
  ...storyCreatorPersonChoices,
  ...storyCreatorMonsterChoices,
];

export const storyCreatorCharacterChoices = storyCreatorMonsterChoices;

export const storyCreatorTrainerIds = storyCreatorActorChoices
  .map((actor) => actor.trainerId)
  .filter((trainerId): trainerId is string => Boolean(trainerId));

export const storyCreatorMonsterIds = storyCreatorActorChoices
  .map((actor) => actor.monsterId)
  .filter((monsterId): monsterId is string => Boolean(monsterId));
