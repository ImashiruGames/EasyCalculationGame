export type StoryActorKind = 'trainer' | 'monster';
export type StoryActorSlot = 'farLeft' | 'left' | 'center' | 'right' | 'farRight';

export interface StoryActorDefinition {
  id: string;
  name: string;
  kind: StoryActorKind;
  slot: StoryActorSlot;
  tagColor: string;
  trainerId?: string;
  monsterId?: string;
  portraitKey?: string;
  portraitPath?: string;
  portraitSize?: number;
  portraitOffsetX?: number;
  portraitOffsetY?: number;
}

export interface StoryActorPlacement {
  actorId: string;
  slot?: StoryActorSlot;
  x?: number;
  y?: number;
  scale?: number;
  flipX?: boolean;
  offsetX?: number;
  offsetY?: number;
  depth?: number;
}

export interface StoryMessageDefinition {
  speakerId: string;
  visibleActorIds?: string[];
  placements?: StoryActorPlacement[];
  text: string;
}

export interface StoryScriptDefinition {
  id: string;
  title: string;
  actors: StoryActorDefinition[];
  messages: StoryMessageDefinition[];
}

export const debugTalkStoryScript: StoryScriptDefinition = {
  id: 'debugTalk',
  title: 'ページおくり',
  actors: [
    {
      id: 'imashiru',
      name: 'イマシル',
      kind: 'trainer',
      slot: 'left',
      trainerId: 'trainer-noko',
      portraitKey: 'story-imashiru',
      portraitPath: 'assets/trainers/imashiru.webp',
      portraitSize: 260,
      portraitOffsetX: 18,
      tagColor: '#dff6ed',
    },
    {
      id: 'picoleaf',
      name: 'ピコリーフ',
      kind: 'monster',
      slot: 'right',
      monsterId: 'picoleaf',
      tagColor: '#fff1a8',
    },
  ],
  messages: [
    {
      speakerId: 'imashiru',
      placements: [{ actorId: 'imashiru', slot: 'left' }],
      text: 'はじめまして、イマシルです！\nページおくりの じっけんを するよ。',
    },
    {
      speakerId: 'imashiru',
      placements: [{ actorId: 'imashiru', slot: 'left' }],
      text: 'タッチで ページは おくれてるかな？',
    },
    {
      speakerId: 'imashiru',
      placements: [{ actorId: 'imashiru', slot: 'left' }],
      text: 'じゃあつぎは、キャラクターいれかえの\nじっけんを するよ',
    },
    {
      speakerId: 'picoleaf',
      placements: [{ actorId: 'picoleaf', slot: 'left' }],
      text: 'キュー！',
    },
    {
      speakerId: 'imashiru',
      placements: [
        { actorId: 'picoleaf', slot: 'left' },
        { actorId: 'imashiru', slot: 'right', scale: 0.86, offsetX: -30 },
      ],
      text: 'このこは、ピコリーフ！\nわたしの かわいい ペットだよ',
    },
    {
      speakerId: 'imashiru',
      placements: [{ actorId: 'imashiru', slot: 'left' }],
      text: 'じっけんおわり！\nおしまいにするね',
    },
  ],
};
