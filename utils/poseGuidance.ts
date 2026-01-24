import { Landmark } from '../types';

/**
 * Generates static guidance keywords/structure based on pose landmarks.
 * This translates raw coordinates into semantic descriptions (e.g. "Hands on hips").
 * 
 * @param landmarks The 33 pose landmarks detected by MediaPipe
 * @returns An array of string descriptors (placeholder for now)
 */
export const generateStaticGuidance = (landmarks: Landmark[] | undefined): string[] => {
  if (!landmarks || landmarks.length === 0) return [];

  // TODO: Implement geometric logic to determine pose structure.
  // Example logic (future implementation):
  // 1. Calculate angle at Elbow (Shoulder-Elbow-Wrist)
  // 2. If angle < 90 and Wrist.y > Shoulder.y -> "Hands Up"
  // 3. If Wrist is near Hip -> "Hand on Hip"
  
  const guidance: string[] = [];
  
  // Placeholder return to satisfy the interface
  return guidance;
};