/**
 * Represents a generic state that an entity can be in.
 * @template TEntityType The type of the entity this state belongs to.
 */
export interface IState<TEntityType> {
    /** A unique identifier for this state (can be a string or number). */
    id: string | number;

    /**
     * Called when this state is entered.
     * @param entity The entity entering this state.
     * @param args Optional arguments passed when setting this state.
     */
    enter(entity: TEntityType, ...args: unknown[]): void;

    /**
     * Called every frame while this state is active.
     * @param entity The entity in this state.
     * @param time The current game time.
     * @param delta The delta time since the last frame.
     * @param args Optional arguments that might be needed for updates.
     * @returns The ID of the next state to transition to, or null/undefined to remain in the current state.
     */
    update(entity: TEntityType, time: number, delta: number, ...args: unknown[]): (string | number) | null | undefined;

    /**
     * Called when this state is exited.
     * @param entity The entity exiting this state.
     */
    exit(entity: TEntityType): void;
} 