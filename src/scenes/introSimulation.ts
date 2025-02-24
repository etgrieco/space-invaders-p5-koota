import type p5 from "p5";
import { TStateTickMachine } from "./types";

/** The data model used for the intro animation */
type IntroSimulationState = {
  introTextBoundary: {
    readonly posY: number;
  };
  introTextPos: {
    posX: number;
    posY: number;
  };
  pressToStartPos: {
    posX: number;
    posY: number;
  };
  pressToStartFill: {
    /** Stored as value from 1 (visible) to 0 (invisible) */
    alpha: number;
    deltaVec: -1 | 1;
  };
};

function createInitialIntroSimulationState(p: p5): IntroSimulationState {
  return {
    introTextBoundary: {
      posY: p.textSize(),
    },
    introTextPos: {
      posX: 0,
      posY: p.height / 2,
    },
    pressToStartFill: {
      alpha: 0,
      deltaVec: 1,
    },
    pressToStartPos: {
      posX: 0,
      posY: p.height / 2 + p.textSize(),
    },
  };
}

function introSimulationUpdater(
  p: p5,
  state: IntroSimulationState
): IntroSimulationState {
  const CRAWL_INTRO_SPEED = p.frameRate() * p.deltaTime * 0.001;

  const isHittingCeiling =
    state.introTextPos.posY <= state.introTextBoundary.posY;

  // TODO: Refactor into a generic collision system
  if (!isHittingCeiling) {
    // TODO: Refactor into a generic position/velocity system
    state.introTextPos.posY -= CRAWL_INTRO_SPEED;
    state.pressToStartPos.posY -= CRAWL_INTRO_SPEED;
  } else {
    // create a fun stuttery glow
    if (p.frameCount % 5 === 0) {
      if (state.pressToStartFill.alpha <= 0.5) {
        state.pressToStartFill.deltaVec = 1;
      } else if (state.pressToStartFill.alpha >= 1) {
        state.pressToStartFill.deltaVec = -1;
      }
      state.pressToStartFill.alpha += state.pressToStartFill.deltaVec * 0.1;
    }
  }

  return state;
}

export function introSimulationFactory(
  p: p5,
  // A callback to trigger when simulation is ready to go to the next scene
  next: (state: IntroSimulationState) => void
): TStateTickMachine<IntroSimulationState> {
  const stateMachine = {
    state: createInitialIntroSimulationState(p),
    tick() {
      this.state = introSimulationUpdater(p, this.state);
      return this.state;
    },
  };

  // do some JS this-binding
  stateMachine.tick = stateMachine.tick.bind(stateMachine);

  const unmountSpecialKeyHandlers = new AbortController();
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.code === "KeyS") {
        cleanup();
        next(stateMachine.state);
      }
    },
    {
      signal: unmountSpecialKeyHandlers.signal,
    }
  );

  function cleanup() {
    unmountSpecialKeyHandlers.abort();
  }

  return stateMachine;
}
export function drawIntro(p: p5, state: IntroSimulationState) {
  // DRAW INTRO TEXT
  p.push();
  p.textAlign("center", "bottom");
  p.fill([178, 222, 39, 255]);
  p.text(
    "Welcome to Space Invaders!",
    state.introTextPos.posX,
    state.introTextPos.posY
  );
  p.pop();

  // DRAW PRESS TO START
  p.push();
  p.textAlign("center", "bottom");
  p.fill([178, 222, 39, state.pressToStartFill.alpha * 255]);
  p.text(
    "(press S to start)",
    state.pressToStartPos.posX,
    state.pressToStartPos.posY
  );
  p.pop();
}
