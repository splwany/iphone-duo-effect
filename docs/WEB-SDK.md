# Web 效果模块接入

独立入口为 `src/sdk/index.ts`。不依赖 React、演示页面元素、localStorage 或设备权限。现有网页也通过该入口调用，避免示例与公共接口各维护一套效果实现。

## 最小接入

```ts
import { createFoldEffect } from './src/sdk';

// 容器由宿主设置 position: relative，以及非零宽高。
const effect = createFoldEffect(container, {
  parameters: { blurStrength: 0.1, horizontalStretch: 0.9 },
});
if (!effect.supported) {
  // 宿主可显示静态图片或提示。模块不会替换宿主界面。
}

const image = new Image();
image.src = '/screenshot.png';
await image.decode();
effect.setImage(image);
effect.setAngle(45);

// 页面/组件卸载时释放。
effect.dispose();
```

`setImage` 接受已解码的 `HTMLImageElement` 或有尺寸的 `HTMLCanvasElement`，按容器比例居中裁切。图片会先转成明确像素的 Canvas，以保留 Safari 首屏修复。跨域图片需由宿主配置 CORS；模块不会自动下载图片。当前面向静态图；修改源 Canvas 后需要再次调用 `setImage` 上传像素。

运行 `npm run dev` 后打开 `/examples/basic.html`，可体验不依赖 React 的完整接入示例。

## 输入约定

| 方法 | 输入 | 含义 |
| --- | --- | --- |
| `setProgress(value)` | −1～1 | 0 为平面；负数向左，正数向右；绝对值越大效果越强 |
| `setAngle(degrees)` | −90°～90° | 效果角度，等于 `progress × 90` |
| `createHingeMapper(config)` | 宿主提供的铰链读数 | 返回从传感器角度到效果进度的映射函数 |

有限但超界的输入会截断；NaN、Infinity 会抛出异常。`setProgress` 和 `setAngle` 默认经过 `followSmooth` 平滑。传 `{ immediate: true }` 可立刻更新并绘制，适合外部已经处理过动画的输入。

### 铰链读数

```ts
import { createHingeMapper } from './src/sdk';

const mapHinge = createHingeMapper({
  flatAngle: 180,   // 此传感器读数对应清晰、平面的效果
  foldedAngle: 0,  // 此读数对应最大效果，可改为 90 等值
  direction: 1,    // 1 向右，-1 向左
});

function onHingeAngle(angle: number) {
  effect.setProgress(mapHinge(angle));
}
```

默认映射为 `180° → 0`、`90° → 0.5`、`0° → 1`。两端可以反向配置，但不能相等。这里提供的是读数转换接口，**不负责读取设备铰链传感器**。宿主从设备接口或 App 桥接拿到角度后，调用上述函数即可。

### 重力数据

```ts
import { GravityInput } from './src/sdk';

const gravity = new GravityInput();
gravity.calibrate();
function onMotion(event: DeviceMotionEvent) {
  const reading = gravity.update(event, performance.now(), screen.orientation?.angle ?? 0);
  if (reading?.progress !== undefined) effect.setProgress(reading.progress);
  // reading.calibrated / reading.edge 可用于宿主校准提示。
}
```

`GravityInput` 保留原有重力分离、屏幕方向变换与稳定校准算法。宿主负责权限申请、事件注册、启停与横竖屏变化后的重新校准；模块不会自行弹权限框。

### 输入订阅

```ts
const disconnect = effect.connectInput((setProgress) => {
  // subscribeHinge 是宿主提供的订阅函数，返回取消订阅函数。
  return subscribeHinge((angle) => setProgress(mapHinge(angle)));
});
```

连接新输入会取消旧输入；旧回调的迟到事件会被忽略。`disconnect()` 和 `dispose()` 都会清理订阅。直接调用 `setAngle` / `setProgress` 不会取消已连接输入，多个写入按调用顺序覆盖；需要切换到手动控制时先调用 `disconnect()`。

## 参数与默认配置

