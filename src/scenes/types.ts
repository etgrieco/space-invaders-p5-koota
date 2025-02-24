export type TStateTickMachine<TState = unknown> = {
  readonly state: TState;
  tick: () => void;
};
