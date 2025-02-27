import { Entity, World } from "koota";
import {
  DestroyedStatus,
  DrawableSquare,
  FollowerOf,
  IsEnemy,
  IsPlayer,
  Position,
  RelativePos,
  ThrustVel,
  TwoWayControl,
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
      fillColor: "green",
      squareSize: 25,
    }),
    IsEnemy,
    FollowerOf(params.followingTarget),
    // A position relative to the swarm
    RelativePos({
      posX: params.relativePosition.x,
      posY: params.relativePosition.y,
    }),
    DestroyedStatus({ isDestroyed: false })
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
    DrawableSquare({ fillColor: "red", squareSize: 50 }),
    TwoWayControl,
    Velocity,
    ThrustVel({ thrustVec: 0 })
  );
}
