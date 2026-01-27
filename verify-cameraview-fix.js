/**
 * 🧪 CameraView 指导词显示验证脚本
 * 
 * 在浏览器 Console (F12) 中运行此脚本
 */

(async function verifyCameraViewFix() {
    console.log('🔍 开始验证 CameraView 指导词显示...\n');

    try {
        // 导入数据
        const { MOCK_POSES } = await import('./data/mockPoses.js');

        console.log('📊 验证数据源：\n');

        // 检查前 5 个 Pose
        const testPoses = MOCK_POSES.slice(0, 5);

        testPoses.forEach((pose, index) => {
            console.log(`${index + 1}. ${pose.title}`);
            console.log(`   📸 摄影师指导词 (description):`);
            console.log(`      "${pose.description}"`);
            console.log(`   👤 模特指导词 (structure):`);
            console.log(`      HEAD: ${pose.structure.head}`);
            console.log(`      HANDS: ${pose.structure.hands}`);
            console.log(`      FEET: ${pose.structure.feet}`);
            console.log('');
        });

        console.log('✅ 数据源验证完成！\n');

        console.log('📝 验证清单：');
        console.log('1. 进入 Camera View');
        console.log('2. 检查顶部大字是否显示 description（摄影师指导词）');
        console.log('3. 检查右侧 HEAD/HANDS/FEET 是否显示 structure（模特指导词）');
        console.log('4. 测试 FEET 警告：移动让脚部移出画面');
        console.log('5. 验证是否显示 "⚠️ Fix!" + 固定提示词\n');

        console.log('🎯 预期效果：');
        console.log('顶部大字：  "2 arms (2.0m) | 1x | Chest Level | Inward 15°"');
        console.log('FEET 正常：  "Lean your hip into the wall..."');
        console.log('FEET 警告：  "⚠️ Fix! Lean your hip into the wall..."\n');

    } catch (error) {
        console.error('❌ 验证失败:', error);
    }
})();
