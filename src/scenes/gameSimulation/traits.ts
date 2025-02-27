import { relation, trait } from "koota";

type Position = { posX: number; posY: number };
type DrawableSquare = { squareSize: number; fillColor: string };
type Velocity = { xVel: number; yVel: number };
type TwoWayControl = { dir: "e" | "w" | "none" };
type ThrustVel = { absThrust: number };
type RelativePos = { posX: number; posY: number };
type DestroyedStatus = { isDestroyed: boolean };

export const FollowerOfRelation = relation({
  exclusive: true,
});

export const PositionTrait = trait<Position>({ posX: 0, posY: 0 });
export const VelocityTrait = trait<Velocity>({ xVel: 0, yVel: 0 });
export const DrawableSquareTrait = trait<DrawableSquare>({
  fillColor: "green",
  squareSize: 0,
});
export const TwoWayControlTrait = trait<TwoWayControl>({
  dir: "none",
});
export const ThrustVelTrait = trait<ThrustVel>({
  absThrust: 0,
});
export const RelativePosTrait = trait<RelativePos>({ posX: 0, posY: 0 });
export const DestroyedStatusTrait = trait<DestroyedStatus>({
  isDestroyed: false,
});

export const IsEnemy = trait();
export const IsPlayer = trait();
export const isProjectile = trait();
