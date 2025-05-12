import Phaser from 'phaser';

export class InputController {
    private scene: Phaser.Scene;
    private cursorHideTimer?: Phaser.Time.TimerEvent;
    private readonly CURSOR_HIDE_DELAY = 300; // Time in ms to hide cursor after no movement
    
    private keyToggleEnemyDebug!: Phaser.Input.Keyboard.Key;
    private keyTogglePause!: Phaser.Input.Keyboard.Key;

    public cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.initKeys();
        this.setupCursorManagement();
    }

    /**
     * Initialize key bindings
     */
    private initKeys(): void {
     // Initialize cursor keys
        if (this.scene.input.keyboard) {
            this.cursors = this.scene.input.keyboard.createCursorKeys();
            // Add debug toggle key
            this.keyToggleEnemyDebug = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
            // Add pause toggle key
            this.keyTogglePause = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        }
    }

    /**
     * Set up cursor visibility behavior on pointer movement
     */
    private setupCursorManagement(): void {
        // Hide the cursor initially
        (this.scene.game.canvas as HTMLCanvasElement).style.cursor = 'none';
        
        // Listen for mouse movement to show and then hide cursor
        this.scene.input.on('pointermove', this.handleMouseMoveForCursor, this);
    }

    /**
     * Handle mouse movement - show cursor temporarily
     */
    private handleMouseMoveForCursor(): void {
        // Show the cursor
        (this.scene.game.canvas as HTMLCanvasElement).style.cursor = 'default';

        // Clear any existing timer
        if (this.cursorHideTimer) {
            this.cursorHideTimer.remove(false);
        }

        // Set a timer to hide the cursor again
        this.cursorHideTimer = this.scene.time.delayedCall(this.CURSOR_HIDE_DELAY, () => {
            if (this.scene.scene.isActive()) { // Only hide if the scene is still active
                (this.scene.game.canvas as HTMLCanvasElement).style.cursor = 'none';
            }
        }, [], this);
    }

    /**
     * Check if the enemy debug toggle key was just pressed
     */
    public isDebugTogglePressed(): boolean {
        return Phaser.Input.Keyboard.JustDown(this.keyToggleEnemyDebug);
    }

    /**
     * Check if the pause toggle key was just pressed
     */
    public isPauseTogglePressed(): boolean {
        return Phaser.Input.Keyboard.JustDown(this.keyTogglePause);
    }

    /**
     * Clean up event listeners and timers
     */
    public destroy(): void {
        // Restore the cursor
        (this.scene.game.canvas as HTMLCanvasElement).style.cursor = 'default';
        
        // Remove event listeners
        this.scene.input.off('pointermove', this.handleMouseMoveForCursor, this);
        
        // Clean up timer
        if (this.cursorHideTimer) {
            this.cursorHideTimer.remove(false);
            this.cursorHideTimer = undefined;
        }
    }
} 