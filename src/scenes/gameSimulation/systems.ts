import { World } from "koota";
import {
  AABB,
  DestroyedStatus,
  DrawableSquare,
  FollowerOf,
  IsEnemy,
  IsPlayer,
  isProjectile,
  Position,
  RelativePos,
  ThrustVel,
  TwoWayControl,
  Velocity,
} from "./traits";
import p5 from "p5";

export function motionSystem(world: World, deps: { deltaTime: number }): void {
  world.query(Position, Velocity).updateEach(([pos, vel]) => {
    pos.posX += vel.xVel * deps.deltaTime;
    pos.posY += vel.yVel * deps.deltaTime;
  });
}

export function relativePositionFollowersSystem(world: World): void {
  world
    .query(Position, RelativePos, FollowerOf("*"))
    .updateEach(([pos, relativePos], e) => {
      const target = e.targetFor(FollowerOf)!;
      const followedEntityTargetPos = target.get(Position)!;
      pos.posX = followedEntityTargetPos.posX + relativePos.posX;
      pos.posY = followedEntityTargetPos.posY + relativePos.posY;
    });
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

export function drawSquaresSystem(world: World, p: p5) {
  world.query(Position, DrawableSquare).forEach((e) => {
    // If it also has a destroyable trait, check isDestroyed; don't render if destroyed
    const isDestroyed = !!e.get(DestroyedStatus)?.isDestroyed;
    if (isDestroyed) return;

    const positionValues = e.get(Position)!;
    const squareValues = e.get(DrawableSquare)!;
    p.push();
    p.fill(squareValues.fillColor);
    p.square(positionValues.posX, positionValues.posY, squareValues.squareSize);
    p.pop();
  });
}

export function drawABBSystem_debug(world: World, p: p5) {
  world.query(AABB).forEach((e) => {
    const aabbValues = e.get(AABB)!;
    p.push();
    p.stroke("white");
    p.fill(255, 255, 255, 0); // transparent fill
    p.rect(aabbValues.x, aabbValues.y, aabbValues.width, aabbValues.height);
    p.pop();
  });
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

export function outOfBoundsCullingSystem(
  world: World,
  params: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }
): void {
  world.query(Position).forEach((e) => {
    const pos = e.get(Position)!;
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

export function destroyedEntitiesCullingSystem(world: World) {
  world.query(DestroyedStatus).forEach((e) => {
    const { isDestroyed } = e.get(DestroyedStatus)!;
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
      aabb.x = pos.posX;
      aabb.y = pos.posY;
    });
}
