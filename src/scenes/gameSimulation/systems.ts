import { World } from "koota";
import {
  DestroyedStatusTrait,
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
    const isDestroyed = !!e.get(DestroyedStatusTrait)?.isDestroyed;
    if (isDestroyed) return;

    const positionValues = e.get(Position)!;
    const squareValues = e.get(DrawableSquare)!;
    p.push();
    p.fill(squareValues.fillColor);
    p.square(positionValues.posX, positionValues.posY, squareValues.squareSize);
    p.pop();
  });
}

export function enemyProjectileInteractionSystem(world: World): void {
  const destroyableEnemies = world.query(
    IsEnemy,
    Position,
    DestroyedStatusTrait
  );

  const projectiles = world.query(isProjectile, Position, DestroyedStatusTrait);

  destroyableEnemies.forEach((enemyEntity) => {
    const enemyPos = enemyEntity.get(Position)!;
    // scan all projectiles...
    projectiles.forEach((projEntity) => {
      const isProjectileDestroyed =
        !!projEntity.get(DestroyedStatusTrait)?.isDestroyed;

      // NOTE: do we have to check if enemy is destroyed? not right now that there is no way a simultaneous thread can destroy the same enemy, right?
      if (isProjectileDestroyed) return; // no-op if already destroyed

      const projEntityPos = projEntity.get(Position)!;

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
  world.query(DestroyedStatusTrait).forEach((e) => {
    const { isDestroyed } = e.get(DestroyedStatusTrait)!;
    if (isDestroyed) {
      e.destroy();
    }
  });
}
