# AI功能迁移测试清单

## 后端测试

### 1. 视觉分析模块测试
- [ ] 运行 `python backend/test_vision.py`
- [ ] 确认能成功调用Gemini API
- [ ] 确认返回JSON格式正确
- [ ] 确认包含所有必需字段（title, structure等）

### 2. 姿势数据库测试
- [ ] 运行 `python backend/init_poses.py`
- [ ] 确认生成 `poses.json` 文件
- [ ] 打开文件确认数据格式正确
- [ ] 测试查询功能：`python -c "from pose_database import get_pose; print(get_pose('confident-stance'))"`

### 3. WebSocket集成测试
- [ ] 启动后端：`python -m uvicorn main:app --host 0.0.0.0 --port 8000`
- [ ] 运行WebSocket测试：`python backend/test_ws_integration.py`
- [ ] 检查日志是否有 "Pose analyzed and saved"
- [ ] 确认没有报错

### 4. REST API测试
- [ ] 启动后端后访问 `http://localhost:8000/api/poses` 确认返回姿势列表
- [ ] 用curl测试分析端点：`curl -X POST http://localhost:8000/api/analyze-pose -H "Content-Type: application/json" -d "{\"image\":\"...\",\"source_name\":\"test\"}"`

## 前端测试

### 5. 依赖清理验证
- [ ] 确认 `package.json` 中没有 `@google/genai`
- [ ] 确认 `services/gemini.ts` 已删除
- [ ] 运行 `npm install` 无报错
- [ ] 运行 `npm run dev` 能正常启动

### 6. 图片上传测试
- [ ] 打开浏览器开发者工具 Console
- [ ] 在PlaylistView上传一张姿势图片
- [ ] 确认Network标签中有 `POST /api/analyze-pose` 请求
- [ ] 确认响应包含 title, structure, tips 等字段
- [ ] 确认UI显示分析结果

### 7. 完整流程测试
- [ ] 上传一张参考姿势图片
- [ ] 等待分析完成（约5-15秒）
- [ ] 确认生成了固定提示词（head/hands/feet）
- [ ] 选择该姿势，开始实时拍照
- [ ] 确认能看到实时纠错提示
- [ ] 确认提示内容基于上传的参考姿势

## 安全性验证

### 8. API Key安全检查
- [ ] 打开浏览器DevTools → Sources
- [ ] 搜索 "GEMINI_API_KEY" 或 "AIza"
- [ ] **确认完全找不到API Key**（如果找到，说明有泄露）
- [ ] 查看Network标签，确认API请求发往 localhost:8000，而不是 generativelanguage.googleapis.com

## 性能测试

### 9. 响应时间
- [ ] 图片分析时间：应在 5-15秒
- [ ] WebSocket延迟：应小于 500ms
- [ ] 实时纠错响应：应小于 2秒

## 错误处理

### 10. 异常情况测试
- [ ] 后端未启动时上传图片 → 应fallback到默认数据
- [ ] 上传无效图片 → 应显示错误提示
- [ ] 选择不存在的pose_id → 应显示错误
