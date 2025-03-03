import p5 from "p5";
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { introSimulationFactory, drawIntro } from "./scenes/introSimulation";
import {
  gameSimulationFactory,
  gameSimulationFactory_Three,
} from "./scenes/gameSimulation";

// Entrypoint code
const rootEl = document.getElementById("p5-root");
if (!rootEl) {
  throw new Error("Cannot find element root #p5-root");
}
main(rootEl);
// Entrypoint code
const threeRootEl = document.getElementById("three-root");
if (!threeRootEl) {
  throw new Error("Cannot find element root #p5-root");
}
mainThree(threeRootEl);

type AnimationScenes = {
  sceneId: string;
  readonly simulation?: Record<string, any>;
};

type GameSceneState =
  | (
      | {
          sceneId: "START_NULL";
        }
      | {
          sceneId: "CRAWL_INTRO";
          simulation: ReturnType<typeof introSimulationFactory>;
        }
      | {
          sceneId: "SPACE_INVADERS_GAME";
          simulation: ReturnType<typeof gameSimulationFactory>;
        }
      | {
          sceneId: "END";
        }
    ) &
      AnimationScenes;

function myP5(p: p5) {
  let isPaused = false;
  function logGameState() {
    console.log(gameSceneState);
  }

  let font: p5.Font;

  let gameSceneState: GameSceneState = {
    sceneId: "START_NULL",
  };

  // This is simply used so we can prepare a callback for the next tick;
  // Right now it's only used because I am ensuring a draw finishes before transitions
  // to next states occur.
  const nextTickQueue: Array<() => void> = [];
  const queueNextTick = (cb: () => void) => () => {
    nextTickQueue.push(cb);
  };

  // user code goes here
  Object.assign(p, {
    preload() {
      // can preload assets here...
      font = p.loadFont(
        new URL("/fonts/inconsolata.otf", import.meta.url).href
      );
    },
    setup() {
      // Key-bindings setup
      document.addEventListener("keypress", function (e) {
        if (e.code === "KeyP") {
          isPaused = !isPaused;
        } else if (e.code === "KeyD") {
          logGameState();
        }
      });

      // ENGINE SETUP
      p.frameRate(60); // set framerate target
      p.createCanvas(800, 600, p.WEBGL);
      p.background("black");

      // BASE TEXT SETUP
      p.textFont(font);
      p.textSize(36);
      p.textAlign(p.LEFT, p.BOTTOM);

      // create "state machine" for game scenes
      gameSceneState = {
        sceneId: "CRAWL_INTRO",
        simulation: introSimulationFactory(
          p,
          queueNextTick(() => {
            gameSceneState = {
              sceneId: "SPACE_INVADERS_GAME",
              simulation: gameSimulationFactory(
                p,
                queueNextTick(() => {
                  gameSceneState = {
                    sceneId: "END",
                  };
                })
              ),
            };
          })
        ),
      };
    },
    draw() {
      // Run and clear the "next tick queue"
      nextTickQueue.forEach((fn) => {
        return fn();
      });
      nextTickQueue.length = 0;

      // no-op while paused, freeze both drawing + simulation steps
      if (isPaused) {
        return;
      }
      // clear screen
      p.background("black");

      if (gameSceneState.sceneId === "CRAWL_INTRO") {
        gameSceneState.simulation.tick();
        drawIntro(p, gameSceneState.simulation.state);
      } else if (gameSceneState.sceneId === "SPACE_INVADERS_GAME") {
        gameSceneState.simulation.tick();
      } else if (gameSceneState.sceneId === "END") {
        // just draw
        p.push();
        p.textAlign("center", "bottom");
        p.fill([178, 222, 39, 255]);
        p.text("GAME OVER", 0, 0);
        p.pop();
      }
    },
  } satisfies Pick<typeof p, "preload" | "setup" | "draw">);
}

function main(rootElement: HTMLElement) {
  new p5(myP5, rootElement);
}

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
