import Phaser from 'phaser';

export class FloatingTextManager {
    /**
     * Display floating text that animates upward and fades out
     */
    public static showFloatingText(
        scene: Phaser.Scene, 
        text: string, 
        x: number, 
        y: number, 
        color: string, 
        fontSize = '16px'
    ): void {
        const randomXOffset = Phaser.Math.Between(-15, 15);
        const textObject = scene.add.text(x + randomXOffset, y, text, {
            fontFamily: 'Arial', // Using a pixel-art friendly font if available
            fontSize: fontSize,
            color: color,
            stroke: '#000000',
            strokeThickness: 3
        });
        textObject.setOrigin(0.5, 1); // Origin at bottom-center for upward float
        textObject.setDepth(1000); // Ensure it's above other game elements

        scene.tweens.add({
            targets: textObject,
            y: y - 50, // Float upwards by 50 pixels
            alpha: 0,  // Fade out
            duration: 1200, // Duration of 1.2 seconds
            ease: 'Power1',
            onComplete: () => {
                textObject.destroy();
            }
        });
    }

    /**
     * Display floating damage numbers
     */
    public static showDamageNumber(
        scene: Phaser.Scene,
        amount: number,
        x: number,
        y: number
    ): void {
        if (amount <= 0) return;

        this.showFloatingText(
            scene,
            amount.toString(),
            x,
            y,
            '#ff0000',
            '20px'
        );
    }
} 