export const captureBackgroundPromptSpec = {
  recommendedSize: '1080x1920 or 1024x1792',
  commonDirectives: [
    'vertical mobile game background, 9:16 composition',
    'cute child friendly monster catching game, soft rounded shapes',
    'bright cheerful colors, gentle contrast, painterly cartoon style',
    'clear open space in the center for one monster, uncluttered bottom area for math UI',
    'no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    'keep important scenery near the edges and upper background, readable center area',
  ],
  negativePrompt:
    'photorealistic, dark horror, realistic humans, scary monsters, readable text, numbers, letters, user interface, buttons, watermark, logo, cluttered center, busy foreground',
  backgrounds: [
    {
      stageId: 'grasslands',
      stageName: 'はじまりのそうげん',
      mood: 'やさしくて安心できる、最初のステージらしい明るさ',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, soft rounded meadow, fresh green grass, small wildflowers, fluffy round bushes, distant pastel hills, warm morning sunlight, tiny leaf particles, central oval clearing for a monster, uncluttered lower foreground for math UI, bright cheerful colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'iceCave',
      stageName: 'こおりのどうくつ',
      mood: '冷たいけれど怖くない、きらきらした洞窟',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, cozy ice cave, rounded blue ice walls, soft snow floor, sparkling crystals around the edges, pale cyan glow, frosty mist, small snowflake particles, central smooth icy clearing for a monster, uncluttered lower foreground for math UI, bright magical colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'fireMountain',
      stageName: 'ほのおのやま',
      mood: '熱いけれど危なく見えすぎない、元気な火山',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, playful volcanic mountain, rounded dark rocks, warm orange lava glow in the distance, ember particles near the edges, safe flat stone platform in the center, soft smoke clouds, golden sunset light, uncluttered lower foreground for math UI, energetic cheerful colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'thunderHighland',
      stageName: 'かみなりのたかだい',
      mood: 'わくわくする高台、雷は遠くで光る程度',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, grassy highland above the clouds, rounded cliffs, fluffy gray and white clouds near the top, small golden lightning glow far in the sky, wind swirls, bright yellow accents, central open grassy platform for a monster, uncluttered lower foreground for math UI, adventurous cheerful colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'waterGarden',
      stageName: 'みずべのにわ',
      mood: '水辺の庭らしい透明感と落ち着き',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, peaceful water garden, shallow clear pond, lily pads around the edges, rounded stepping stones, soft reeds and small flowers, gentle water ripples, turquoise and mint palette, central dry stone clearing for a monster, uncluttered lower foreground for math UI, bright soothing colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'moonRuins',
      stageName: 'よるのいせき',
      mood: '夜だけど暗すぎない、不思議で静かな遺跡',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, gentle moonlit ruins, rounded ancient stone arches, soft purple night sky, crescent moon glow, tiny star lights, mossy stone floor, magical blue fireflies near the edges, central open ruin platform for a monster, uncluttered lower foreground for math UI, dreamy calm colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'tenTower',
      stageName: '10のとう',
      mood: '10を作る練習に合う、パズル感のある明るい塔',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, whimsical golden tower interior, rounded puzzle blocks without symbols, ten small glowing windows arranged around the edges, soft stair shapes, warm yellow light, floating sparkle particles, central circular platform for a monster, uncluttered lower foreground for math UI, clever playful colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'subtractionForest',
      stageName: 'ひきざんのもり',
      mood: '引き算でも暗くならない、考える森',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, quiet thinking forest, rounded tree trunks, leafy canopy framing the top, small empty leaf-shaped spaces in the foliage, soft sunbeams, mossy path, gentle green and teal palette, central open forest clearing for a monster, uncluttered lower foreground for math UI, calm friendly colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
    {
      stageId: 'stoneValley',
      stageName: 'いしのたに',
      mood: '岩場だけど重くなりすぎない、宝探し感のある谷',
      prompt:
        'vertical mobile game background, 9:16 composition, cute child friendly monster catching game, warm stone valley, rounded canyon walls, smooth pebble ground, small colorful crystals around the edges, soft orange and lavender sky, gentle dust sparkles, central flat stone clearing for a monster, uncluttered lower foreground for math UI, adventurous warm colors, gentle contrast, painterly cartoon style, no characters, no monsters, no people, no text, no numbers, no UI, no logo',
    },
  ],
};
