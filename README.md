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
npm run build:sdk     # 构建独立 Web 效果模块和类型声明
npm run test:sdk      # 独立接口浏览器回归（开发服务 + Chrome）
npm run typecheck     # 严格 TypeScript 检查
npm run build         # 类型检查并构建 dist/
npm run preview       # 本地预览构建结果
npm run format:check  # 格式检查
npm run test:browser  # 已启动服务且安装 Chrome 后进行浏览器回归
npm run test:parameters # 开发服务 8765 + Chrome：逐项参数和动态响应验证
```

## 工程结构

- `src/components/`：预览、参数滑块和操作面板 React 组件。
- `src/sdk/`：不依赖 React 的公共效果模块，包含输入映射、平滑状态、参数与 WebGL 渲染。
- `src/sdk/index.ts`：外部接入入口；`defaults.json`：11 项参数的默认配置。
- `src/config/effects.ts`：演示页标签、滑杆百分比和旧存储迁移。
- `src/engine/experience.ts`：组合演示页面的体感权限、导图和交互。
- `src/engine/effectControls.ts`：参数控件与偏好存储。
- `src/engine/immersive.ts`：Safari 沉浸布局与退出恢复。
- `src/styles/style.css`：保留原版规则及覆盖顺序，避免布局变化。
- `public/`：示例、图标和主屏幕 manifest。
- `tests/`：自动化回归。

React 管理页面结构；每帧绘制及已验证的 Safari 沉浸节点移动由独立控制器管理。
浏览器回归默认访问 8765 端口；可通过 `APP_URL` 指定预览服务，通过 `BASELINE_URL` 指定原版服务以启用逐像素对比。验证记录见 [重构验证](docs/REFACTOR.md)。

组件卸载或热更新会取消动画、事件订阅和定时器，释放观察器、图片 URL 与 GPU 资源。

## 独立 Web 接入

效果支持通用进度、效果角度和可配置的铰链角度映射；重力感应是一种可选输入适配器。所有参数可通过构造配置、JSON 默认配置及运行时方法修改。

详见 [Web 模块接口与示例](docs/WEB-SDK.md)。启动开发服务后访问 `/examples/basic.html` 可运行独立接入示例。

## GitHub Pages 部署

仓库使用 `.github/workflows/deploy.yml` 自动测试、构建并部署 `main` 分支。
首次需在 GitHub 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。
成功部署后的目标地址为 `https://splwany.github.io/iphone-duo-effect/`。

Pages 构建使用 `/iphone-duo-effect/` 路径前缀，本地开发仍使用根路径。
图标、示例、样式和 manifest 均跟随构建路径；仓库改名时同步修改 workflow 的 `--base`。
每次推送 `main` 自动更新，也可在 Actions 手动运行部署。

手机用 Safari 打开 HTTPS 地址，点“开启体感”并允许动作与方向访问，握稳约 1 秒后体验。
可通过“分享 → 添加到主屏幕”进入独立应用模式。截图仍仅在手机内处理。

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

- [参数优化记录](docs/PARAMETERS.md)：有效范围、旧设置迁移与视觉验证。

- [完整交接说明](docs/HANDOFF.md)：架构、公式、参数、历史经验、回归清单与下一步。
- [贡献说明](CONTRIBUTING.md)

原型源码已保存在 Git 首次提交 `4fb5729`，可用于对比或回退。重构不更改着色器、校准数学、参数默认、页面文案或 CSS 覆盖顺序。

## 隐私与发布状态

应用没有截图上传请求、分析 SDK 或外部运行依赖。图片仅在浏览器内处理；参数保存在 localStorage，刷新后截图需要重新选择。Web 服务仍会产生常规访问日志。

仓库未包含开发机证书、私钥、用户截图、IP 配置、托管账户配置、历史压缩包或外部 Git 历史。

**许可证尚未选定。** 这是供仓库所有者整理发布的源码交接包；正式宣称开源前，请选择适用许可证、填写著作权归属并添加 LICENSE。当前不替所有者授予许可证。发布截图、录屏或替换素材时请核对其使用权。
