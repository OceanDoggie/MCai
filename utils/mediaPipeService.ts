import { PoseLandmarker, FilesetResolver, PoseLandmarkerResult } from "@mediapipe/tasks-vision";

let poseLandmarker: PoseLandmarker | null = null; // Video Mode
let imageLandmarker: PoseLandmarker | null = null; // Image Mode
let isLoading = false;

// We use the 'Lite' model for better FPS on mobile devices
const MODEL_ASSET_PATH = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

/**
 * Initializes the MediaPipe Pose Landmarker model for VIDEO mode.
 */
export const initPoseDetector = async (): Promise<PoseLandmarker> => {
  if (poseLandmarker) return poseLandmarker;
  
  if (isLoading) {
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (poseLandmarker) return poseLandmarker;
    }
  }

  isLoading = true;
  console.log("Initializing MediaPipe Pose Detector (VIDEO mode)...");

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    
    console.log("MediaPipe Pose Detector (VIDEO) ready.");
    return poseLandmarker;
  } catch (error) {
    console.error("Failed to initialize MediaPipe Pose Detector:", error);
    throw error;
  } finally {
    isLoading = false;
  }
};

/**
 * Detects pose landmarks from a video element (VIDEO Mode).
 */
export const detectPose = (video: HTMLVideoElement, timestamp: number): PoseLandmarkerResult | null => {
  if (!poseLandmarker) {
    if (!isLoading) initPoseDetector();
    return null;
  }

  try {
    return poseLandmarker.detectForVideo(video, timestamp);
  } catch (error) {
    console.warn("Pose detection error (frame skipped):", error);
    return null;
  }
};

/**
 * Initializes (if needed) and detects pose from a static image (IMAGE Mode).
 */
export const detectPoseFromImage = async (image: HTMLImageElement): Promise<PoseLandmarkerResult> => {
  if (!imageLandmarker) {
    console.log("Initializing MediaPipe Pose Detector (IMAGE mode)...");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    imageLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
    });
  }

  return imageLandmarker.detect(image);
};

export const getPoseLandmarkerInstance = () => poseLandmarker;