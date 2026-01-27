# MCai Pose Guide 验证指南

## 🎯 目标
验证 Pose Library 中的新数据（速写图 + 固定引导词）是否正确显示在拍摄界面。

---

## 📋 准备工作

### ✅ 已完成的修改
1. ✅ `data/mockPoses.ts` - 已更新前 5 个 Pose 的数据
2. ✅ `public/input_photos/` - 已复制 pose1.png - pose5.png
3. ✅ `store/usePlaylistStore.ts` - 已添加 `clearAll()` 方法
4. ✅ `views/CameraView.tsx` - 已添加调试日志

---

## 🔧 步骤 1：清除旧数据

### 方法 A：使用 clearAll 方法（推荐）

1. 打开应用 (http://localhost:3000)
2. 打开浏览器开发者工具 (F12)
3. 在 Console 中粘贴以下代码：

```javascript
// 导入 store
import { usePlaylistStore } from './store/usePlaylistStore';

// 清除所有数据
const store = usePlaylistStore.getState();
store.clearAll();

// 验证清除结果
console.log('Playlist:', store.playlist);
console.log('Unsorted:', store.unsortedPoses);
console.log('Saved Playlists:', store.savedPlaylists);
```

4. 按 Enter 执行
5. 看到 "✅ All playlist data cleared!" 消息

### 方法 B：硬刷新浏览器

- **Windows**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

这会清除浏览器缓存并重新加载所有资源。

---

## 🧪 步骤 2：验证数据源

在 Console 中运行以下代码，验证 mockPoses.ts 数据是否正确：

```javascript
import { MOCK_POSES } from './data/mockPoses';

// 检查第一个 Pose (Confident Stance)
const pose1 = MOCK_POSES[0];

console.log('=== Pose 1 验证 ===');
console.log('ID:', pose1.id);
console.log('Title:', pose1.title);
console.log('Description:', pose1.description);
console.log('Image:', pose1.imageSrc);
console.log('\nStructure:');
console.log('  HEAD:', pose1.structure.head);
console.log('  HANDS:', pose1.structure.hands);
console.log('  FEET:', pose1.structure.feet);
```

### 预期输出：
```
=== Pose 1 验证 ===
ID: p1
Title: Confident Stance
Description: 2 arms (1.8m) | 1x | Chest Level | Inward 15°
Image: /input_photos/pose1.png

Structure:
  HEAD: Chin high and look slightly away with a confident gaze.
  HANDS: Rest your hand on your waist and pull your elbow back to create space.
  FEET: Cross your front leg over and point your toe toward the camera.
```

✅ 如果输出正确，说明数据源没问题！

---

## 📸 步骤 3：测试完整流程

### 3.1 进入 Pose Library
1. 刷新页面 (F5)
2. 点击底部导航的 "Pose Library" 图标
3. 验证前 5 个 Pose 是否显示新的速写图：
   - ✅ Confident Stance
   - ✅ Wall Lean
   - ✅ Kneeling Pose
   - ✅ Reaching High
   - ✅ Graceful Reach

### 3.2 添加 Pose 到 Playlist
1. 点击 "Confident Stance" 的 **+** 按钮
2. 看到提示 "Added to Unsorted Cart"
3. 点击底部导航的 "Playlist" 图标

### 3.3 组织 Playlist
1. 在 Playlist View 中，找到 "Unsorted" 区域
2. 将 "Confident Stance" 拖动到 "Morning Shoot" 或 "Studio Vibes"
3. 点击该 Playlist 的 "Start Session" 按钮

### 3.4 验证拍摄界面
1. 进入 Camera View
2. 打开 Console (F12)，查看调试日志：

```
=== Active Pose Debug ===
Title: Confident Stance
Description: 2 arms (1.8m) | 1x | Chest Level | Inward 15°
Structure: {head: '...', hands: '...', feet: '...'}
  - HEAD: Chin high and look slightly away with a confident gaze.
  - HANDS: Rest your hand on your waist and pull your elbow back to create space.
  - FEET: Cross your front leg over and point your toe toward the camera.
========================
```

3. 查看右侧边栏，验证显示内容：

```
┌─────────────────────────────────────┐
│ HEAD                                │
│ Chin high and look slightly away    │
│ with a confident gaze.              │
├─────────────────────────────────────┤
│ HANDS                               │
│ Rest your hand on your waist and    │
│ pull your elbow back to create      │
│ space.                              │
├─────────────────────────────────────┤
│ FEET                                │
│ Cross your front leg over and       │
│ point your toe toward the camera.   │
└─────────────────────────────────────┘
```

---

## ✅ 验证成功的标志

### Console 输出
- ✅ `Title: Confident Stance`
- ✅ `Structure` 对象包含完整的 head/hands/feet
- ✅ 没有 "❌ MISSING" 标记

### UI 显示
- ✅ 右侧显示完整的引导词（不是 "Natural"/"Relaxed"/"Stable"）
- ✅ 引导词与 mockPoses.ts 中的内容完全一致
- ✅ 图片正确加载（速写图，不是占位符）

---

## ❌ 常见问题排查

### 问题 1：Console 显示 "❌ MISSING"
**原因**：`activePose.structure` 为 undefined
**解决**：
1. 运行 `store.clearAll()`
2. 刷新页面
3. 重新添加 Pose

### 问题 2：UI 显示 "Natural" / "Relaxed" / "Stable"
**原因**：触发了默认值，说明 `structure` 字段缺失
**解决**：同问题 1

### 问题 3：图片无法加载（404）
**原因**：图片路径不正确
**验证**：
```javascript
// 在 Console 中检查图片
const img = new Image();
img.src = '/input_photos/pose1.png';
img.onload = () => console.log('✅ 图片加载成功');
img.onerror = () => console.log('❌ 图片加载失败');
```

**解决**：
- 确认 `public/input_photos/` 文件夹存在
- 确认包含 pose1.png - pose5.png
- 重启 dev server

### 问题 4：Pose Library 还是显示旧的占位符图片
**原因**：浏览器缓存了旧的 mockPoses.ts
**解决**：
- 硬刷新：`Ctrl + Shift + R`
- 或清除浏览器缓存

---

## 🎉 测试完成

如果所有步骤都通过，恭喜！你的 Pose Guide 系统已经正确配置。

现在你可以：
1. 添加更多 Pose 到 Playlist
2. 测试不同的 Pose 切换
3. 验证所有 5 个新 Pose 的数据

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. Console 的完整输出（包括错误信息）
2. `activePose` 对象的内容
3. 当前显示的 HEAD/HANDS/FEET 内容截图
