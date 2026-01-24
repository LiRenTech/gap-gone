# Gap Gone ✂️🔇

**Gap Gone** 是一个超轻量级的本地音频剪辑工具，专为去除长录音中的静音片段而生。基于 **Tauri** 和 **React** 构建，拥有极致的性能和现代化的交互体验。

![App Screenshot](./screenshot.png) <!-- 你可以在稍后截图放入 -->

## ✨ 核心特性

- **🚀 本地极速处理**: 所有处理均在本地完成，无需上传文件，隐私绝对安全。
- **🌊 多行波形乐谱**: 独特的“乐谱式”波形布局，长音频一目了然，无需频繁横向滚动。
- **🤖 一键智能去静音**: 内置 RMSE 算法，一键识别并标记所有静音片段（支持自定义阈值）。
- **🛡️ 非破坏性编辑**: 智能识别仅标记“删除区域”，原文件不受影响。
- **🖱️ 高效交互**:
  - **右键拖拽**: 标记/添加删除区域。
  - **中键拖拽**: 擦除/恢复删除区域。
  - **空格键**: 播放/暂停。
- **💾 无损导出**: 自动拼接保留片段，导出高音质 WAV 文件。

## 🛠️ 技术栈

- **Core**: [Tauri v2](https://tauri.app) (Rust)
- **Frontend**: React + TypeScript + Vite
- **Audio Processing**: Web Audio API (Canvas 渲染 + AudioBuffer 处理)

## 📦 安装与运行

确保你已经安装了 [Rust](https://www.rust-lang.org/tools/install) 和 [Node.js](https://nodejs.org)。

1.  **克隆项目**

    ```bash
    git clone https://github.com/your-username/gap-gone.git
    cd gap-gone
    ```

2.  **安装依赖**

    ```bash
    pnpm install
    # 或者 npm install / yarn install
    ```

3.  **启动开发模式**

    ```bash
    pnpm tauri dev
    ```

4.  **构建应用**
    ```bash
    pnpm tauri build
    ```

## 🎮 使用指南

1.  点击左上角的 **“打开”** 按钮（或直接查看），选择你的音频文件。
2.  点击 **“一键去静音”**，程序会自动分析并用灰色覆盖静音部分。
3.  如果自动识别有误，使用 **右键** 补充删除，或 **中键** 恢复误删片段。
4.  满意后点击 **“导出”**，保存处理后的音频文件。

## 📄 License

[MIT](./LICENSE)
