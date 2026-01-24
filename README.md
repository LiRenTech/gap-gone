# Tauri + React + TypeScript

这是一个使用 Tauri、React 和 TypeScript 构建的桌面应用项目。

## 开发环境要求

- [Node.js](https://nodejs.org/) (推荐 v18+)
- [Rust](https://www.rust-lang.org/) (推荐最新稳定版)
- [Tauri CLI](https://tauri.app/)

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

## 项目结构

```
├── src/                  # React 前端代码
│   ├── App.tsx          # 主应用组件
│   ├── main.tsx         # React 入口
│   └── assets/          # 静态资源
├── src-tauri/           # Rust 后端代码
│   ├── src/             # Rust 源代码
│   └── Cargo.toml       # Rust 依赖配置
├── public/              # 公共静态资源
├── package.json         # npm 配置
└── vite.config.ts       # Vite 配置
```

## 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
