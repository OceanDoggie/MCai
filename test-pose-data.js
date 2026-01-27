// 快速测试脚本：验证 mockPoses.ts 中的 structure 数据
// 在浏览器控制台运行此脚本

import { MOCK_POSES } from './data/mockPoses';

console.log('=== MCai Pose Data Test ===\n');

// 测试前 5 个 Pose（新的速写图数据）
const testPoses = MOCK_POSES.slice(0, 5);

testPoses.forEach((pose, index) => {
    console.log(`\n📸 Pose ${index + 1}: ${pose.title}`);
    console.log(`   ID: ${pose.id}`);
    console.log(`   Image: ${pose.imageSrc}`);
    console.log(`   Description: ${pose.description}`);
    console.log(`\n   Structure:`);
    console.log(`   - HEAD: ${pose.structure?.head || '❌ MISSING'}`);
    console.log(`   - HANDS: ${pose.structure?.hands || '❌ MISSING'}`);
    console.log(`   - FEET: ${pose.structure?.feet || '❌ MISSING'}`);
    console.log(`   ---`);
});

console.log('\n✅ Test complete!');
console.log(`Total poses in MOCK_POSES: ${MOCK_POSES.length}`);
