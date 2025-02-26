import type p5 from "p5";
import { TStateTickMachine } from "./types";
import { createWorld, trait, World } from "koota";

type Position = { posX: number; posY: number };
type DrawableSquare = { squareSize: number; fillColor: string };
type Velocity = { xVel: number; yVel: number };
type Follows = {
  target: Position;
  relativePos: { posX: number; posY: number };
};

type GameSimulationState = {
  world: World;
  playerShipPos: Position;
  enemySwarmAnchor: Position & Velocity;
};

const PositionTrait = trait<Position>({ posX: 0, posY: 0 });
const FollowsTrait = trait<Follows>({
  relativePos: { posX: 0, posY: 0 },
  target: { posX: 0, posY: 0 },
});
const DrawableSquareTrait = trait<DrawableSquare>({
  fillColor: "green",
  squareSize: 0,
});
/** Tags an enemy, for collision/game over condition purposes */
const IsEnemy = trait();

function createInitialGameSimulationState(p: p5): GameSimulationState {
  const world = createWorld();

  const SHIP_START_VEL = 0.05;

  const enemySwarmAnchor = {
    posX: p.width / -2 + 100,
    posY: p.height / -2 + 100,
    xVel: SHIP_START_VEL,
    yVel: 0,
  };

  // 5 x 10 grid
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 5; row++) {
      // spawn enemy ships
      world.spawn(
        PositionTrait({
          posX: enemySwarmAnchor.posX + col * 50,
          posY: enemySwarmAnchor.posY + row * 50,
        }),
        FollowsTrait({
          // TODO: uses a target to the raw entity data; can maybe use relations here instead
          target: enemySwarmAnchor,
          relativePos: {
            posX: col * 50,
            posY: row * 50,
          },
        }),
        DrawableSquareTrait({
          fillColor: "green",
          squareSize: 25,
        }),
        IsEnemy
      );
    }
  }

  return {
    world,
    playerShipPos: {
      posX: 0,
      posY: p.height / 2 - 100,
    },
    enemySwarmAnchor: enemySwarmAnchor,
  };
}

export function gameSimulationFactory(
  p: p5,
  // A callback to trigger when simulation is ready to go to the next scene
  next: (state: GameSimulationState) => void
): TStateTickMachine<GameSimulationState> {
  // DEBUG SIDE-EFFECT
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

      this.state.world
        .query(PositionTrait, FollowsTrait)
        .updateEach(([position, follows]) => {
          position.posX = follows.target.posX + follows.relativePos.posX;
          position.posY = follows.target.posY + follows.relativePos.posY;
        });

      // naive, but functional - check end condition -- collision on y-axis with playership
      const worldShips = this.state.world.query(PositionTrait, IsEnemy);
      for (const entity of worldShips) {
        const ship = assertPresent(entity.get(PositionTrait));
        // This is probably generalizable into a trait regarding collisions?
        if (
          ship.posX > this.state.playerShipPos.posX &&
          ship.posY > this.state.playerShipPos.posY
        ) {
          // too far!
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

  drawSquaresByWorldStrategy(p, state.world);
}

function drawSquaresByWorldStrategy(p: p5, world: World) {
  world.query(PositionTrait, DrawableSquareTrait).forEach((e) => {
    const positionValues = assertPresent(e.get(PositionTrait));
    const squareValues = assertPresent(e.get(DrawableSquareTrait));
    p.push();
    p.fill(squareValues.fillColor);
    p.square(positionValues.posX, positionValues.posY, squareValues.squareSize);
    p.pop();
  });
}

function assertPresent<T>(item: T | null | undefined): T {
  if (item == null) {
    throw new Error("Array contains null or undefined values");
  }
  return item;
}
