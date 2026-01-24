import { Pose, PoseCategory, PoseDifficulty } from '../types';

export const MOCK_POSES: Pose[] = [
  {
    id: 'p1',
    title: 'The Lean',
    description: 'Casual leaning against a wall, one leg crossed.',
    imageSrc: 'https://picsum.photos/id/1012/400/600',
    category: PoseCategory.FULL_BODY,
    tags: ['Casual', 'Street', 'Relaxed'],
    difficulty: PoseDifficulty.EASY,
    tips: ['Lean back gently', 'Cross the outer leg', 'Look away from camera'],
    structure: {
      head: 'Tilt slightly away from the wall, chin down.',
      hands: 'One hand in pocket, other relaxing by side.',
      feet: 'Cross outer leg over inner leg, toe pointed.'
    }
  },
  {
    id: 'p2',
    title: 'Hair Tuck',
    description: 'One hand gently tucking hair behind ear.',
    imageSrc: 'https://picsum.photos/id/1027/400/600',
    category: PoseCategory.PORTRAIT,
    tags: ['Feminine', 'Soft', 'Headshot'],
    difficulty: PoseDifficulty.EASY,
    tips: ['Relax your shoulder', 'Soft fingers', 'Chin slightly down'],
    structure: {
      head: 'Face camera directly, slight tilt to left.',
      hands: 'Right hand tucking hair, fingers distinct.',
      feet: 'N/A (Portrait focus).'
    }
  },
  {
    id: 'p3',
    title: 'Walking Away',
    description: 'Walking away from camera, looking back over shoulder.',
    imageSrc: 'https://picsum.photos/id/1059/400/600',
    category: PoseCategory.FULL_BODY,
    tags: ['Motion', 'Street', 'Candid'],
    difficulty: PoseDifficulty.MEDIUM,
    tips: ['Take a large step', 'Turn torso back', 'Don\'t look at lens directly'],
    structure: {
      head: 'Turn back over shoulder, eyes on horizon.',
      hands: 'Natural swing, or one holding bag.',
      feet: 'Mid-stride, back heel lifted.'
    }
  },
  {
    id: 'p4',
    title: 'Coffee Date',
    description: 'Holding a cup with both hands, elbows on table.',
    imageSrc: 'https://picsum.photos/id/1060/400/600',
    category: PoseCategory.HALF_BODY,
    tags: ['Lifestyle', 'Cafe', 'Cozy'],
    difficulty: PoseDifficulty.EASY,
    tips: ['Lean forward', 'Engage with the lens', 'Relax shoulders'],
    structure: {
      head: 'Level gaze, engaging smile.',
      hands: 'Both hands wrapping the cup, elbows wide.',
      feet: 'Hidden under table.'
    }
  },
  {
    id: 'p5',
    title: 'Power Suit',
    description: 'Arms crossed, legs shoulder width apart, confident stance.',
    imageSrc: 'https://picsum.photos/id/1070/400/600',
    category: PoseCategory.FULL_BODY,
    tags: ['Business', 'Strong', 'Confident'],
    difficulty: PoseDifficulty.MEDIUM,
    tips: ['Stand tall', 'Chest out', 'Firm gaze'],
    structure: {
      head: 'Chin up, direct eye contact.',
      hands: 'Arms crossed high on chest.',
      feet: 'Shoulder-width apart, weight even.'
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