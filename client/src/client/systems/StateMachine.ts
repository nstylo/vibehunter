import type { IState } from '../interfaces/IState';
import type { IStateMachine } from '../interfaces/IStateMachine';

/**
 * A generic state machine implementation.
 * @template TEntityType The type of the entity this state machine belongs to.
 * @template TStateType The base type of the states this machine will manage.
 */
export class StateMachine<TEntityType, TStateType extends IState<TEntityType>> 
    implements IStateMachine<TEntityType, TStateType> {
    
    public currentState: TStateType | null = null;
    private states: Map<string | number, TStateType> = new Map();
    private entity: TEntityType;

    constructor(entity: TEntityType) {
        this.entity = entity;
    }

    addState(stateId: string | number, state: TStateType): void {
        this.states.set(stateId, state);
    }

    setState(stateId: string | number, ...enterArgs: unknown[]): void {
        const newState = this.states.get(stateId);
        if (!newState) {
            console.warn(`StateMachine: State with id '${stateId}' not found.`);
            return;
        }

        if (this.currentState === newState) {
            return; // Already in this state
        }

        if (this.currentState?.exit) {
            this.currentState.exit(this.entity);
        }

        this.currentState = newState;

        if (this.currentState.enter) {
            this.currentState.enter(this.entity, ...enterArgs);
        }
    }

    update(time: number, delta: number, ...updateArgs: unknown[]): void {
        if (this.currentState?.update) {
            const nextStateId = this.currentState.update(this.entity, time, delta, ...updateArgs);
            if (nextStateId !== null && nextStateId !== undefined && nextStateId !== this.currentState.id) {
                this.setState(nextStateId); // Pass through updateArgs if needed, or reset
            }
        }
    }

    getState(stateId: string | number): TStateType | undefined {
        return this.states.get(stateId);
    }
} 