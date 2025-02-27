import p5 from "p5";
import { TStateTickMachine } from "./types";
import { createWorld, Entity, World } from "koota";
import {
  DestroyedStatusTrait,
  DrawableSquare,
  Position,
  TwoWayControl,
  Velocity,
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
import { spawnEnemyDrone, spawnPlayer } from "./gameSimulation/entityFactories";
import { enemySwarmMovementPatternSystem } from "./gameSimulation/adhocSystems";

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
    Position({
      posX: p.width / -2 + 100,
      posY: p.height / -2 + 100,
    }),
    Velocity({
      xVel: SHIP_START_VEL,
      yVel: 0,
    })
  );

  const enemySwarmAnchorPosition = enemySwarmAnchorEntity.get(Position)!;
  // 5 x 10 grid of enemy ships
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 5; row++) {
      // spawn enemy ships
      spawnEnemyDrone(world, {
        absolutePosition: {
          x: enemySwarmAnchorPosition.posX + col * 50,
          y: enemySwarmAnchorPosition.posY + row * 50,
        },
        relativePosition: {
          x: col * 50,
          y: row * 50,
        },
        followingTarget: enemySwarmAnchorEntity,
      });
    }
  }

  const playerEntity = spawnPlayer(world, {
    absolutePosition: {
      x: 0,
      y: p.height / 2 - 100,
    },
  });

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
          gameSimState.playerEntity.set(TwoWayControl, { dir: "w" });
          break;
        case "ArrowRight":
          gameSimState.playerEntity.set(TwoWayControl, { dir: "e" });
          break;
        case "Space":
          {
            const playerPosition = gameSimState.playerEntity.get(Position)!;
            // projectile definition...
            gameSimState.world.spawn(
              isProjectile,
              Velocity({ yVel: -1 }),
              Position({
                posX: playerPosition.posX,
                posY: playerPosition.posY,
              }),
              DrawableSquare({ fillColor: "orange", squareSize: 5 }),
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
        gameSimState.playerEntity.set(TwoWayControl, { dir: "none" });
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

      /** Adhoc systems */
      enemySwarmMovementPatternSystem(
        gameState.enemySwarmAnchorEntity,
        50 - p.width / 2,
        200 - p.width / 2
      );

      /** Simulation systems */

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

      /** Draw systems */
      drawSquaresSystem(gameState.world, p);
    },
  };
  state.tick = state.tick.bind(state);
  return state;
}
