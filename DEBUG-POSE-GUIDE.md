# MCai Pose Guide 调试指南

## 问题诊断结果

### ✅ 代码逻辑正确
经过完整代码审查，确认：
1. UI 组件正确读取 `activePose.structure.head/hands/feet`
2. 数据流程完整，不依赖 AI API
3. `structure` 字段在整个流程中都被保留

### 📍 关键文件位置

**显示组件**：`views/CameraView.tsx` (第 329-344 行)
**数据源**：`data/mockPoses.ts`
**状态管理**：`store/usePlaylistStore.ts`

---

## 🔧 故障排除步骤

### 步骤 1：验证数据源
打开浏览器开发者工具 (F12)，在 Console 中运行：

```javascript
// 导入数据
import { MOCK_POSES } from './data/mockPoses';

// 检查第一个 Pose (Confident Stance)
const pose1 = MOCK_POSES[0];
console.log('Title:', pose1.title);
console.log('Structure:', pose1.structure);
```

**预期输出**：
```
Title: "Confident Stance"
Structure: {
  head: "Chin high and look slightly away with a confident gaze.",
  hands: "Rest your hand on your waist and pull your elbow back to create space.",
  feet: "Cross your front leg over and point your toe toward the camera."
}
```

---

### 步骤 2：检查 Playlist 数据
在 Console 中运行：

```javascript
// 检查当前 Playlist
import { usePlaylistStore } from './store/usePlaylistStore';
const store = usePlaylistStore.getState();

console.log('Current Playlist:', store.playlist);
console.log('Unsorted Poses:', store.unsortedPoses);

// 检查第一个 Playlist Item
if (store.playlist.length > 0) {
    const firstItem = store.playlist[0];
    console.log('First Pose in Playlist:', firstItem.title);
    console.log('Structure:', firstItem.structure);
}
```

**如果 `structure` 为 undefined**：说明旧数据还在缓存中。

---

### 步骤 3：清除旧数据并重新加载

#### 方法 A：清除 Playlist（推荐）
在 Console 中运行：

```javascript
import { usePlaylistStore } from './store/usePlaylistStore';
const store = usePlaylistStore.getState();

// 清空所有数据
store.clearPlaylist();
store.unsortedPoses = [];
store.savedPlaylists.forEach(pl => pl.items = []);

console.log('✅ Playlist cleared! Please refresh the page.');
```

然后刷新页面 (F5)。

#### 方法 B：清除浏览器缓存
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载"

---

### 步骤 4：重新添加 Pose
1. 进入 **Pose Library**
2. 找到 **"Confident Stance"**（应该显示新的速写图）
3. 点击 **+** 按钮添加到购物车
4. 进入 **Playlist View**
5. 将 Pose 移动到一个 Saved Playlist
6. 点击 **"Start Session"**
7. 检查右侧是否显示正确的 HEAD/HANDS/FEET

---

### 步骤 5：实时调试 CameraView
在 `views/CameraView.tsx` 第 40 行后添加调试代码：

```typescript
const activePose = playlist[activeIndex];

// 🔍 调试：打印当前 Pose 数据
useEffect(() => {
    if (activePose) {
        console.log('=== Active Pose Debug ===');
        console.log('Title:', activePose.title);
        console.log('Structure:', activePose.structure);
        console.log('HEAD:', activePose.structure?.head);
        console.log('HANDS:', activePose.structure?.hands);
        console.log('FEET:', activePose.structure?.feet);
    }
}, [activePose]);
```

保存后，在 Camera View 中查看 Console 输出。

---

## 🎯 预期正确行为

选择 **"Confident Stance"** 后，右侧应显示：

```
HEAD
Chin high and look slightly away with a confident gaze.

HANDS
Rest your hand on your waist and pull your elbow back to create space.

FEET
Cross your front leg over and point your toe toward the camera.
```

---

## 📝 常见问题

### Q1: 显示的是 "Natural" / "Relaxed" / "Stable"
**原因**：`activePose.structure` 为 undefined，触发了默认值。
**解决**：清除旧数据，重新添加 Pose。

### Q2: 图片无法加载
**原因**：图片路径不正确。
**验证**：检查 `public/input_photos/` 文件夹是否包含 pose1.png - pose5.png。

### Q3: Pose Library 还是显示旧的占位符图片
**原因**：浏览器缓存了旧的 mockPoses.ts。
**解决**：硬刷新 (Ctrl + Shift + R)。

---

## 📞 需要进一步帮助？

如果以上步骤都无法解决问题，请提供：
1. 浏览器 Console 的错误信息
2. `activePose` 对象的完整输出
3. 当前显示的 HEAD/HANDS/FEET 内容截图
