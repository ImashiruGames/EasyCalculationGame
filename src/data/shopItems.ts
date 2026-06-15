export const SHOP_ITEM_IDS = {
  gaugeBall: 'gaugeBall',
  nakamaCall: 'nakamaCall',
  rareBell: 'rareBell',
  genkiBread: 'genkiBread',
} as const;

type ShopItemId = (typeof SHOP_ITEM_IDS)[keyof typeof SHOP_ITEM_IDS];

export interface ShopItemDefinition {
  id: ShopItemId;
  name: string;
  iconLabel: string;
  description: string;
  price: number;
  accentColor: string;
}

export const shopItems: ShopItemDefinition[] = [
  {
    id: SHOP_ITEM_IDS.gaugeBall,
    name: 'ゲージボール',
    iconLabel: '🥎',
    description: 'つぎの つかまえるで\nゲージが ぐんぐん ふえる',
    price: 30,
    accentColor: '#80d889',
  },
  {
    id: SHOP_ITEM_IDS.genkiBread,
    name: 'げんきパン',
    iconLabel: 'げ',
    description: 'つぎの しょうぶで\nみんなの げんき +15',
    price: 60,
    accentColor: '#ffb15e',
  },
  {
    id: SHOP_ITEM_IDS.nakamaCall,
    name: 'なかまよび',
    iconLabel: 'よ',
    description: 'いまの なかまを\nもういちど よびだす',
    price: 120,
    accentColor: '#b9a7ff',
  },
  {
    id: SHOP_ITEM_IDS.rareBell,
    name: 'レアベル',
    iconLabel: 'レ',
    description: 'レアがいる ステージで\nつぎは レアが でる',
    price: 1000,
    accentColor: '#ffd766',
  },
];
