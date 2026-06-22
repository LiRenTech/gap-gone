interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div
        className="help-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-modal-header">
          <h2 id="help-modal-title" className="help-modal-title">
            使用帮助
          </h2>
          <button className="help-modal-close" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="help-modal-body">
          <h3>快速上手</h3>
          <ul>
            <li>
              点击右上角<span className="help-modal-kbd">打开</span>选择音频文件
            </li>
            <li>
              按<span className="help-modal-kbd">空格</span>或点击
              <span className="help-modal-kbd">播放/暂停</span>控制播放
            </li>
            <li>
              需要删除的片段用<span className="help-modal-kbd">右键拖拽</span>标记；
              需要恢复的片段用<span className="help-modal-kbd">中键拖拽</span>取消标记
            </li>
            <li>
              标记完成后点击<span className="help-modal-kbd">导出</span>得到处理后的音频
            </li>
          </ul>

          <h3>鼠标操作（波形区域）</h3>
          <ul>
            <li>
              <span className="help-modal-kbd">左键单击</span>：跳转到点击位置开始播放
            </li>
            <li>
              <span className="help-modal-kbd">右键按住拖拽</span>：添加/合并“需要删除”的区间
            </li>
            <li>
              <span className="help-modal-kbd">中键按住拖拽</span>：从已标记区间中移除（恢复音频）
            </li>
          </ul>

          <h3>快捷键</h3>
          <ul>
            <li>
              <span className="help-modal-kbd">空格</span>：播放 / 暂停
            </li>
            <li>
              <span className="help-modal-kbd">H</span> 或{" "}
              <span className="help-modal-kbd">?</span>：打开帮助
            </li>
            <li>
              <span className="help-modal-kbd">Esc</span>：关闭帮助
            </li>
          </ul>

          <h3>一键去静音</h3>
          <ul>
            <li>
              点击<span className="help-modal-kbd">一键去静音</span>
              会自动检测静音片段并标记为“需要删除”
            </li>
            <li>你仍可以用右键/中键拖拽手动微调标记范围</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

