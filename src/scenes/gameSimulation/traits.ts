import { relation, trait } from "koota";
import * as THREE from "three";

type Position = { posX: number; posY: number };
type DrawableSquare = { squareSize: number; fillColor: string };
type Velocity = { xVel: number; yVel: number };
type TwoWayControl = { dir: "e" | "w" | "none" };
type ThrustVel = { thrustVec: number };
type DestroyedStatus = { isDestroyed: boolean };
type AABB = { x: number; y: number; width: number; height: number };

export const FollowerOf = relation({
  exclusive: true,
  store: { posX: 0, posY: 0 },
});

export const Position = trait<Position>({ posX: 0, posY: 0 });
export const Velocity = trait<Velocity>({ xVel: 0, yVel: 0 });
export const DrawableSquare = trait<DrawableSquare>({
  fillColor: "#ffffff",
  squareSize: 0,
});
export const Mesh = trait<{ mesh: THREE.Mesh }>({
  mesh: new THREE.Mesh(),
});
export const TwoWayControl = trait<TwoWayControl>({
  dir: "none",
});
export const ThrustVel = trait<ThrustVel>({
  thrustVec: 0,
});
export const DestroyedStatus = trait<DestroyedStatus>({
  isDestroyed: false,
});
export const AABB = trait<AABB>({ x: 0, y: 0, width: 0, height: 0 });

export const IsEnemy = trait();
export const IsPlayer = trait();
export const isProjectile = trait();
