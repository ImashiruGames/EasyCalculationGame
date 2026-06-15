import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import { getStageBackgroundAsset } from '../../assets/stageBackgroundAssets';
import { StageId } from '../../types';

/** ステージ背景画像を画面いっぱいに配置します。未登録のステージでは何も描画しません。 */
export function drawStageBackdrop(scene: Phaser.Scene, stageId: StageId): boolean {
  const asset = getStageBackgroundAsset(stageId);
  if (!asset || !scene.textures.exists(asset.key)) {
    return false;
  }

  const image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, asset.key).setDepth(APP_LAYOUT.stageBackdrop.imageDepth);
  const scale = Math.max(GAME_WIDTH / image.width, GAME_HEIGHT / image.height);
  image.setScale(scale);

  return true;
}

/** 背景画像の上でも計算式とキーが読めるよう、下側だけ薄い紙面を敷きます。 */
export function drawCaptureReadabilityPanel(scene: Phaser.Scene): void {
  const panel = APP_LAYOUT.stageBackdrop.captureReadabilityPanel;
  const graphics = scene.add.graphics().setDepth(APP_LAYOUT.stageBackdrop.panelDepth);
  graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.72);
  graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, panel.radius);
  graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.8);
  graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, panel.radius);
}

/** ステージ導入画面で、タイトルや出現モンスター一覧の背後だけを軽く読みやすくします。 */
export function drawStageIntroReadabilityPanels(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics().setDepth(APP_LAYOUT.stageBackdrop.panelDepth);
  const panelColor = Phaser.Display.Color.HexStringToColor(COLORS.panel).color;
  const headerPanel = APP_LAYOUT.stageBackdrop.introHeaderPanel;
  const monsterPanel = APP_LAYOUT.stageBackdrop.introMonsterPanel;

  graphics.fillStyle(panelColor, 0.68);
  graphics.fillRoundedRect(headerPanel.x, headerPanel.y, headerPanel.width, headerPanel.height, headerPanel.radius);
  graphics.fillStyle(panelColor, 0.62);
  graphics.fillRoundedRect(monsterPanel.x, monsterPanel.y, monsterPanel.width, monsterPanel.height, monsterPanel.radius);
}
