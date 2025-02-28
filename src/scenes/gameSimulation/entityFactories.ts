import { Entity, World } from "koota";
import * as THREE from "three";
import {
  AABB,
  DestroyedStatus,
  DrawableSquare,
  FollowerOf,
  IsEnemy,
  IsPlayer,
  isProjectile,
  Position,
  ThrustVel,
  TwoWayControl,
  Mesh,
  Velocity,
} from "./traits";

export function spawnEnemySwarmAnchor(
  world: World,
  params: { absolutePosition: { x: number; y: number } }
) {
  const SWARM_VEL = 0.01;
  return world.spawn(
    Position({
      posX: params.absolutePosition.x,
      posY: params.absolutePosition.y,
    }),
    Velocity({
      xVel: SWARM_VEL,
      yVel: 0,
    })
  );
}

export function spawnEnemyDrone(
  world: World,
  params: {
    absolutePosition: { x: number; y: number };
    relativePosition: { x: number; y: number };
    followingTarget: Entity;
  }
): Entity {
  return world.spawn(
    Position({
      posX: params.absolutePosition.x,
      posY: params.absolutePosition.y,
    }),
    DrawableSquare({
      fillColor: "#00ff1a",
      squareSize: 25,
    }),
    Mesh({
      mesh: new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.25, 0.25),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      ),
    }),
    IsEnemy,
    FollowerOf(params.followingTarget)({
      posX: params.relativePosition.x,
      posY: params.relativePosition.y,
    }),
    // A position relative to the swarm
    DestroyedStatus({ isDestroyed: false }),
    AABB({
      x: params.absolutePosition.x,
      y: params.absolutePosition.y,
      height: 25,
      width: 25,
    })
  );
}

export function spawnPlayer(
  world: World,
  params: {
    absolutePosition: {
      x: number;
      y: number;
    };
  }
) {
  return world.spawn(
    Position({
      posX: params.absolutePosition.x,
      posY: params.absolutePosition.y,
    }),
    IsPlayer,
    DrawableSquare({ fillColor: "#fc0303", squareSize: 50 }),
    Mesh({
      mesh: new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xee4b2b })
      ),
    }),
    TwoWayControl,
    Velocity,
    ThrustVel({ thrustVec: 0 })
  );
}

export function spawnProjectile(
  world: World,
  params: { absolutePosition: { x: number; y: number } }
) {
  return world.spawn(
    isProjectile,
    Velocity({ yVel: -1 }),
    Position({
      posX: params.absolutePosition.x,
      posY: params.absolutePosition.y,
    }),
    DrawableSquare({ fillColor: "#ff9900", squareSize: 5 }),
    Mesh({
      mesh: new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      ),
    }),
    DestroyedStatus({ isDestroyed: false }),
    AABB({
      x: params.absolutePosition.x,
      y: params.absolutePosition.y,
      height: 5,
      width: 5,
    })
  );
}
