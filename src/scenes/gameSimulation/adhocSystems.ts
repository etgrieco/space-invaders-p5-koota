/**
 * This file is a container for 'adhoc' systems that we apply to specific Entity instances
 *
 * Consider in the short-term for this file to be a container for ambiguous behaviors that we cannot
 * properly mentally systemetize.
 *
 * While the entirety of this file may be perceived as an anti-pattern, it's actually a safe space for premature system-ization.
 *
 * As system interactions become apparent due to commonalities among these adhoc procedures,
 * then it's time to migrate it to a system and refactor accordingly.
 *
 * */

import { Entity } from "koota";
import { Position, Velocity } from "./traits";

export function enemySwarmMovementPatternSystem(
  /** Expected to have a velocity */
  enemySwarmEntity: Entity,
  minX: number,
  maxX: number
) {
  const enemySwarmAnchorPos = enemySwarmEntity.get(Position)!;
  const enemySwarmAnchorVel = enemySwarmEntity.get(Velocity)!;

  if (enemySwarmAnchorPos.posX > maxX) {
    enemySwarmEntity.set(Velocity, {
      xVel: enemySwarmAnchorVel.xVel * -1,
    });
    enemySwarmEntity.set(Position, {
      posY: enemySwarmAnchorPos.posY + 50,
      // set to boundary again, so that next tick is always away
      posX: maxX,
    });
  } else if (enemySwarmAnchorPos.posX < minX) {
    enemySwarmEntity.set(Velocity, {
      xVel: enemySwarmAnchorVel.xVel * -1,
    });
    enemySwarmEntity.set(Position, {
      posY: enemySwarmAnchorPos.posY + 50,
      // set to boundary again, so that next tick is always away
      posX: minX,
    });
  }
}
