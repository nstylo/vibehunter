import type { EnemySprite } from '../objects/EnemySprite';
import type { PlayerSprite } from '../objects/PlayerSprite';
import type { IBehavior, BehaviorState } from '../interfaces/IBehavior';

/**
 * Abstract base class for enemy behaviors.
 * Implements the IBehavior interface, which extends IState<EnemySprite>.
 */
export abstract class BaseBehavior implements IBehavior {
    abstract id: BehaviorState; // Concrete classes must define their specific BehaviorState ID

    // enter, exit, and update methods must be implemented by concrete behavior classes.
    // The IBehavior interface (via IState) already defines their signatures.

    /**
     * Called when this behavior (state) is entered.
     * @param enemy The enemy entering this state.
     * @param target The player target, if relevant for this state.
     */
    abstract enter(enemy: EnemySprite, target?: PlayerSprite): void;

    /**
     * Called every frame by the enemy's state machine while this behavior is active.
     * @param enemy The enemy instance.
     * @param time The current game time.
     * @param delta The time elapsed since the last frame.
     * @param target The current target PlayerSprite, if any.
     * @returns The next BehaviorState to transition to, or null/undefined to remain in the current state.
     */
    abstract update(enemy: EnemySprite, time: number, delta: number, target?: PlayerSprite): BehaviorState | null | undefined;

    /**
     * Called when this behavior (state) is exited.
     * @param enemy The enemy exiting this state.
     */
    abstract exit(enemy: EnemySprite): void;
} 