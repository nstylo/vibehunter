import Phaser from 'phaser';
import type { ServerMessage } from '../types/multiplayer';

export default class NetworkSystem extends Phaser.Events.EventEmitter {
    private socket: WebSocket | null = null;
    private connectionUrl: string | null = null;

    public connect(url: string): void {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            console.warn('NetworkSystem: Already connected or connecting.');
            return;
        }

        this.connectionUrl = url;
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.emit('connected');
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data as string) as ServerMessage;
                this.emit('messageReceived', message);
            } catch (error) {
                console.error('NetworkSystem: Error parsing message:', error, event.data);
            }
        };

        this.socket.onerror = (error) => {
            console.error('NetworkSystem: WebSocket error:', error);
            this.emit('error', error);
        };

        this.socket.onclose = (event) => {
            this.socket = null;
            this.emit('disconnected', { code: event.code, reason: event.reason });
        };
    }

    public sendMessage(message: object): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.error('NetworkSystem: Cannot send message, WebSocket is not open.');
            return;
        }
        try {
            const messageString = JSON.stringify(message);
            this.socket.send(messageString);
        } catch (error) {
            console.error('NetworkSystem: Error sending message:', error);
        }
    }

    public sendConnectMessage(playerName: string): void {
        this.sendMessage({ type: "Connect", player_name: playerName });
    }

    public sendPositionUpdate(x: number, y: number): void {
        this.sendMessage({ type: "SendPosition", x, y });
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.close();
        }
    }

    public isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
    }
}

// Export a singleton instance or manage instantiation within Phaser's registry/scenes
// For simplicity in this phase, scenes can create their own instance or a global one can be used.
// Let's plan for scenes to get it, possibly via Phaser's registry. 