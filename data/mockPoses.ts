import { Pose, PoseCategory, PoseDifficulty } from '../types';

export const MOCK_POSES: Pose[] = [
  {
    id: 'p1',
    title: 'Confident Stance',
    description: '2 arms (1.8m) | 1x | Chest Level | Inward 15°',
    imageSrc: '/input_photos/pose1.png',
    category: PoseCategory.FULL_BODY,
    tags: ['Confident', 'Fashion', 'Editorial'],
    difficulty: PoseDifficulty.EASY,
    tips: ['Chin high and look slightly away', 'Create space with your elbow', 'Cross your front leg'],
    structure: {
      head: 'Chin high and look slightly away with a confident gaze.',
      hands: 'Rest your hand on your waist and pull your elbow back to create space.',
      feet: 'Cross your front leg over and point your toe toward the camera.'
    }
  },
  {
    id: 'p2',
    title: 'Wall Lean',
    description: '2 arms (2.0m) | 1x | Chest Level | Inward 15°',
    imageSrc: '/input_photos/pose2.png',
    category: PoseCategory.FULL_BODY,
    tags: ['Relaxed', 'Soft', 'Casual'],
    difficulty: PoseDifficulty.EASY,
    tips: ['Lean back against the wall', 'Bring hands to hair', 'Keep expression soft'],
    structure: {
      head: 'Lean your head back against the wall and keep your expression soft.',
      hands: 'Bring both hands up to your hair and let your elbows go wide.',
      feet: 'Lean your hip into the wall and keep your legs long and straight.'
    }
  },
  {
    id: 'p3',
    title: 'Kneeling Pose',
    description: '1 arm (1.2m) | 2x | Neck Level | Outward 10°',
    imageSrc: '/input_photos/pose3.png',
    category: PoseCategory.FULL_BODY,
    tags: ['Dynamic', 'Focused', 'Athletic'],
    difficulty: PoseDifficulty.MEDIUM,
    tips: ['Chin down slightly', 'Lift one arm overhead', 'Kneel with one leg forward'],
    structure: {
      head: 'Chin down slightly and look toward your shoulder for a focused look.',
      hands: 'Lift one arm over your head and rest the other hand on your thigh.',
      feet: 'Kneel down with one leg forward and sit back slightly on your heels.'
    }
  },
  {
    id: 'p4',
    title: 'Reaching High',
    description: '4 arms (3.0m) | 1x | Knee Level | Inward 15°',
    imageSrc: '/input_photos/pose4.png',
    category: PoseCategory.FULL_BODY,
    tags: ['Dramatic', 'Stretch', 'Expressive'],
    difficulty: PoseDifficulty.HARD,
    tips: ['Tilt head back', 'Stretch one arm high', 'Stand on tiptoes'],
    structure: {
      head: 'Tilt your head back and look up toward your raised hand.',
      hands: 'Stretch one arm as high as you can while keeping the other relaxed.',
      feet: 'Cross your legs at the ankles and stand on your tiptoes for extra height.'
    }
  },
  {
    id: 'p5',
    title: 'Graceful Reach',
    description: '2 arms (1.8m) | 1x | Chest Level | Inward 15°',
    imageSrc: '/input_photos/pose5.png',
    category: PoseCategory.FULL_BODY,
    tags: ['Elegant', 'Graceful', 'Expressive'],
    difficulty: PoseDifficulty.MEDIUM,
    tips: ['Chin high', 'One hand on chest', 'Lean into the reach'],
    structure: {
      head: 'Chin high and follow the line of your reaching arm with your eyes.',
      hands: 'Place one hand flat on your chest and reach the other out gracefully.',
      feet: 'Stand with your feet together and lean your torso slightly into the reach.'
    }
  },
  {
    id: 'p6',
    title: 'The Triangle',
    description: 'Hand on hip, creating triangles with arms and legs.',
    imageSrc: 'https://picsum.photos/id/111/400/600',
    category: PoseCategory.FULL_BODY,
    tags: ['Fashion', 'Editorial', 'Geometry'],
    difficulty: PoseDifficulty.HARD,
    tips: ['Pop the hip', 'Create negative space', 'Elongate the neck'],
    structure: {
      head: 'Elongate neck, look past camera.',
      hands: 'Left hand on hip, elbow out (triangle).',
      feet: 'Wide stance, weight on back leg.'
    }
  },
  {
    id: 'p7',
    title: 'Sunkissed',
    description: 'Face tilted up towards the sun, eyes closed.',
    imageSrc: 'https://picsum.photos/id/129/400/600',
    category: PoseCategory.PORTRAIT,
    tags: ['Nature', 'Peaceful', 'Warm'],
    difficulty: PoseDifficulty.EASY,
    tips: ['Relax facial muscles', 'Chin up', 'Feel the warmth'],
    structure: {
      head: 'Tilted back 45 degrees, eyes closed.',
      hands: 'Relaxed by sides or touching collarbone.',
      feet: 'Relaxed standing.'
    }
  },
  {
    id: 'p8',
    title: 'Jacket Slung',
    description: 'Holding jacket over one shoulder, other hand in pocket.',
    imageSrc: 'https://picsum.photos/id/145/400/600',
    category: PoseCategory.HALF_BODY,
    tags: ['Menswear', 'Cool', 'Fashion'],
    difficulty: PoseDifficulty.MEDIUM,
    tips: ['Weight on back foot', 'Thumb in pocket', 'Relax the hanging arm'],
    structure: {
      head: 'Slight squint, cool expression.',
      hands: 'R: Hooking jacket over shoulder / L: Pocket.',
      feet: 'Leaning on back leg.'
    }
  },
  {
    id: 'p9',
    title: 'Floor Sit',
    description: 'Sitting cross-legged, leaning forward on hands.',
    imageSrc: 'https://picsum.photos/id/158/400/600',
    category: PoseCategory.FULL_BODY,
    tags: ['Indoor', 'Home', 'Casual'],
    difficulty: PoseDifficulty.MEDIUM,
    tips: ['Straight back', 'Engage core', 'Soft smile'],
    structure: {
      head: 'Tilted to side, smiling.',
      hands: 'Palms on floor supporting weight.',
      feet: 'Cross-legged (pretzel style).'
    }
  },
  {
    id: 'p10',
    title: 'Profile Silhouette',
    description: 'Side profile, strong jawline, backlit.',
    imageSrc: 'https://picsum.photos/id/177/400/600',
    category: PoseCategory.PORTRAIT,
    tags: ['Artistic', 'Moody', 'Shadow'],
    difficulty: PoseDifficulty.HARD,
    tips: ['Extend neck forward', 'Shoulders down', 'Don\'t rotate head'],
    structure: {
      head: '90 degree profile, chin forward.',
      hands: 'N/A.',
      feet: 'N/A.'
    }
  },
];