import type p5 from "p5";
import { TStateTickMachine } from "./types";

type GameSimulationState = {
  playerShipPos: {
    posX: number;
    posY: number;
  };
};

function createInitialGameSimulationState(p: p5): GameSimulationState {
  return {
    playerShipPos: {
      posX: 0,
      posY: p.height / 2 + 100,
    },
  };
}

export function gameSimulationFactory(
  p: p5,
  // A callback to trigger when simulation is ready to go to the next scene
  next: (state: GameSimulationState) => void
): TStateTickMachine<GameSimulationState> {
  let tickCount = 0;

  return {
    state: createInitialGameSimulationState(p),
    tick() {
      tickCount++;
      console.log("tick");
      if (tickCount > 120) {
        next(this.state);
      }
    },
  };
}
