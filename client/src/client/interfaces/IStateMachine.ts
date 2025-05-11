import type { IState } from './IState';

/**
 * Represents a generic state machine.
 * @template TEntityType The type of the entity this state machine belongs to.
 * @template TStateType The base type of the states this machine will manage, extending IState<TEntityType>.
 */
export interface IStateMachine<TEntityType, TStateType extends IState<TEntityType>> {
    /** The currently active state, or null if no state is active. */
    currentState: TStateType | null;

    /**
     * Adds a state to the machine's registry.
     * @param stateId The unique identifier for the state.
     * @param state The state object itself.
     */
    addState(stateId: string | number, state: TStateType): void;

    /**
     * Transitions the machine to a new state.
     * If a current state exists, its exit() method will be called.
     * The new state's enter() method will then be called.
     * @param stateId The unique identifier of the state to transition to.
     * @param enterArgs Optional arguments to pass to the new state's enter() method.
     */
    setState(stateId: string | number, ...enterArgs: unknown[]): void;

    /**
     * Updates the current state.
     * If a current state is active, its update() method is called.
     * If the update() method returns a new stateId, the machine will transition to that state.
     * @param time The current game time.
     * @param delta The delta time since the last frame.
     * @param updateArgs Optional arguments to pass to the current state's update() method.
     */
    update(time: number, delta: number, ...updateArgs: unknown[]): void;

    /**
     * Retrieves a state from the machine's registry.
     * @param stateId The unique identifier of the state to retrieve.
     * @returns The state object, or undefined if not found.
     */
    getState(stateId: string | number): TStateType | undefined;
} 