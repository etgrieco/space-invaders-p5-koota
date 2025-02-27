import p5 from "p5";
import { TStateTickMachine } from "./types";
import { createWorld, Entity, World } from "koota";
import {
  DestroyedStatusTrait,
  DrawableSquareTrait,
  FollowerOfRelation,
  IsEnemy,
  IsPlayer,
  PositionTrait,
  RelativePosTrait,
  ThrustVelTrait,
  TwoWayControlTrait,
  VelocityTrait,
  isProjectile,
} from "./gameSimulation/traits";
import {
  destroyedEntitiesCullingSystem,
  drawSquaresSystem,
  enemyProjectileInteractionSystem,
  motionSystem,
  outOfBoundsCullingSystem,
  playerControlToThrustAndVelocitySystem,
  relativePositionFollowersSystem,
  sideEffectOnPlayerLoseConditionSystem,
} from "./gameSimulation/systems";

type GameSimulationState = {
  world: World;
  enemySwarmAnchorEntity: Entity;
  playerEntity: Entity;
};

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

  const enemySwarmAnchorPosition = enemySwarmAnchorEntity.get(PositionTrait)!;

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
            const playerPosition =
              gameSimState.playerEntity.get(PositionTrait)!;
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
      const gameState = this.state;

      const enemySwarmAnchorPos =
        gameState.enemySwarmAnchorEntity.get(PositionTrait)!;
      const enemySwarmAnchorVel =
        gameState.enemySwarmAnchorEntity.get(VelocityTrait)!;

      // This is a very adhoc control of the enemy swarm
      if (enemySwarmAnchorPos.posX > 200 - p.width / 2) {
        gameState.enemySwarmAnchorEntity.set(VelocityTrait, {
          xVel: enemySwarmAnchorVel.xVel * -1,
        });
        gameState.enemySwarmAnchorEntity.set(PositionTrait, {
          posY: enemySwarmAnchorPos.posY + 50,
          // set to boundary again, so that next tick is always away
          posX: 200 - p.width / 2,
        });
      } else if (enemySwarmAnchorPos.posX < 50 - p.width / 2) {
        gameState.enemySwarmAnchorEntity.set(VelocityTrait, {
          xVel: enemySwarmAnchorVel.xVel * -1,
        });
        gameState.enemySwarmAnchorEntity.set(PositionTrait, {
          posY: enemySwarmAnchorPos.posY + 50,
          // set to boundary again, so that next tick is always away
          posX: 50 - p.width / 2,
        });
      }

      // Handle movable entities
      motionSystem(gameState.world, { deltaTime: p.deltaTime });

      // Handle following transform behavior
      relativePositionFollowersSystem(gameState.world);
      // Handle TwoWayControl behavior on velocity
      playerControlToThrustAndVelocitySystem(gameState.world);
      // naive, but functional - check end condition -- collision on y-axis with playership
      sideEffectOnPlayerLoseConditionSystem(gameState.world, {
        callbackOnLoseCondition() {
          cleanup();
          next(gameState);
        },
      });
      // handle collisions between projectiles and vulnerable entities...
      enemyProjectileInteractionSystem(gameState.world);
      // cleanup!
      if (p.frameCount % 10 === 0) {
        // cull items outside of canvas every 10 frames
        outOfBoundsCullingSystem(gameState.world, {
          minX: p.width / -2,
          maxX: p.width / 2,
          minY: p.height / -2,
          maxY: p.height / 2,
        });
        destroyedEntitiesCullingSystem(gameState.world);
      }
      // Draw operations
      drawSquaresSystem(gameState.world, p);
    },
  };
  state.tick = state.tick.bind(state);
  return state;
}
