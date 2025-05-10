import Phaser from 'phaser';
import NetworkSystem from '../systems/NetworkSystem'; // Updated import path

// Define a type for the server's game starting message if possible
interface GameStartingMessagePayload {
    playerId: string;
    initialPosition: { x: number; y: number };
    worldSeed?: number; // Added world seed
    isReadyToStart?: boolean; // Optional, based on the condition in onMessageReceived
    reason?: string; // For errors
    // ... other relevant initial data
}

interface ServerMessage {
    type: string; // e.g., 'gameStarting', 'lobbyUpdate', 'joinError'
    payload?: GameStartingMessagePayload | unknown; // Changed 'any' to 'unknown'
}

export default class LobbyScene extends Phaser.Scene {
    private networkSystem!: NetworkSystem;
    private statusText!: Phaser.GameObjects.Text;
    private joinButton!: Phaser.GameObjects.Text; // Using text as a simple button

    constructor() {
        super({ key: 'LobbyScene' });
    }

    create() {
        // Initialize NetworkSystem
        this.networkSystem = new NetworkSystem();
        // Store it in the registry if you want other scenes/systems to access this instance
        this.registry.set('networkSystem', this.networkSystem);


        this.statusText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, 'Connecting to server...', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.joinButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 50, 'Join Game', {
            fontSize: '32px',
            color: '#00ff00',
            backgroundColor: '#555555',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleJoinGameClick())
        .setVisible(false); // Initially hidden until connected

        // Attempt to connect
        // Replace with your actual WebSocket server URL
        const serverUrl = 'ws://localhost:8080/ws'; // Example server URL
        this.networkSystem.connect(serverUrl);

        // Listen for network events
        this.networkSystem.on('connected', this.onConnected, this);
        this.networkSystem.on('messageReceived', this.onMessageReceived, this);
        this.networkSystem.on('disconnected', this.onDisconnected, this);
        this.networkSystem.on('error', this.onConnectionError, this);
    }

    private onConnected() {
        this.statusText.setText('Connected! Click Join Game to start.');
        this.joinButton.setVisible(true);
    }

    private onConnectionError(error: Event) {
        this.statusText.setText('Connection Failed. Please refresh.');
        this.joinButton.setVisible(false);
    }

    private onDisconnected(data: { code: number; reason: string }) {
        this.statusText.setText(`Disconnected: ${data.reason || 'Connection lost'}`);
        this.joinButton.setVisible(false);
         // Potentially try to reconnect or offer a reconnect button
    }

    private handleJoinGameClick() {
        if (this.networkSystem.isConnected()) {
            // For now, using a static player name. This could come from a UI input.
            this.networkSystem.sendMessage('join', { playerName: `Player${Math.floor(Math.random() * 1000)}` });
            this.statusText.setText('Waiting for server to start game...');
            this.joinButton.disableInteractive().setColor('#aaaaaa'); // Disable button after click
        } else {
            this.statusText.setText('Not connected. Please wait or refresh.');
        }
    }

    private onMessageReceived(message: ServerMessage) {
        // Assuming the server sends a specific message type to signal game start
        // and provides initial data. This needs to match the server's implementation.
        // Example: message type "gameStarting" or "lobbyUpdate" that implies readiness
        if (message.type === 'gameStarting' || (message.type === 'lobbyUpdate' && (message.payload as GameStartingMessagePayload)?.isReadyToStart)) { // Adjust condition based on server logic
            const initialServerData = message.payload as GameStartingMessagePayload;
            
            // Clean up listeners for this scene before starting the next
            this.networkSystem.off('connected', this.onConnected, this);
            this.networkSystem.off('messageReceived', this.onMessageReceived, this);
            this.networkSystem.off('disconnected', this.onDisconnected, this);
            this.networkSystem.off('error', this.onConnectionError, this);
            // Note: NetworkSystem instance itself is in registry and might still be used by GameScene

            this.scene.start('GameScene', initialServerData);
        } else if (message.type === 'joinError') {
            const reason = (message.payload as GameStartingMessagePayload)?.reason || 'Unknown error';
            this.statusText.setText(`Failed to join: ${reason}`);
            this.joinButton.setInteractive().setColor('#00ff00'); // Re-enable button
        }
        // Handle other lobby-specific messages if any
    }

    shutdown() {
        // Clean up when the scene is shut down (e.g., when transitioning to another scene)
        // This is good practice, though for 'start' it might not be strictly necessary
        // if the next scene also registers listeners.
        // However, explicitly removing them is safer.
        if (this.networkSystem) {
            this.networkSystem.off('connected', this.onConnected, this);
            this.networkSystem.off('messageReceived', this.onMessageReceived, this);
            this.networkSystem.off('disconnected', this.onDisconnected, this);
            this.networkSystem.off('error', this.onConnectionError, this);
        }
    }
} 