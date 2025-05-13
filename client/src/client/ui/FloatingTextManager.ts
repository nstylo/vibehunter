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
        textObject.setDepth(9999); // Set a very high depth to ensure it's on top

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
        y: number,
        isCritical = false
    ): void {
        if (amount <= 0) return;

        // Choose color and size based on critical status
        const color = isCritical ? '#ff0000' : '#ffffff'; // Red for critical, White for normal
        const fontSize = isCritical ? '24px' : '20px'; // Larger font for critical hits
        const textSuffix = isCritical ? '!' : ''; // Add exclamation for critical hits

        this.showFloatingText(
            scene,
            amount.toString() + textSuffix, // Append suffix
            x,
            y,
            color, // Use determined color
            fontSize // Use determined font size
        );
    }
} 