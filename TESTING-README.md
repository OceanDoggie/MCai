# 🧪 MCai 测试与调试工具

本目录包含用于测试和调试 Pose Guide 功能的脚本和指南。

---

## 📁 文件说明

### 📘 指南文档
- **`VERIFICATION-GUIDE.md`** - 完整的验证指南（推荐阅读）
  - 清除旧数据的方法
  - 验证数据源的步骤
  - 完整的测试流程
  - 常见问题排查

- **`DEBUG-POSE-GUIDE.md`** - 调试指南
  - 详细的故障排除步骤
  - Console 调试命令
  - 常见问题解答

### 🛠️ 脚本工具
- **`quick-clear.js`** - 一键清除脚本（最简单）
- **`clear-old-data.js`** - 清除旧数据脚本
- **`test-pose-data.js`** - 数据验证脚本

---

## 🚀 快速开始

### 方法 1：一键清除（推荐）

1. 打开应用 (http://localhost:3000)
2. 打开浏览器开发者工具 (F12)
3. 打开 `quick-clear.js` 文件
4. 复制全部内容到 Console
5. 按 Enter 执行
6. 点击 "确定" 自动刷新页面

### 方法 2：手动清除

在 Console 中运行：

```javascript
import { usePlaylistStore } from './store/usePlaylistStore';
usePlaylistStore.getState().clearAll();
location.reload();
```

### 方法 3：硬刷新浏览器

- **Windows**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

---

## 🧪 验证步骤

### 1️⃣ 清除旧数据
使用上述任一方法清除旧数据。

### 2️⃣ 验证数据源
在 Console 中运行：

```javascript
import { MOCK_POSES } from './data/mockPoses';
console.log('Pose 1:', MOCK_POSES[0].title);
console.log('Structure:', MOCK_POSES[0].structure);
```

**预期输出**：
```
Pose 1: Confident Stance
Structure: {
  head: "Chin high and look slightly away with a confident gaze.",
  hands: "Rest your hand on your waist and pull your elbow back to create space.",
  feet: "Cross your front leg over and point your toe toward the camera."
}
```

### 3️⃣ 测试完整流程
1. 进入 **Pose Library**
2. 点击 **"Confident Stance"** 的 **+** 按钮
3. 进入 **Playlist View**
4. 将 Pose 移动到一个 Saved Playlist
5. 点击 **"Start Session"**
6. 检查右侧是否显示正确的 HEAD/HANDS/FEET

### 4️⃣ 查看调试日志
在 Camera View 中，Console 会自动显示：

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

---

## ✅ 验证成功的标志

### Console 输出
- ✅ `Title: Confident Stance`
- ✅ `Structure` 对象包含完整的 head/hands/feet
- ✅ 没有 "❌ MISSING" 标记

### UI 显示
- ✅ 右侧显示完整的引导词（不是默认值）
- ✅ 引导词与 mockPoses.ts 中的内容一致
- ✅ 图片正确加载（速写图）

---

## 🔧 已添加的调试功能

### 1. `clearAll()` 方法
在 `store/usePlaylistStore.ts` 中添加了 `clearAll()` 方法：

```typescript
clearAll: () => {
  set({
    playlist: [],
    unsortedPoses: [],
    savedPlaylists: [
      { id: 'pl-1', title: 'Morning Shoot', items: [] },
      { id: 'pl-2', title: 'Studio Vibes', items: [] }
    ]
  });
  console.log('✅ All playlist data cleared!');
}
```

### 2. 调试日志
在 `views/CameraView.tsx` 中添加了 `useEffect` 调试日志：

```typescript
useEffect(() => {
    if (activePose) {
        console.log('=== Active Pose Debug ===');
        console.log('Title:', activePose.title);
        console.log('Structure:', activePose.structure);
        console.log('  - HEAD:', activePose.structure?.head || '❌ MISSING');
        console.log('  - HANDS:', activePose.structure?.hands || '❌ MISSING');
        console.log('  - FEET:', activePose.structure?.feet || '❌ MISSING');
        console.log('========================');
    }
}, [activePose]);
```

---

## ❌ 常见问题

### Q: Console 显示 "❌ MISSING"
**A**: 运行 `clearAll()` 并刷新页面，重新添加 Pose。

### Q: UI 显示默认值（"Natural"/"Relaxed"/"Stable"）
**A**: 说明 `structure` 字段缺失，清除旧数据即可。

### Q: 图片无法加载
**A**: 检查 `public/input_photos/` 文件夹是否包含图片。

### Q: Pose Library 显示旧图片
**A**: 硬刷新浏览器 (`Ctrl + Shift + R`)。

---

## 📞 需要帮助？

详细的故障排除步骤请参考：
- **`VERIFICATION-GUIDE.md`** - 完整验证流程
- **`DEBUG-POSE-GUIDE.md`** - 调试指南

如果问题仍未解决，请提供：
1. Console 的完整输出
2. `activePose` 对象的内容
3. 当前显示的截图
