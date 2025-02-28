import { World } from "koota";
import {
  AABB,
  DestroyedStatus,
  IsEnemy,
  isProjectile,
  Position,
} from "./traits";

export function debugCollisions(world: World, onCollision: () => void) {
  const destroyableEnemies = world.query(IsEnemy, Position, DestroyedStatus);

  const projectiles = world.query(isProjectile, Position, DestroyedStatus);

  destroyableEnemies.forEach((enemyEntity) => {
    const enemyAABB = enemyEntity.get(AABB)!;
    // scan all projectiles...
    projectiles.forEach((projEntity) => {
      const projAABB = projEntity.get(AABB)!;
      const isCollided =
        projAABB.x < enemyAABB.x + enemyAABB.width &&
        projAABB.x + projAABB.width > enemyAABB.x &&
        projAABB.y < enemyAABB.y + enemyAABB.height &&
        projAABB.y + projAABB.height > enemyAABB.y;

      if (isCollided) {
        onCollision();
      }
    });
  });
}
