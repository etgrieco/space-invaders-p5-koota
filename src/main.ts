import p5 from "p5";
import { introSimulationFactory, drawIntro } from "./scenes/introSimulation";
import { gameSimulationFactory } from "./scenes/gameSimulation";

// Entrypoint code
const rootEl = document.getElementById("p5-root");
if (!rootEl) {
  throw new Error("Cannot find element root #p5-root");
}
main(rootEl);

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

  // user code goes here
  Object.assign(p, {
    preload() {
      // can preload assets here...
      font = p.loadFont(
        new URL("/public/fonts/inconsolata.otf", import.meta.url).href
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
    },
    draw() {
      // no-op while paused, freeze both drawing + simulation steps
      if (isPaused) {
        return;
      }
      // clear screen
      p.background("black");

      if (gameSceneState.sceneId === "START_NULL") {
        // TRANSITION
        gameSceneState = {
          sceneId: "CRAWL_INTRO",
          simulation: introSimulationFactory(p, () => {
            gameSceneState = {
              sceneId: "SPACE_INVADERS_GAME",
              simulation: gameSimulationFactory(p, () => {
                gameSceneState = {
                  sceneId: "END",
                };
              }),
            };
          }),
        };
      } else if (gameSceneState.sceneId === "CRAWL_INTRO") {
        gameSceneState.simulation.tick();
        drawIntro(p, gameSceneState.simulation.state);
      } else if (gameSceneState.sceneId === "SPACE_INVADERS_GAME") {
        gameSceneState.simulation.tick();
        // draw...
      } else if (gameSceneState.sceneId === "END") {
        window.alert("END!");
      }
    },
  } satisfies Pick<typeof p, "preload" | "setup" | "draw">);
}

function main(rootElement: HTMLElement) {
  new p5(myP5, rootElement);
}
