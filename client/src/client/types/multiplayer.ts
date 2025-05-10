/**
 * Interfaces for multiplayer functionality
 */

/**
 * Interface for remote player data received from server
 */
export interface RemotePlayerData {
    id: string;
    position: { x: number; y: number };
    // Other properties can be added as needed (health, direction, etc.)
}

/**
 * Interface for server messages
 */
export interface ServerMessage {
    type: string;
    [key: string]: any; // Allow additional properties
}

/**
 * Interface for PlayerPositions message
 */
export interface PlayerPositionsMessage extends ServerMessage {
    type: 'PlayerPositions';
    players: RemotePlayerData[];
}

/**
 * Type guard for PlayerPositions message
 */
export function isPlayerPositionsMessage(message: ServerMessage): message is PlayerPositionsMessage {
    return message.type === 'PlayerPositions' && 
           Array.isArray((message as PlayerPositionsMessage).players);
}

/**
 * Interface for NetworkAware objects that can sync with the network
 */
export interface NetworkAware {
    /**
     * Set the network mode for this entity
     * @param networkSystem The network system to use for multiplayer
     * @param isNetworkControlled Whether this entity is controlled by the network
     */
    setNetworkMode(networkSystem: any, isNetworkControlled: boolean): void;
    
    /**
     * Update this entity from network data
     * @param x X position
     * @param y Y position
     */
    updateFromNetwork(x: number, y: number): void;
} 