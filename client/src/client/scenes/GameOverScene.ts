import Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    create(data: { wavesSurvived?: number }) {
        // Stop UpgradeUIScene if it's active
        if (this.scene.isActive('UpgradeUIScene')) {
            this.scene.stop('UpgradeUIScene');
        }

        // Semi-transparent background
        const graphics = this.add.graphics();
        graphics.fillStyle(0x000000, 0.7);
        graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Game Over text
        const gameOverText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 100,
            'Game Over',
            { fontSize: '64px', color: '#ff0000', fontStyle: 'bold', align: 'center' }
        ).setOrigin(0.5);

        // Add shadow to Game Over text
        gameOverText.setShadow(3, 3, 'rgba(0,0,0,0.7)', 5);

        // Fade-in animation for Game Over text
        gameOverText.setAlpha(0);
        this.tweens.add({
            targets: gameOverText,
            alpha: 1,
            duration: 1500,
            ease: 'Power2'
        });

        // Stats text
        const wavesText = data.wavesSurvived !== undefined ? `Waves Survived: ${data.wavesSurvived}` : 'Waves Survived: N/A';
        this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            wavesText,
            { fontSize: '24px', color: '#ffffff' }
        ).setOrigin(0.5);

        // Restart button (text-based for now)
        const restartButton = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 100,
            'Back to Lobby',
            { fontSize: '32px', color: '#00ff00', backgroundColor: '#333333', padding: { x: 20, y: 10 } }
        ).setOrigin(0.5).setInteractive();

        // Store original scale
        const originalButtonScale = restartButton.scale;

        restartButton.on('pointerdown', () => {
            // Assuming GameScene and HudScene were running
            this.scene.stop('GameScene');
            this.scene.stop('HudScene');
            this.scene.stop('UpgradeUIScene');
            this.scene.start('LobbyScene');
        });

        restartButton.on('pointerover', () => {
            restartButton.setStyle({ fill: '#ffff00' }); // Highlight on hover
            this.tweens.add({
                targets: restartButton,
                scaleX: originalButtonScale * 1.1,
                scaleY: originalButtonScale * 1.1,
                duration: 100,
                ease: 'Power1'
            });
        });

        restartButton.on('pointerout', () => {
            restartButton.setStyle({ fill: '#00ff00' }); // Reset on hover out
            this.tweens.add({
                targets: restartButton,
                scaleX: originalButtonScale,
                scaleY: originalButtonScale,
                duration: 100,
                ease: 'Power1'
            });
        });
    }
} 