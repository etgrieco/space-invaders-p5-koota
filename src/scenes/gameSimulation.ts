import * as THREE from "three";
import { createWorld, Entity, World } from "koota";
import {
  IsEnemy,
  Mesh,
  Position,
  TwoWayControl,
} from "./gameSimulation/traits";
import {
  updateMeshPositions_Three,
  enemyProjectileInteractionSystem,
  motionSystem,
  playerControlToThrustAndVelocitySystem,
  relativePositionFollowersSystem,
  sideEffectOnPlayerLoseConditionSystem,
  synchronizePositionAABBSystem,
  destroyedEntitiesCullingSystem_Three,
  outOfBoundsCullingSystem_Three,
  updateMeshDebugAABBPositions_Three,
} from "./gameSimulation/systems";
import {
  spawnEnemyDrone,
  spawnEnemySwarmAnchor,
  spawnPlayer,
  spawnProjectile,
} from "./gameSimulation/entityFactories";
import { enemySwarmMovementPatternSystem } from "./gameSimulation/adhocSystems";
import { debugCollisions } from "./gameSimulation/debugSystems";
import { GLTF } from "three/examples/jsm/Addons.js";

export type ThreeDeps = {
  camera: THREE.Camera;
  scene: THREE.Scene;
  webGlRenderer: THREE.WebGLRenderer;
  getDeltaTime: () => number;
  externalResources: {
    spaceInvadersAlien: GLTF;
  };
};

const DEBUG_MODE = false;

let unpausePrevTick = false;
let isPaused_debug = false;

type GameSimulationState = {
  world: World;
  enemySwarmAnchorEntity: Entity;
  playerEntity: Entity;
};

function createInitialGameSimulationState_Three(
  three: ThreeDeps
): GameSimulationState {
  const world = createWorld();
  const THREE_SIZE = three.webGlRenderer.getSize(new THREE.Vector2());

  // create enemy "anchor", which the other ships all follow
  const enemySwarmAnchorEntity = spawnEnemySwarmAnchor(world, {
    absolutePosition: {
      x: THREE_SIZE.width / -2 + 100,
      y: THREE_SIZE.height / -2 + 100,
    },
  });

  const enemySwarmAnchorPosition = enemySwarmAnchorEntity.get(Position)!;
  // 5 x 10 grid of enemy ships
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 5; row++) {
      // perform a sanitizing scale on the model...
      const droneObj =
        three.externalResources.spaceInvadersAlien.scene.clone(true);
      droneObj.scale.multiplyScalar(1 / 50);

      // spawn enemy ships
      spawnEnemyDrone(
        world,
        {
          absolutePosition: {
            x: enemySwarmAnchorPosition.posX + col * 50,
            y: enemySwarmAnchorPosition.posY + row * 50,
          },
          relativePosition: {
            x: col * 50,
            y: row * 50,
          },
          followingTarget: enemySwarmAnchorEntity,
        },
        {
          model: droneObj,
        }
      );
    }
  }

  const playerEntity = spawnPlayer(world, {
    absolutePosition: {
      x: 0,
      y: THREE_SIZE.height / 2 - 100,
    },
  });

  return {
    world,
    enemySwarmAnchorEntity,
    playerEntity,
  };
}

function drawRoutine_Three(world: World, three: ThreeDeps) {
  updateMeshPositions_Three(world, three);
  updateMeshDebugAABBPositions_Three(world, three);
  // rotate some enemies...
  world.query(IsEnemy, Mesh).forEach((e) => {
    const { mesh } = e.get(Mesh)!;
    mesh.rotation.y += 0.01;
  });
}

export function gameSimulationFactory_Three(
  three: ThreeDeps,
  // A callback to trigger when simulation is ready to go to the next scene
  next: (state: GameSimulationState) => void
) {
  // SETUP: keyboard listener for controls
  const gameSimState = createInitialGameSimulationState_Three(three);
  const unmountSpecialKeyHandlers = new AbortController();

  // Debug while paused keys
  document.addEventListener("keydown", function (e) {
    if (!isPaused_debug) return;
    switch (e.code) {
      case "Backslash":
        isPaused_debug = false;
        unpausePrevTick = true;
        break;
    }
  });

  document.addEventListener(
    "keydown",
    function (e) {
      if (isPaused_debug) return;
      switch (e.code) {
        case "ArrowLeft":
          gameSimState.playerEntity.set(TwoWayControl, { dir: "w" });
          break;
        case "ArrowRight":
          gameSimState.playerEntity.set(TwoWayControl, { dir: "e" });
          break;
        case "KeyV":
          {
            const playerPosition = gameSimState.playerEntity.get(Position)!;
            // projectile definition...
            spawnProjectile(gameSimState.world, {
              absolutePosition: {
                x: playerPosition.posX,
                y: playerPosition.posY,
              },
            });
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
    if (isPaused_debug) return;
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
      const RENDERER_SIZE = three.webGlRenderer.getSize(new THREE.Vector2());
      const FRAME_DELTA_TIME = three.getDeltaTime();
      const gameState = this.state;

      if (DEBUG_MODE) {
        // pause on collision
        debugCollisions(gameState.world, () => {
          isPaused_debug = true;
        });

        if (isPaused_debug && !unpausePrevTick) {
          // draw stuff
          drawRoutine_Three(gameState.world, three);
          return;
        }
        // set unpause prev tick back to false
        unpausePrevTick = false;
      }

      /** Adhoc systems */
      enemySwarmMovementPatternSystem(
        gameState.enemySwarmAnchorEntity,
        50 - RENDERER_SIZE.width / 2,
        200 - RENDERER_SIZE.width / 2
      );

      /** Simulation systems */

      // Important! First check for collision/damage conditions before processing moving entities
      // naive, but functional - check end condition -- collision on y-axis with playership
      sideEffectOnPlayerLoseConditionSystem(gameState.world, {
        callbackOnLoseCondition() {
          cleanup();
          next(gameState);
        },
      });
      // handle collisions between projectiles and vulnerable entities...
      enemyProjectileInteractionSystem(gameState.world);

      // Handle movable entities
      motionSystem(gameState.world, { deltaTime: FRAME_DELTA_TIME });
      // Handle following transform behavior
      relativePositionFollowersSystem(gameState.world);
      // Handle TwoWayControl behavior on velocity
      playerControlToThrustAndVelocitySystem(gameState.world);

      /** Cleanup! */
      // cull items outside of canvas every 10 frames
      outOfBoundsCullingSystem_Three(
        gameState.world,
        {
          minX: RENDERER_SIZE.width / -2,
          maxX: RENDERER_SIZE.width / 2,
          minY: RENDERER_SIZE.height / -2,
          maxY: RENDERER_SIZE.height / 2,
        },
        three
      );
      // cull destroyed entities
      destroyedEntitiesCullingSystem_Three(gameState.world, three);

      // After all transformations, re-synchronize our bounding-boxes and positions
      synchronizePositionAABBSystem(gameState.world);

      /** Draw systems */
      drawRoutine_Three(gameState.world, three);
    },
  };
  state.tick = state.tick.bind(state);
  return state;
}
