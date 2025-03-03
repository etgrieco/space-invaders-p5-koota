import { World } from "koota";
import {
  AABB,
  DestroyedStatus,
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
import { ThreeDeps } from "../gameSimulation";

export function motionSystem(world: World, deps: { deltaTime: number }): void {
  world.query(Position, Velocity).updateEach(([pos, vel]) => {
    pos.posX += vel.xVel * deps.deltaTime;
    pos.posY += vel.yVel * deps.deltaTime;
  });
}

export function relativePositionFollowersSystem(world: World): void {
  world.query(Position, FollowerOf("*")).updateEach(
    (
      [
        pos,
        // https://github.com/pmndrs/koota/issues/57
        _incorrectFollowerRelPos,
      ],
      e
    ) => {
      const target = e.targetFor(FollowerOf)!;
      const targetPos = target.get(Position)!;

      const followerRelativePos = e.get(FollowerOf(target))!;

      pos.posX = followerRelativePos.posX + targetPos.posX;
      pos.posY = followerRelativePos.posY + targetPos.posY;
    }
  );
}

export function playerControlToThrustAndVelocitySystem(world: World): void {
  const thrustablePlayers = world.query(
    TwoWayControl,
    ThrustVel,
    Velocity,
    IsPlayer
  );

  // first, sync controls with thrust
  thrustablePlayers
    .select(TwoWayControl, ThrustVel)
    .updateEach(([con, thrust]) => {
      switch (con.dir) {
        case "e":
          thrust.thrustVec = 1;
          break;
        case "w":
          thrust.thrustVec = -1;
          break;
        case "none":
          thrust.thrustVec = 0;
          break;
        default:
          break;
      }
    });

  // then, update velocity accordingly
  const PLAYER_SHIP_VELOCITY = 1;
  thrustablePlayers
    .select(ThrustVel, Velocity)
    .updateEach(([thrustVel, vel]) => {
      vel.xVel = thrustVel.thrustVec * PLAYER_SHIP_VELOCITY;
    });
}

export function sideEffectOnPlayerLoseConditionSystem(
  world: World,
  deps: { callbackOnLoseCondition: () => void }
): void {
  const worldShips = world.query(Position, IsEnemy);
  for (const entity of worldShips) {
    const ship = entity.get(Position)!;
    // This is probably generalizable into a trait regarding collisions?
    let hasCalledNext = false;
    for (const entity of world.query(Position, IsPlayer)) {
      const playerShip = entity.get(Position)!;
      if (ship.posX > playerShip.posX && ship.posY > playerShip.posY) {
        // a player has touched an enemy!
        hasCalledNext = true;
        deps.callbackOnLoseCondition();
        break;
      }
    }
    if (hasCalledNext) {
      break;
    }
  }
}

export function updateMeshPositions_Three(world: World, three: ThreeDeps) {
  const POSITION_SCALAR = 0.01;

  const meshes = world.query(Position, Mesh).flatMap((e) => {
    // If it also has a destroyable trait, check isDestroyed; don't render if destroyed
    const isDestroyed = !!e.get(DestroyedStatus)?.isDestroyed;
    if (isDestroyed) {
      return [];
    }

    const { mesh } = e.get(Mesh)!;

    const positionValues = e.get(Position)!;

    mesh.position.x = positionValues.posX * POSITION_SCALAR;
    mesh.position.y = positionValues.posY * POSITION_SCALAR;
    return [mesh];
  });

  if (meshes.length) {
    three.scene.add(...meshes);
  }
}
export function updateMeshDebugAABBPositions_Three(
  world: World,
  three: ThreeDeps
) {
  // const POSITION_SCALAR = 0.01;

  const aabbObjs = world.query(AABBDebugBox).flatMap((e) => {
    // If it also has a destroyable trait, check isDestroyed; don't render if destroyed
    const isDestroyed = !!e.get(DestroyedStatus)?.isDestroyed;
    if (isDestroyed) {
      return [];
    }

    const { box, object, boxHelper } = e.get(AABBDebugBox)!;

    // const positionValues = e.get(Position)!;

    // TODO: Why is this box not moving??
    // re-set the box position
    box.setFromObject(object);
    // (obj as Box3Helper).box.position.x = positionValues.posX * POSITION_SCALAR;
    // (obj as Box3Helper).box.position.y = positionValues.posY * POSITION_SCALAR;

    // (obj as Box3Helper).box.rotation.y += 0.01;
    return [boxHelper];
  });

  if (aabbObjs.length) {
    three.scene.add(...aabbObjs);
  }
}

export function enemyProjectileInteractionSystem(world: World): void {
  const destroyableEnemies = world.query(
    IsEnemy,
    Position,
    AABB,
    DestroyedStatus
  );
  const projectiles = world.query(
    isProjectile,
    Position,
    AABB,
    DestroyedStatus
  );

  destroyableEnemies.forEach((enemyEntity) => {
    const enemyAABB = enemyEntity.get(AABB)!;
    // scan all projectiles...
    projectiles.forEach((projEntity) => {
      const isProjectileDestroyed =
        !!projEntity.get(DestroyedStatus)?.isDestroyed;

      // NOTE: do we have to check if enemy is destroyed? not right now that there is no way a simultaneous thread can destroy the same enemy, right?
      if (isProjectileDestroyed) return; // no-op if already destroyed

      const projAABB = projEntity.get(AABB)!;

      const isCollided =
        projAABB.x < enemyAABB.x + enemyAABB.width &&
        projAABB.x + projAABB.width > enemyAABB.x &&
        projAABB.y < enemyAABB.y + enemyAABB.height &&
        projAABB.y + projAABB.height > enemyAABB.y;

      if (isCollided) {
        // destroy! (enemy + projectile)
        projEntity.set(DestroyedStatus, { isDestroyed: true });
        enemyEntity.set(DestroyedStatus, { isDestroyed: true });
      }
    });
  });
}

export function outOfBoundsCullingSystem_Three(
  world: World,
  params: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  },
  three: ThreeDeps
): void {
  world.query(Position).forEach((e) => {
    const pos = e.get(Position)!;
    if (e.has(Mesh)) {
      three.scene.remove(e.get(Mesh)!.mesh);
    }
    if (e.has(AABBDebugBox)) {
      three.scene.remove(e.get(AABBDebugBox)!.boxHelper);
    }
    if (
      pos.posX < params.minX ||
      pos.posX > params.maxX ||
      pos.posY < params.minY ||
      pos.posY > params.maxY
    ) {
      e.destroy();
    }
  });
}

export function destroyedEntitiesCullingSystem_Three(
  world: World,
  three: ThreeDeps
) {
  world.query(DestroyedStatus).forEach((e) => {
    const { isDestroyed } = e.get(DestroyedStatus)!;

    if (e.has(Mesh)) {
      three.scene.remove(e.get(Mesh)!.mesh);
    }

    if (isDestroyed) {
      e.destroy();
    }
  });
}

export function synchronizePositionAABBSystem(world: World) {
  world
    .query(Position, AABB)
    .select(Position, AABB)
    .updateEach(([pos, aabb]) => {
      aabb.x = pos.posX - aabb.width / 2;
      aabb.y = pos.posY - aabb.width / 2;
    });
}
