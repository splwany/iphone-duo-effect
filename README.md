# 折光 · Tilt to Fold

把自己的截图放到手机屏幕上，通过左右倾斜体验磨砂封皮翻开的视觉错觉。Vite + React + TypeScript + WebGL 2。

本项目是独立视觉实验，不是 Apple 官方产品，也不是实测亚克力的物理复刻。基线：全参数精调 23。

## 快速运行

需要 Node.js 22.12+（推荐 Node.js 24）。

```sh
npm ci
npm run dev
```

浏览器打开 http://127.0.0.1:8765/。开发源码在 `src/`，修改后自动更新。

```sh
npm test              # 体感算法、参数映射与存储迁移回归
npm run typecheck     # 严格 TypeScript 检查
npm run build         # 类型检查并构建 dist/
npm run preview       # 本地预览构建结果
npm run format:check  # 格式检查
npm run test:browser  # 已启动服务且安装 Chrome 后进行浏览器回归
```

## 工程结构

- `src/components/`：预览、参数滑块和操作面板 React 组件。
- `src/config/effects.ts`：11 项参数的标签、范围、存储键和旧值迁移。
- `src/engine/experience.ts`：动画帧、导图、体感权限与沉浸布局的生命周期控制。
- `src/engine/TiltTracker.ts`：重力校准与角度跟踪。
- `src/engine/DepthRenderer.ts`：WebGL 2 渲染与 GPU 资源释放。
- `src/styles/style.css`：保留原版规则及覆盖顺序，避免布局变化。
- `public/`：示例、图标和主屏幕 manifest。
- `tests/`：自动化回归。

React 管理页面结构；每帧绘制及已验证的 Safari 沉浸节点移动由独立控制器管理。
浏览器回归默认访问 8765 端口；可通过 `APP_URL` 指定预览服务，通过 `BASELINE_URL` 指定原版服务以启用逐像素对比。验证记录见 [重构验证](docs/REFACTOR.md)。

组件卸载或热更新会取消动画、事件订阅和定时器，释放观察器、图片 URL 与 GPU 资源。

## 手机上使用

手机与电脑连接同一局域网。HTTP 只能用于页面及手动预览；iPhone 体感需要可信 HTTPS 和用户点击授权。

先 `npm run build`，再用 Python 3 为构建产物提供 HTTPS：

```sh
python3 scripts/serve.py --host 0.0.0.0 --port 8443 --cert /path/to/server.pem --key /path/to/server.key
```

使用 `https://电脑局域网IP:8443/`。证书必须包含该 IP 的 SAN，签发 CA 必须在手机上被信任；也可将 `dist/` 部署到有可信 HTTPS 的静态托管服务。不要关闭证书验证来替代正确配置。

Safari 分享 → 添加到主屏幕 → 从图标打开 → 开启体感 → 保持姿势约一秒校准 → 沉浸体验。轻点画面显示退出与校准按钮。电脑休眠、服务退出、网络变化都会影响重新加载；本项目没有离线缓存或开机自启。

## 功能

- 本地截图导入，体感与手动体验，稳定姿势校准。
- 渐进距离模糊、椭圆散射、线性光混合与同步模糊的边缘。
- 11 项参数，所有默认值均显示 50%，自动保存在浏览器本地。
- 一键恢复默认；沉浸布局与屏幕适配诊断。

## 开发与交接

- [完整交接说明](docs/HANDOFF.md)：架构、公式、参数、历史经验、回归清单与下一步。
- [贡献说明](CONTRIBUTING.md)

原型源码已保存在 Git 首次提交 `4fb5729`，可用于对比或回退。重构不更改着色器、校准数学、参数默认、页面文案或 CSS 覆盖顺序。

## 隐私与发布状态

应用没有截图上传请求、分析 SDK 或外部运行依赖。图片仅在浏览器内处理；参数保存在 localStorage，刷新后截图需要重新选择。Web 服务仍会产生常规访问日志。

仓库未包含开发机证书、私钥、用户截图、IP 配置、托管账户配置、历史压缩包或外部 Git 历史。

**许可证尚未选定。** 这是供仓库所有者整理发布的源码交接包；正式宣称开源前，请选择适用许可证、填写著作权归属并添加 LICENSE。当前不替所有者授予许可证。发布截图、录屏或替换素材时请核对其使用权。
