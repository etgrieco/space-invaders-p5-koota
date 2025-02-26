import type p5 from "p5";
import { TStateTickMachine } from "./types";
import { createWorld, Entity, relation, trait, World } from "koota";

type Position = { posX: number; posY: number };
type DrawableSquare = { squareSize: number; fillColor: string };
type Velocity = { xVel: number; yVel: number };
type TwoWayControl = { dir: "e" | "w" | "none" };
type ThrustVel = { absThrust: number };
type RelativePos = { posX: number; posY: number };
type DestroyedStatus = { isDestroyed: boolean };

type GameSimulationState = {
  world: World;
  enemySwarmAnchorEntity: Entity;
  playerEntity: Entity;
};

const FollowerOfRelation = relation({
  exclusive: true,
});

const PositionTrait = trait<Position>({ posX: 0, posY: 0 });
const VelocityTrait = trait<Velocity>({ xVel: 0, yVel: 0 });
const DrawableSquareTrait = trait<DrawableSquare>({
  fillColor: "green",
  squareSize: 0,
});
const TwoWayControlTrait = trait<TwoWayControl>({
  dir: "none",
});
const ThrustVelTrait = trait<ThrustVel>({
  absThrust: 0,
});
const RelativePosTrait = trait<RelativePos>({ posX: 0, posY: 0 });
const DestroyedStatusTrait = trait<DestroyedStatus>({
  isDestroyed: false,
});

const IsEnemy = trait();
const IsPlayer = trait();
const isProjectile = trait();

function createInitialGameSimulationState(p: p5): GameSimulationState {
  const world = createWorld();

  const SHIP_START_VEL = 0.01;

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
      world.spawn(
        PositionTrait({
          posX: enemySwarmAnchorPosition.posX + col * 50,
          posY: enemySwarmAnchorPosition.posY + row * 50,
        }),
        DrawableSquareTrait({
          fillColor: "green",
          squareSize: 25,
        }),
        IsEnemy,
        FollowerOfRelation(enemySwarmAnchorEntity),
        // A position relative to the swarm
        RelativePosTrait({
          posX: col * 50,
          posY: row * 50,
        }),
        DestroyedStatusTrait({ isDestroyed: false })
      );
    }
  }

  // spawn player
  const playerEntity = world.spawn(
    PositionTrait({
      posX: 0,
      posY: p.height / 2 - 100,
    }),
    IsPlayer,
    DrawableSquareTrait({ fillColor: "red", squareSize: 50 }),
    TwoWayControlTrait,
    VelocityTrait,
    ThrustVelTrait({ absThrust: 1 })
  );

  return {
    world,
    enemySwarmAnchorEntity,
    playerEntity,
  };
}

