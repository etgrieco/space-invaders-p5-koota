import { ConfigurableTrait, Entity, World } from "koota";
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
  AABBDebugBox,
} from "./traits";
import { GLTF } from "three/examples/jsm/Addons.js";

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
  },
  threeResources?: {
    model: THREE.Object3D;
  }
): Entity {
  const threeTraits: ConfigurableTrait[] = [];
  const fallbackTraits: ConfigurableTrait[] = [];

  if (threeResources) {
    // compute AABB from underlying mesh
    const box = new THREE.Box3().setFromObject(threeResources.model);
    const _boxHelper = new THREE.Box3Helper(box, 0xff0000);
    threeTraits.push(
      Mesh({
        mesh: threeResources.model,
      })
    );

    threeTraits.push(
      AABBDebugBox({
        object: threeResources.model,
        box: box,
        boxHelper: _boxHelper,
      })
    );

    const centerVec = new THREE.Vector3();
    box.getCenter(centerVec);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);

    threeTraits.push(
      AABB({
        x: centerVec.x - (sizeVec.x / 2) * 100,
        y: centerVec.y + (sizeVec.y / 2) * 100,
        height: sizeVec.y * 100,
        width: sizeVec.x * 100,
      })
    );
  } else {
    fallbackTraits.push(
      AABB({
        x: params.absolutePosition.x,
        y: params.absolutePosition.y,
        height: 25,
        width: 25,
      })
    );
  }

  return world.spawn(
    Position({
      posX: params.absolutePosition.x,
      posY: params.absolutePosition.y,
    }),
    DrawableSquare({
      fillColor: "#00ff1a",
      squareSize: 25,
    }),
    IsEnemy,
    FollowerOf(params.followingTarget)({
      posX: params.relativePosition.x,
      posY: params.relativePosition.y,
    }),
    // A position relative to the swarm
    DestroyedStatus({ isDestroyed: false }),
    ...threeTraits
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
        new THREE.MeshBasicMaterial({ color: 0xff9900 })
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
