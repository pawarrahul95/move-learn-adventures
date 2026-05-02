// Loaders for MediaPipe Tasks (Hand + Pose). Browser-only.
import {
  HandLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let filesetPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
function fileset() {
  if (!filesetPromise) filesetPromise = FilesetResolver.forVisionTasks(WASM_BASE);
  return filesetPromise;
}

let handPromise: Promise<HandLandmarker> | null = null;
export function getHandLandmarker() {
  if (!handPromise) {
    handPromise = (async () => {
      const f = await fileset();
      return HandLandmarker.createFromOptions(f, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return handPromise;
}

let posePromise: Promise<PoseLandmarker> | null = null;
export function getPoseLandmarker() {
  if (!posePromise) {
    posePromise = (async () => {
      const f = await fileset();
      return PoseLandmarker.createFromOptions(f, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })();
  }
  return posePromise;
}

export type { HandLandmarkerResult, PoseLandmarkerResult };
