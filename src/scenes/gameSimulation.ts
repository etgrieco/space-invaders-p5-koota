import type p5 from "p5";
import { TStateTickMachine } from "./types";
import { createWorld, Entity, relation, trait, World } from "koota";

type Position = { posX: number; posY: number };
type DrawableSquare = { squareSize: number; fillColor: string };
type Velocity = { xVel: number; yVel: number };

type GameSimulationState = {
  world: World;
  enemySwarmAnchorEntity: Entity;
};

type FollowerOfRelativePosStore = {
  relativePos: { posX: number; posY: number };
};

const FollowerOfRelation = relation<FollowerOfRelativePosStore>({
  exclusive: true,
  store: { relativePos: { posX: 0, posY: 0 } },
});

const PositionTrait = trait<Position>({ posX: 0, posY: 0 });
const VelocityTrait = trait<Velocity>({ xVel: 0, yVel: 0 });
const DrawableSquareTrait = trait<DrawableSquare>({
  fillColor: "green",
  squareSize: 0,
});

const IsEnemy = trait();
const IsPlayer = trait();

function createInitialGameSimulationState(p: p5): GameSimulationState {
  const world = createWorld();

  const SHIP_START_VEL = 0.05;

  // create enemy "anchor", which the other ships all follow
  const enemySwarmAnchorEntity = world.spawn(
    PositionTrait({
      posX: p.width / -2 + 100,
      posY: p.height / -2 + 100,
    }),
    VelocityTrait({
      xVel: SHIP_START_VEL,
      yVel: 0,
    })
  );

  const enemySwarmAnchorPosition = assertPresent(
    enemySwarmAnchorEntity.get(PositionTrait)
  );

  // 5 x 10 grid
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 5; row++) {
      // spawn enemy ships
      const enemyShipEntity = world.spawn(
        PositionTrait({
          posX: enemySwarmAnchorPosition.posX + col * 50,
          posY: enemySwarmAnchorPosition.posY + row * 50,
        }),
        DrawableSquareTrait({
          fillColor: "green",
          squareSize: 25,
        }),
        IsEnemy,
        FollowerOfRelation(enemySwarmAnchorEntity)
      );
      // Assign to the swarm, and set relative position metadata on the relationship
      enemyShipEntity.set(FollowerOfRelation(enemySwarmAnchorEntity), {
        relativePos: {
          posX: col * 50,
          posY: row * 50,
        },
      } satisfies FollowerOfRelativePosStore);
    }
  }

  world.spawn(
    PositionTrait({
      posX: 0,
      posY: p.height / 2 - 100,
    }),
    IsPlayer,
    DrawableSquareTrait({ fillColor: "red", squareSize: 50 })
  );

  return {
    world,
    enemySwarmAnchorEntity,
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
      const enemySwarmAnchorPos = assertPresent(
        this.state.enemySwarmAnchorEntity.get(PositionTrait)
      );
      const enemySwarmAnchorVel = assertPresent(
        this.state.enemySwarmAnchorEntity.get(VelocityTrait)
      );

      // This is a very adhoc control of the enemy swarm
      if (enemySwarmAnchorPos.posX > 200 - p.width / 2) {
        this.state.enemySwarmAnchorEntity.set(VelocityTrait, {
          xVel: enemySwarmAnchorVel.xVel * -1,
        });
        this.state.enemySwarmAnchorEntity.set(PositionTrait, {
          posY: enemySwarmAnchorPos.posY + 50,
          // set to boundary again, so that next tick is always away
          posX: 200 - p.width / 2,
        });
      } else if (enemySwarmAnchorPos.posX < 50 - p.width / 2) {
        this.state.enemySwarmAnchorEntity.set(VelocityTrait, {
          xVel: enemySwarmAnchorVel.xVel * -1,
        });
        this.state.enemySwarmAnchorEntity.set(PositionTrait, {
          posY: enemySwarmAnchorPos.posY + 50,
          // set to boundary again, so that next tick is always away
          posX: 50 - p.width / 2,
        });
      }

      // Handle movable entities
      this.state.world
        .query(PositionTrait, VelocityTrait)
        .updateEach(([pos, vel]) => {
          pos.posX += vel.xVel * p.deltaTime;
        });

      // Handle following transform behavior
      this.state.world
        .query(PositionTrait, FollowerOfRelation("*"))
        .forEach((e) => {
          const entityFollowingTarget = assertPresent(
            e.targetFor(FollowerOfRelation)
          );

          entityFollowingTarget.get(FollowerOfRelation(entityFollowingTarget));

          const entityFollowingTargetPosition = assertPresent(
            entityFollowingTarget.get(PositionTrait)
          );

          const followerOfData = e.get(
            FollowerOfRelation(entityFollowingTarget)
          ) as FollowerOfRelativePosStore;

          e.set(PositionTrait, {
            posX:
              entityFollowingTargetPosition.posX +
              followerOfData.relativePos.posX,
            posY:
              entityFollowingTargetPosition.posY +
              followerOfData.relativePos.posY,
          });
        });

      // naive, but functional - check end condition -- collision on y-axis with playership
      const worldShips = this.state.world.query(PositionTrait, IsEnemy);
      for (const entity of worldShips) {
        const ship = assertPresent(entity.get(PositionTrait));
        // This is probably generalizable into a trait regarding collisions?
        let hasCalledNext = false;
        for (const entity of this.state.world.query(PositionTrait, IsPlayer)) {
          const playerShip = assertPresent(entity.get(PositionTrait));
          if (ship.posX > playerShip.posX && ship.posY > playerShip.posY) {
            // a player has touched an enemy!
            hasCalledNext = true;
            next(this.state);
            break;
          }
        }
        if (hasCalledNext) {
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

export function drawGameByKootaWorldStrategy(
  p: p5,
  state: GameSimulationState
) {
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
