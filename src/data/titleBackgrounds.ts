import { TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS } from '../game/layoutConfig';

export const TITLE_BACKGROUND_IDS = {
  stageGrasslands: 'stageGrasslands',
  stageIceCave: 'stageIceCave',
  stageFireMountain: 'stageFireMountain',
  stageThunderHighland: 'stageThunderHighland',
  stageWaterGarden: 'stageWaterGarden',
  stageMoonRuins: 'stageMoonRuins',
  stageTenTower: 'stageTenTower',
  stageSubtractionForest: 'stageSubtractionForest',
  stageStoneValley: 'stageStoneValley',
  stageDesertOasis: 'stageDesertOasis',
  stageClassroom: 'stageClassroom',
  stageIceDemonCastle: 'stageIceDemonCastle',
  stageMachineCity: 'stageMachineCity',
  stageSleepyRoad: 'stageSleepyRoad',
  stageCandyRoad: 'stageCandyRoad',
  stageGoldenCastle: 'stageGoldenCastle',
} as const;

export type TitleBackgroundId = (typeof TITLE_BACKGROUND_IDS)[keyof typeof TITLE_BACKGROUND_IDS];

export interface TitleMonsterDefaultPlacement {
  x: number;
  y: number;
  size: number;
}

export interface TitleBackgroundDefinition {
  id: TitleBackgroundId;
  name: string;
  description: string;
  price: number;
  accentColor: string;
  skyColor: string;
  titleColor: string;
  titleStrokeColor: string;
  subtitleColor: string;
  promptColor: string;
  imagePath: string;
  defaultMonsterPlacements: TitleMonsterDefaultPlacement[];
}

export const DEFAULT_TITLE_BACKGROUND_ID = TITLE_BACKGROUND_IDS.stageGrasslands;

export const titleBackgrounds: TitleBackgroundDefinition[] = [
  {
    id: TITLE_BACKGROUND_IDS.stageGrasslands,
    name: 'そうげん',
    description: 'はじまりのそうげんを タイトルに',
    price: 0,
    accentColor: '#80d889',
    skyColor: '#dff6ff',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/grasslands.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageIceCave,
    name: 'こおり',
    description: 'こおりのどうくつを タイトルに',
    price: 620,
    accentColor: '#9bdcf8',
    skyColor: '#e8f8ff',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/iceCave.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageFireMountain,
    name: 'ほのお',
    description: 'ほのおのやまを タイトルに',
    price: 620,
    accentColor: '#ffb15e',
    skyColor: '#fff4e8',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/fireMountain.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageThunderHighland,
    name: 'かみなり',
    description: 'かみなりの高台を タイトルに',
    price: 720,
    accentColor: '#f6d74f',
    skyColor: '#fff8d6',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/thunderHighland.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageWaterGarden,
    name: 'みずべ',
    description: 'みずべを タイトルに',
    price: 720,
    accentColor: '#70c7ff',
    skyColor: '#e5f8ff',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/waterGarden.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageMoonRuins,
    name: 'いせき',
    description: 'よるのいせきを タイトルに',
    price: 820,
    accentColor: '#b9a7ff',
    skyColor: '#eef0ff',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/moonRuins.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageTenTower,
    name: 'テンベル',
    description: 'テンベルのとうを タイトルに',
    price: 820,
    accentColor: '#ffd766',
    skyColor: '#fff9e8',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/tenTower.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageSubtractionForest,
    name: 'のこり',
    description: 'のこりのこみちを タイトルに',
    price: 720,
    accentColor: '#80d889',
    skyColor: '#eaffef',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/subtractionForest.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageStoneValley,
    name: 'いし',
    description: 'のこり石の谷を タイトルに',
    price: 820,
    accentColor: '#ffb15e',
    skyColor: '#fff3e7',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/stoneValley.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageDesertOasis,
    name: 'さばく',
    description: 'さばくのみちを タイトルに',
    price: 920,
    accentColor: '#f2bd64',
    skyColor: '#dff8ff',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/desertOasis.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageClassroom,
    name: 'きょうしつ',
    description: 'きょうしつを タイトルに',
    price: 920,
    accentColor: '#d4a050',
    skyColor: '#fff1c8',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/classroom.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageIceDemonCastle,
    name: 'こおりしろ',
    description: 'こおりのしろを タイトルに',
    price: 1020,
    accentColor: '#7be7ff',
    skyColor: '#e2fbff',
    titleColor: '#ffffff',
    titleStrokeColor: '#1687b4',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/iceDemonCastle.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageMachineCity,
    name: 'きかいまち',
    description: 'きかいのまちを タイトルに',
    price: 1020,
    accentColor: '#f0b35d',
    skyColor: '#eef4f2',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#fff3bf',
    imagePath: 'assets/backgrounds/machineCity.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageSleepyRoad,
    name: 'おやすみ',
    description: 'おやすみのみちを タイトルに',
    price: 1020,
    accentColor: '#b9a7ff',
    skyColor: '#f0eaff',
    titleColor: '#ffffff',
    titleStrokeColor: '#6f5fc9',
    subtitleColor: '#ffffff',
    promptColor: '#fff8c4',
    imagePath: 'assets/backgrounds/sleepyRoad.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageCandyRoad,
    name: 'おかしみち',
    description: 'おかしのみちを タイトルに',
    price: 920,
    accentColor: '#ff8ec5',
    skyColor: '#e2f8ff',
    titleColor: '#263143',
    titleStrokeColor: '#ffffff',
    subtitleColor: '#ffffff',
    promptColor: '#263143',
    imagePath: 'assets/backgrounds/candyRoad.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
  {
    id: TITLE_BACKGROUND_IDS.stageGoldenCastle,
    name: 'ごうかなしろ',
    description: 'ごうかなしろを タイトルに',
    price: 1120,
    accentColor: '#ffd766',
    skyColor: '#fff4d6',
    titleColor: '#fff6c7',
    titleStrokeColor: '#6b250f',
    subtitleColor: '#ffffff',
    promptColor: '#fff6c7',
    imagePath: 'assets/backgrounds/goldenCastle.webp',
    defaultMonsterPlacements: TITLE_BACKGROUND_DEFAULT_MONSTER_PLACEMENTS,
  },
];

const titleBackgroundById = new Map<string, TitleBackgroundDefinition>(
  titleBackgrounds.map((background) => [background.id, background]),
);

/** タイトル背景IDから定義を取得し、未知のIDなら最初の背景へ戻します。 */
export function getTitleBackgroundById(backgroundId: string): TitleBackgroundDefinition {
  return titleBackgroundById.get(backgroundId) ?? titleBackgrounds[0];
}

/** 保存データなどから来た背景IDが、現在の定義に存在するかを判定します。 */
export function isKnownTitleBackgroundId(backgroundId: string): backgroundId is TitleBackgroundId {
  return titleBackgroundById.has(backgroundId);
}

/** Phaserのテクスチャ管理で使う、タイトル背景ごとのキーを作ります。 */
export function getTitleBackgroundTextureKey(background: TitleBackgroundDefinition): string {
  return `title-background-${background.id}`;
}
