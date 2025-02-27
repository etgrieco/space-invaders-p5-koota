import { World } from "koota";
import {
  DestroyedStatusTrait,
  DrawableSquareTrait,
  FollowerOfRelation,
  IsEnemy,
  IsPlayer,
  isProjectile,
  PositionTrait,
  RelativePosTrait,
  ThrustVelTrait,
  TwoWayControlTrait,
  VelocityTrait,
} from "./traits";
import p5 from "p5";

export function motionSystem(world: World, deps: { deltaTime: number }): void {
  world.query(PositionTrait, VelocityTrait).updateEach(([pos, vel]) => {
    pos.posX += vel.xVel * deps.deltaTime;
    pos.posY += vel.yVel * deps.deltaTime;
  });
}

export function relativePositionFollowersSystem(world: World): void {
  world
    .query(PositionTrait, RelativePosTrait, FollowerOfRelation("*"))
    .updateEach(([pos, relativePos], e) => {
      const target = e.targetFor(FollowerOfRelation)!;
      const followedEntityTargetPos = target.get(PositionTrait)!;
      pos.posX = followedEntityTargetPos.posX + relativePos.posX;
      pos.posY = followedEntityTargetPos.posY + relativePos.posY;
    });
}

export function playerControlToThrustAndVelocitySystem(world: World): void {
  world
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
}

export function sideEffectOnPlayerLoseConditionSystem(
  world: World,
  deps: { callbackOnLoseCondition: () => void }
): void {
  const worldShips = world.query(PositionTrait, IsEnemy);
  for (const entity of worldShips) {
    const ship = entity.get(PositionTrait)!;
    // This is probably generalizable into a trait regarding collisions?
    let hasCalledNext = false;
    for (const entity of world.query(PositionTrait, IsPlayer)) {
      const playerShip = entity.get(PositionTrait)!;
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
  world.query(PositionTrait, DrawableSquareTrait).forEach((e) => {
    // If it also has a destroyable trait, check isDestroyed; don't render if destroyed
    const isDestroyed = !!e.get(DestroyedStatusTrait)?.isDestroyed;
    if (isDestroyed) return;

    const positionValues = e.get(PositionTrait)!;
    const squareValues = e.get(DrawableSquareTrait)!;
    p.push();
    p.fill(squareValues.fillColor);
    p.square(positionValues.posX, positionValues.posY, squareValues.squareSize);
    p.pop();
  });
}

export function enemyProjectileInteractionSystem(world: World): void {
  const destroyableEnemies = world.query(
    IsEnemy,
    PositionTrait,
    DestroyedStatusTrait
  );

  const projectiles = world.query(
    isProjectile,
    PositionTrait,
    DestroyedStatusTrait
  );

  destroyableEnemies.forEach((enemyEntity) => {
    const enemyPos = enemyEntity.get(PositionTrait)!;
    // scan all projectiles...
    projectiles.forEach((projEntity) => {
      const isProjectileDestroyed =
        !!projEntity.get(DestroyedStatusTrait)?.isDestroyed;

      // NOTE: do we have to check if enemy is destroyed? not right now that there is no way a simultaneous thread can destroy the same enemy, right?
      if (isProjectileDestroyed) return; // no-op if already destroyed

      const projEntityPos = projEntity.get(PositionTrait)!;

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
  world.query(PositionTrait).forEach((e) => {
    const pos = e.get(PositionTrait)!;
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
