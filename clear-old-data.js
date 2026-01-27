/**
 * MCai - 清除旧数据脚本
 * 
 * 使用方法：
 * 1. 打开浏览器开发者工具 (F12)
 * 2. 在 Console 中粘贴以下代码并回车
 * 3. 刷新页面 (F5)
 */

// 方法 1：使用 clearAll 方法（推荐）
import { usePlaylistStore } from './store/usePlaylistStore';

const store = usePlaylistStore.getState();
store.clearAll();

console.log('✅ 所有 Playlist 数据已清除！');
console.log('📝 请刷新页面 (F5) 以应用更改。');

// 方法 2：手动清除（备用）
/*
const store = usePlaylistStore.getState();
store.playlist = [];
store.unsortedPoses = [];
store.savedPlaylists.forEach(pl => pl.items = []);
console.log('✅ 手动清除完成！请刷新页面。');
*/

// 方法 3：清除 localStorage（如果使用了持久化）
/*
localStorage.clear();
console.log('✅ localStorage 已清除！请刷新页面。');
*/
