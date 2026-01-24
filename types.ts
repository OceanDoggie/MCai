// Define the categories for poses
export enum PoseCategory {
  FULL_BODY = 'Full Body',
  HALF_BODY = 'Half Body',
  PORTRAIT = 'Portrait',
  SELFIE = 'Selfie',
  COUPLE = 'Couple',
}

// Define the Difficulty levels
export enum PoseDifficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard',
}

// Detailed Breakdown of the pose for the "Detail Guidance" Sidebar
export interface PoseStructure {
  head: string; // e.g., "Chin up, look at lens"
  hands: string; // e.g., "Left hand in pocket"
  feet: string;  // e.g., "Cross right leg over"
}

// MediaPipe Landmark structure
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// The Core Pose Data Model
export interface Pose {
  id: string;
  title: string;
  description: string;
  imageSrc: string; // URL for the preview image
  skeletonSrc?: string; // Optional: specific SVG path or URL for the skeleton overlay
  category: PoseCategory;
  tags: string[]; // Keywords like 'Cool', 'Elegant'
  difficulty: PoseDifficulty;
  tips: string[]; // Short, random snippets for the "Live AI Chat" (e.g., "Chin up", "Turn 45 deg")
  structure: PoseStructure; // Structured breakdown for the sidebar
  landmarks?: Landmark[]; // Detected 33 body keypoints from MediaPipe
}

// Playlist Item might need unique instance IDs if the same pose is added twice (optional, but good practice)
export interface PlaylistItem extends Pose {
  instanceId: string; // Unique ID for the playlist item in case of duplicates
}

// A Named Collection of Poses (The "Booklet")
export interface SavedPlaylist {
  id: string;
  title: string;
  items: PlaylistItem[];
}