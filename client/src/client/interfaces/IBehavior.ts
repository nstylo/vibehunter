import type { EnemySprite } from '../objects/EnemySprite';
import type { PlayerSprite } from '../objects/PlayerSprite';
import type { IState } from './IState';

export enum BehaviorState {
    IDLE = "IDLE",
    PATROLLING = "PATROLLING",
    CHASING = "CHASING",
    ATTACKING_MELEE = "ATTACKING_MELEE",
    ATTACKING_RANGED = "ATTACKING_RANGED",
    FLEEING = "FLEEING",
    USING_SPECIAL_ABILITY = "USING_SPECIAL_ABILITY",
    // ... other states
}

/**
 * Represents a specific behavior (state) for an EnemySprite.
 * Extends the generic IState interface, specialized for EnemySprite.
 */
export interface IBehavior extends IState<EnemySprite> {
    /** 
     * The unique identifier for this behavior, which must be one of the BehaviorState enum values.
     * This aligns IBehavior's id with IState's id, using the BehaviorState enum for type safety.
     */
    id: BehaviorState;

    // enter, exit methods are inherited from IState<EnemySprite>
    // enter(enemy: EnemySprite, target?: PlayerSprite): void;
    // exit(enemy: EnemySprite): void;

    /**
     * Called every frame by the enemy's update loop when this behavior is active.
     * @param enemy The EnemySprite instance.
     * @param time The current game time.
     * @param delta The time elapsed since the last frame.
     * @param target The current target PlayerSprite, if any.
     * @returns The next BehaviorState to transition to, or null/undefined to remain in the current state.
     */
    update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null | undefined;
} 