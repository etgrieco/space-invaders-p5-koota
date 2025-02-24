import p5 from "p5";
import { TStateTickMachine } from "./types";

/** The data model used for the intro animation */
type IntroSimulationState = {
  introTextPos: {
    posX: number;
    posY: number;
  };
};
function introSimulationUpdater(
  p: p5,
  state: IntroSimulationState
): IntroSimulationState {
  const CRAWL_INTRO_SPEED = p.frameRate() * p.deltaTime * 0.001;
  state.introTextPos.posY -= CRAWL_INTRO_SPEED;
  return state;
}
export function introSimulationFactory(
  p: p5,
  initialState: IntroSimulationState
): TStateTickMachine<IntroSimulationState> {
  const stateMachine = {
    state: initialState,
    tick() {
      this.state = introSimulationUpdater(p, this.state);
      return this.state;
    },
  };
  stateMachine.tick = stateMachine.tick.bind(stateMachine);
  // cast to ensure user doesn't update state manually
  return stateMachine;
}
export function drawIntro(p: p5, state: IntroSimulationState) {
  p.push();
  p.fill("green");
  p.text(
    "Welcome to Space Invaders!",
    state.introTextPos.posX,
    state.introTextPos.posY
  );
  p.pop();
}
