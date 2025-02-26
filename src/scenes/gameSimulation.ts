import type p5 from "p5";
import { TStateTickMachine } from "./types";
import { createWorld, trait, World } from "koota";

type Position = { posX: number; posY: number };
type Velocity = { xVel: number; yVel: number };
type Follows = {
  target: Position;
  relativePos: { posX: number; posY: number };
};

type GameSimulationState = {
  world: World;
  playerShipPos: Position;
  enemyShips: Array<Position & Follows>;
  enemySwarmAnchor: Position & Velocity;
};

const PositionTrait = trait(() => ({ posX: 0, posY: 0 }));

function createInitialGameSimulationState(p: p5): GameSimulationState {
  const world = createWorld();

  const SHIP_START_VEL = 0.05;

  const enemySwarmAnchor = {
    posX: p.width / -2 + 100,
    posY: p.height / -2 + 100,
    xVel: SHIP_START_VEL,
    yVel: 0,
  };

  let enemyShips: GameSimulationState["enemyShips"] = [];
  // 5 x 10 grid
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 5; row++) {
      const relativePos = {
        posX: col * 50,
        posY: row * 50,
      };

      world.spawn(
        PositionTrait({
          posX: enemySwarmAnchor.posX + col * 50,
          posY: enemySwarmAnchor.posY + row * 50,
        })
      );

      enemyShips.push({
        target: enemySwarmAnchor,
        relativePos: relativePos,
        posX: enemySwarmAnchor.posX + col * 50,
        posY: enemySwarmAnchor.posY + row * 50,
      });
    }
  }

  return {
    world,
    playerShipPos: {
      posX: 0,
      posY: p.height / 2 - 100,
    },
    enemyShips: enemyShips,
    enemySwarmAnchor: enemySwarmAnchor,
  };
}

export function gameSimulationFactory(
  p: p5,
  // A callback to trigger when simulation is ready to go to the next scene
  next: (state: GameSimulationState) => void
): TStateTickMachine<GameSimulationState> {
  const state = {
    state: createInitialGameSimulationState(p),
    tick() {
      // MOVE at boundary
      if (this.state.enemySwarmAnchor.posX > 200 - p.width / 2) {
        this.state.enemySwarmAnchor.xVel *= -1;
        this.state.enemySwarmAnchor.posY += 50;
        // set to boundary again, so that next tick is always away
        this.state.enemySwarmAnchor.posX = 200 - p.width / 2;
      } else if (this.state.enemySwarmAnchor.posX < 50 - p.width / 2) {
        this.state.enemySwarmAnchor.xVel *= -1;
        this.state.enemySwarmAnchor.posY += 50;
        // set to boundary again, so that next tick is always away
        this.state.enemySwarmAnchor.posX = 50 - p.width / 2;
      }

      // MOVE based on inherent velocity (generalizable)
      this.state.enemySwarmAnchor.posX +=
        this.state.enemySwarmAnchor.xVel * p.deltaTime;

      // FOLLOW the anchor
      this.state.enemyShips.forEach((e) => {
        e.posX = e.target.posX + e.relativePos.posX;
        e.posY = e.target.posY + e.relativePos.posY;
      });

      // check end condition -- collision on y-axis with playership
      for (const ship of this.state.enemyShips) {
        // TODO: collision model
        if (
          ship.posX > this.state.playerShipPos.posX &&
          ship.posY > this.state.playerShipPos.posY
        ) {
          // too far!
          console.log("call next");
          next(this.state);
          break;
        }
      }

      // we draw here, so that we have world in scope
      drawGameByKootaWorldStrategy(p, this.state);
    },
  };
  state.tick = state.tick.bind(state);
  return state;
}

export function drawGame(p: p5, state: GameSimulationState) {
  // draw player ship
  p.push();
  p.fill("red");
  p.square(state.playerShipPos.posX, state.playerShipPos.posY, 50);
  p.pop();
  // draw enemies
  state.enemyShips.forEach((e) => {
    p.push();
    p.fill("red");
    p.square(e.posX, e.posY, 25);
    p.pop();
  });
}

export function drawGameByKootaWorldStrategy(
  p: p5,
  state: GameSimulationState
) {
  // draw player ship
  p.push();
  p.fill("red");
  p.square(state.playerShipPos.posX, state.playerShipPos.posY, 50);
  p.pop();
  // draw enemies
  state.world.query(PositionTrait).forEach((e) => {
    const positionValues = assertPresent(e.get(PositionTrait));
    p.push();
    p.fill("green");
    p.square(positionValues.posX, positionValues.posY, 25);
    p.pop();
  });
}

function assertPresent<T>(item: T | null | undefined): T {
  if (item == null) {
    throw new Error("Array contains null or undefined values");
  }
  return item;
}
