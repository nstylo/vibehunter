export interface IPlayerCharacterDefinition {
    id: string; // The key from characters.json (e.g., "1", "2")
    name: string;
    alias: string;
    origin: string;
    downfall: string;
    signature: string;
    virtue: string;
    belief_goal: string;
    startingAttacks: string[]; // Array of Attack IDs from attacks.json
    notes?: string;
} 