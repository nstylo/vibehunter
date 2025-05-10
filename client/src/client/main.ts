import Phaser from 'phaser';
import phaserConfig from './phaserConfig';
import BootScene from './scenes/BootScene';
import LobbyScene from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import HudScene from './scenes/HudScene';
import { UpgradeUIScene } from './scenes/UpgradeUIScene';
import GameOverScene from './scenes/GameOverScene';

const game = new Phaser.Game({
    ...phaserConfig,
    scene: [BootScene, LobbyScene, GameScene, HudScene, UpgradeUIScene, GameOverScene] 
});

export default game; 