`src/sdk/defaults.json` 是项目默认配置，修改后重新构建生效。参数范围及原有滑杆中点定义在 `src/sdk/parameters.ts`，与可修改的默认值分离。

外部项目也可以维护自己的 JSON：

```ts
import config from './fold.config.json';
const effect = createFoldEffect(container, { parameters: config });

effect.setParameters({ blurStrength: 0.15, edgeSoftness: 4 });
console.log(effect.parameters); // 只读快照
effect.resetParameters();       // 恢复该实例创建时的配置
```

初始化优先级：内置默认值 → 构造参数覆盖。运行时 `setParameters` 仅更新传入字段。SDK 不读写本地存储；演示页才会在默认值之上应用用户保存的滑杆设置，一键恢复回到配置默认值。

**接口使用算法值，不是页面上的 0～100%。** 页面滑杆的映射保留原有中点和范围，不会因默认配置变化而改变。标签显示可能取整，渲染使用实际配置值。

| 字段 | 含义 | 默认值 | 范围 |
| --- | --- | --- | --- |
| `blurStrength` | 模糊强度 | 0.1 | 0～0.2 |
| `horizontalStretch` | 横向拉伸 | 0.9 | 0～1 |
| `farShrink` | 远端内缩 | 0.13 | 0～0.26 |
| `blurCurve` | 模糊加速 | 2 | 1～3 |
| `scatterFocus` | 散射集中度 | 2 | 0～24 |
| `scatterX` | 横向散射 | 2 | 0～4 |
| `scatterY` | 纵向散射 | 1 | 0～2 |
| `grazingRange` | 大角度扩散 | 0.5 | 0.25～0.75 |
| `edgeSoftness` | 边缘柔化 | 1 | 0～12 |
| `blurBlend` | 细节融合 | 0.7 | 0～4 |
| `followSmooth` | 平滑时间，毫秒 | 35 | 10～250 |

参数更新先整体校验再应用。未知字段、字符串或非有限数字抛出 `TypeError`，不会只更新一半；有限数值超界则截断到有效范围。

## 生命周期与集成边界

- 默认自动运行帧循环；`stop()` 暂停动画，`start()` 恢复，不会重复注册循环。暂停不会取消输入订阅。
- 设置 `autoStart: false` 后可由宿主逐帧调用 `render(time)`，时间单位为毫秒，使用单调递增的时间戳。不要同时使用两个帧循环。
- `state` 提供当前进度、目标进度和当前效果角度；`subscribe(listener)` 订阅绘制状态，返回退订函数。监听回调应保持轻量，宿主负责处理自己的回调异常。
- 容器尺寸变化自动重绘，也可调用 `resize()`。每个实例使用独立 Canvas、WebGL 上下文、参数与输入订阅。
- `dispose()` 可重复调用，释放帧循环、输入订阅、尺寸观察器、GPU 资源与 Canvas。释放后不能再次修改或启动实例。
- WebGL 上下文恢复时只重建本实例资源，不刷新宿主页面。需要 WebGL 2；不支持时 `supported` 为 false，宿主决定降级界面。
- 页面沉浸模式、上传控件、存储、React 组件均属于示例应用，不包含在模块中。

## 构建与验证

```sh
npm run build:sdk       # dist-sdk/index.js + index.d.ts 等类型声明
npm test               # 参数、输入映射、校准、平滑、图片回归
npm run test:sdk        # 8765 开发服务 + Chrome：接口集成回归
npm run test:parameters # 渲染参数与动态响应回归
npm run test:browser    # 原演示页面交互回归
```

构建结果为无 React 依赖的 ES 模块。其他项目可复制完整 `dist-sdk` 目录，JavaScript 导入 `index.js`，TypeScript 用 `index.d.ts` 作为类型入口。这是仓库内的可复用模块，尚未发布 npm 包。

重构期间保留着色器公式、原有参数默认值与重力校准数学。相同 Chrome 环境下，重构前后默认参数图像像素差为 0；角度输入与对应铰链映射的输出也逐像素一致。这不代表已经验证真实折叠屏硬件。
