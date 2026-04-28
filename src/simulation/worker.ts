import { expose } from 'comlink';
import { createInitialState, stepMonth } from './engine';
import type { SimState, SimParams } from './types';
import { DEFAULT_PARAMS } from './types';

let state: SimState = createInitialState(DEFAULT_PARAMS);

const api = {
  init(params: SimParams): SimState {
    state = createInitialState(params);
    return state;
  },

  step(params: SimParams): SimState {
    state = stepMonth(state, params);
    return state;
  },

  stepN(n: number, params: SimParams): SimState {
    for (let i = 0; i < n; i++) {
      state = stepMonth(state, params);
    }
    return state;
  },

  getState(): SimState {
    return state;
  },
};

export type SimWorkerApi = typeof api;

expose(api);