export function gameSimulationFactory(
  p: p5,
  // A callback to trigger when simulation is ready to go to the next scene
  next: (state: GameSimulationState) => void
): TStateTickMachine<GameSimulationState> {
  // SETUP: keyboard listener for controls

  const gameSimState = createInitialGameSimulationState(p);

  const unmountSpecialKeyHandlers = new AbortController();
  document.addEventListener(
    "keydown",
    function (e) {
      switch (e.code) {
        case "ArrowLeft":
          gameSimState.playerEntity.set(TwoWayControlTrait, { dir: "w" });
          break;
        case "ArrowRight":
          gameSimState.playerEntity.set(TwoWayControlTrait, { dir: "e" });
          break;
        case "Space":
          {
            const playerPosition = assertPresent(
              gameSimState.playerEntity.get(PositionTrait)
            );
            // projectile definition...
            gameSimState.world.spawn(
              isProjectile,
              VelocityTrait({ yVel: -1 }),
              PositionTrait({
                posX: playerPosition.posX,
                posY: playerPosition.posY,
              }),
              DrawableSquareTrait({ fillColor: "orange", squareSize: 5 }),
              DestroyedStatusTrait({ isDestroyed: false })
            );
          }
          // spawn a projectile at the player
          break;
        default:
          break;
      }
    },
    {
      signal: unmountSpecialKeyHandlers.signal,
    }
  );

  document.addEventListener("keyup", function (e) {
    switch (e.code) {
      case "ArrowLeft":
      case "ArrowRight":
        gameSimState.playerEntity.set(TwoWayControlTrait, { dir: "none" });
        break;
      default:
        break;
    }
  });
  function cleanup() {
    unmountSpecialKeyHandlers.abort();
  }

  const state = {
    state: gameSimState,
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
          pos.posY += vel.yVel * p.deltaTime;
        });

      // Handle following transform behavior
      this.state.world
        .query(PositionTrait, RelativePosTrait, FollowerOfRelation("*"))
        .updateEach(([pos, relativePos], e) => {
          const target = assertPresent(e.targetFor(FollowerOfRelation));
          const followedEntityTargetPos = assertPresent(
            target.get(PositionTrait)
          );
          pos.posX = followedEntityTargetPos.posX + relativePos.posX;
          pos.posY = followedEntityTargetPos.posY + relativePos.posY;
        });

      // Handle TwoWayControl behavior on velocity
      this.state.world
        .query(TwoWayControlTrait, ThrustVelTrait, VelocityTrait, IsPlayer)
        .select(TwoWayControlTrait, ThrustVelTrait, VelocityTrait)
        .updateEach(([con, thrust, vel]) => {
          if (con.dir === "e") {
            vel.xVel = thrust.absThrust;
          } else if (con.dir === "w") {
            vel.xVel = -1 * thrust.absThrust;
          } else if (con.dir === "none") {
            vel.xVel = 0;
          } else {
            throw new Error(`Unhandled controller condition ${con.dir}`);
          }
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
            cleanup();
            next(this.state);
            break;
          }
        }
        if (hasCalledNext) {
          break;
        }
      }

      // handle collisions between projectiles and vulnerable entities...
      this.state.world
        .query(IsEnemy, PositionTrait, DestroyedStatusTrait)
        .forEach((enemyEntity) => {
          const enemyPos = assertPresent(enemyEntity.get(PositionTrait));
          // scan all projectiles...
          this.state.world
            .query(isProjectile, PositionTrait, DestroyedStatusTrait)
            .forEach((projEntity) => {
              const isProjectileDestroyed =
                !!projEntity.get(DestroyedStatusTrait)?.isDestroyed;

              // NOTE: do we have to check if enemy is destroyed? not right now that there is no way a simultaneous thread can destroy the same enemy, right?
              if (isProjectileDestroyed) return; // no-op if already destroyed

              const projEntityPos = assertPresent(
                projEntity.get(PositionTrait)
              );

              // hard-code bounding box for now on all enemies
              const distX = enemyPos.posX - projEntityPos.posX;
              const distY = enemyPos.posY - projEntityPos.posY;

              const isInX = distX <= 10 && distX > 0;
              const isInY = distY >= -10 && distY < 0;

              if (isInX && isInY) {
                // destroy! (enemy + projectile)
                projEntity.set(DestroyedStatusTrait, { isDestroyed: true });
                enemyEntity.set(DestroyedStatusTrait, { isDestroyed: true });
              }
            });
        });

      // cleanup! cull items outside of canvas every 10 frames
      if (p.frameCount % 10 === 0) {
        this.state.world.query(PositionTrait).forEach((e) => {
          const pos = assertPresent(e.get(PositionTrait));
          if (
            pos.posX < p.width / -2 ||
            pos.posX > p.width / 2 ||
            pos.posY < p.height / -2 ||
            pos.posY > p.height / 2
          ) {
            e.destroy();
          }
        });
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
    // If it also has a destroyable trait, check isDestroyed; don't render if destroyed
    const isDestroyed = !!e.get(DestroyedStatusTrait)?.isDestroyed;
    if (isDestroyed) return;

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
