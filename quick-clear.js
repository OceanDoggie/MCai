/**
 * 🚀 MCai 一键清除脚本
 * 
 * 复制以下代码到浏览器 Console (F12) 并按 Enter
 */

(async function clearMCaiData() {
    console.log('🧹 开始清除 MCai 数据...\n');

    try {
        // 动态导入 store
        const { usePlaylistStore } = await import('./store/usePlaylistStore.js');
        const store = usePlaylistStore.getState();

        // 清除所有数据
        store.clearAll();

        console.log('✅ Playlist 数据已清除');
        console.log('   - playlist: []');
        console.log('   - unsortedPoses: []');
        console.log('   - savedPlaylists: 已重置\n');

        // 验证清除结果
        console.log('📊 当前状态：');
        console.log('   Playlist 长度:', store.playlist.length);
        console.log('   Unsorted 长度:', store.unsortedPoses.length);
        console.log('   Saved Playlists:', store.savedPlaylists.length, '个\n');

        console.log('🎉 清除完成！');
        console.log('📝 请刷新页面 (F5) 以应用更改。\n');

        // 可选：自动刷新
        const autoReload = confirm('是否自动刷新页面？');
        if (autoReload) {
            location.reload();
        }

    } catch (error) {
        console.error('❌ 清除失败:', error);
        console.log('\n备用方案：手动刷新页面 (Ctrl + Shift + R)');
    }
})();
