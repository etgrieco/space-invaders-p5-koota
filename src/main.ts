import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { gameSimulationFactory_Three } from "./scenes/gameSimulation";

// Entrypoint code
const threeRootEl = document.getElementById("three-root");
if (!threeRootEl) {
  throw new Error("Cannot find element root #three-root");
}
mainThree(threeRootEl);

async function mainThree(mountingEl: HTMLElement) {
  const WIDTH = 800;
  const HEIGHT = 600;

  const loader = new GLTFLoader();
  const [spaceInvaderScene] = await Promise.all([
    new Promise<GLTF>((res, rej) => {
      loader.load(
        new URL("/models/space-invader-alien/scene.gltf", import.meta.url).href,
        res,
        undefined,
        rej
      );
    }),
  ]);

  const clock = new THREE.Clock();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(WIDTH, HEIGHT);
  mountingEl.appendChild(renderer.domElement);
  renderer.setAnimationLoop(animate);

  camera.position.z = 5;

  // basic light?
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
  directionalLight.position.set(5, 10, 5); // Adjust position
  scene.add(directionalLight);

  const gameSim = gameSimulationFactory_Three(
    {
      camera,
      scene,
      webGlRenderer: renderer,
      getDeltaTime: () => clock.getDelta() * 1000,
      externalResources: {
        spaceInvadersAlien: spaceInvaderScene,
      },
    },
    // TODO: for now, do nothing
    () => {}
  );

  // basic way to wait for game to start, awaiting synchronization with intro
  let gameStarted = false;
  document.addEventListener("keydown", function (e) {
    if (gameStarted) return;
    if (e.code === "KeyS") {
      gameStarted = true;
      // disposal...
      scene.remove(cube);
    }
  });

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // setup animation loop
  function animate() {
    if (!gameStarted) {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
    } else {
      // add new cubes every second
      // do logic stuff
      gameSim.tick();
    }

    directionalLight.position.x += 0.01;
    directionalLight.position.y += 0.01;
    directionalLight.position.z += 0.01;

    // then render
    renderer.render(scene, camera);
  }
}
