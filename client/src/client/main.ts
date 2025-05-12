import Phaser from 'phaser';
import phaserConfig from './phaserConfig';
import BootScene from './scenes/BootScene';
import LobbyScene from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import HudScene from './ui/HudScene';
import { UpgradeUIScene } from './ui/UpgradeUIScene';
import GameOverScene from './ui/GameOverScene';

const game = new Phaser.Game({
    ...phaserConfig,
    scene: [BootScene, LobbyScene, GameScene, HudScene, UpgradeUIScene, GameOverScene] 
});

export default game; 