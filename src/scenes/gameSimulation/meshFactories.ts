import * as THREE from "three";

export function enemyDroneBasicMesh() {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.25, 0.25),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
}
