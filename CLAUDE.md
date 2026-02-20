# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 **uni-app 3.x** 框架的跨平台应用项目，使用 Vue 3 + Vite + TypeScript 构建。uni-app 3.x 采用 Composition API 和现代化的 Vite 构建工具，相比 2.x 版本有显著架构差异。

## 核心架构

### 技术栈
- **框架**: uni-app 3.0 (基于 Vue 3.4+)
- **构建工具**: Vite 5.x (取代 Vue CLI)
- **语言**: TypeScript 4.9+
- **国际化**: vue-i18n 9.x
- **包管理器**: pnpm

### 关键架构特征
1. **SSR 支持**: 使用 `createSSRApp` 创建应用实例（支持服务端渲染和小程序环境）
2. **Vite 驱动**: 快速冷启动、即时 HMR、按需编译
3. **Composition API**: 推荐使用 `<script setup>` 语法（不再使用 Vue 2 的 Options API 和装饰器）
4. **模块化构建**: 针对不同平台使用独立的 `@dcloudio/uni-mp-*` 包

### 目录结构要点
- `src/main.ts`: 应用入口，导出 `createApp` 工厂函数（SSR 友好）
- `src/App.vue`: 根组件，应用级生命周期
- `src/pages.json`: 页面路由配置（数组第一项为启动页）
- `src/manifest.json`: 应用配置和平台特定设置
- `src/uni.scss`: 全局样式变量（uni-app 内置变量 + 自定义变量）
- `src/static/`: 静态资源目录（图片等，不经过编译）
- `vite.config.ts`: Vite 配置文件

### uni-app 3.x 核心概念
1. **条件编译**: 使用 `#ifdef` / `#ifndef` 实现跨平台差异化
   ```vue
   <!-- #ifdef MP-WEIXIN -->
   <view>仅微信小程序显示</view>
   <!-- #endif -->
   ```

2. **响应式单位 rpx**: 750rpx = 屏幕宽度（自动适配）

3. **页面配置**: 在 `pages.json` 中声明页面路径和样式，无需手动导入

4. **生命周期**: Vue 3 生命周期 + uni-app 页面生命周期（onLoad、onShow、onHide 等）

5. **API 调用**: 使用 `uni.*` 命名空间（如 `uni.request`、`uni.navigateTo`）

## 常用命令

### 开发模式
```bash
# H5 开发（浏览器预览）
pnpm run dev:h5

# H5 SSR 开发
pnpm run dev:h5:ssr

# 微信小程序开发（输出到 dist/dev/mp-weixin）
pnpm run dev:mp-weixin

# 支付宝小程序
pnpm run dev:mp-alipay

# 其他小程序平台
pnpm run dev:mp-[platform]  # platform: baidu, qq, toutiao, jd, kuaishou, lark, xhs

# 鸿蒙小程序
pnpm run dev:mp-harmony

# 快应用
pnpm run dev:quickapp-webview
pnpm run dev:quickapp-webview-huawei
pnpm run dev:quickapp-webview-union

# 自定义平台
pnpm run dev:custom
```

### 生产构建
```bash
# H5 生产构建
pnpm run build:h5

# H5 SSR 构建
pnpm run build:h5:ssr

# 微信小程序生产构建
pnpm run build:mp-weixin

# 其他平台构建
pnpm run build:mp-[platform]
pnpm run build:quickapp-webview
```

### 类型检查
```bash
# TypeScript 类型检查（不生成文件）
pnpm run type-check
```

## 开发注意事项

### Vue 3 + uni-app 3 特性
1. **推荐使用 Composition API**:
   ```vue
   <script setup lang="ts">
   import { ref, onMounted } from 'vue'
   import { onLoad, onShow } from '@dcloudio/uni-app'

   const count = ref(0)

   onLoad((options) => {
     console.log('页面加载', options)
   })
   </script>
   ```

2. **TypeScript 支持**:
   - 路径别名 `@/` 指向 `src/`
   - 使用 `@dcloudio/types` 获取 uni-app API 类型
   - 类型定义文件: `src/env.d.ts`、`src/shime-uni.d.ts`

3. **新增页面流程**:
   - 在 `src/pages/` 创建页面组件（如 `pages/user/profile.vue`）
   - 在 `src/pages.json` 的 `pages` 数组添加路径（无需 `.vue` 后缀）:
     ```json
     {
       "path": "pages/user/profile",
       "style": { "navigationBarTitleText": "个人资料" }
     }
     ```

4. **平台差异处理**:
   - 优先使用 uni-app 统一 API
   - 需要平台特定逻辑时使用条件编译
   - TypeScript 中的条件编译:
     ```ts
     // #ifdef MP-WEIXIN
     uni.login({ provider: 'weixin' })
     // #endif
     ```

5. **Vite 特性**:
   - 使用 ES Modules（`import`/`export`）
   - 支持 `import.meta.env` 环境变量
   - 快速 HMR（热模块替换）

### 构建产物位置
- **开发模式**: `dist/dev/[platform]/`
- **生产模式**: `dist/build/[platform]/`
- **H5**: 直接在浏览器运行
- **小程序**: 使用对应开发者工具导入 dist 目录

### 性能优化建议
1. 使用 `<script setup>` 减少运行时开销
2. 合理使用 `ref`/`reactive`，避免过度响应式
3. 大列表使用虚拟滚动（`<recycle-list>` 或第三方组件）
4. 静态资源放在 `static/` 目录，避免 Vite 处理

## 当前配置状态
- **Vue 版本**: 3 (manifest.json 中声明)
- **已配置平台**: 微信小程序 (appid: wxf8b430a33b7a1800)
- **默认开发目标**: H5
- **uni 统计**: 已禁用 (uniStatistics.enable: false)
