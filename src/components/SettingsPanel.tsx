import React from 'react';

interface SettingsPanelProps {
  guidanceMode: 'nearest' | 'largest' | 'edge-first';
  onGuidanceModeChange: (mode: 'nearest' | 'largest' | 'edge-first') => void;
  gridSectionInterval: number;
  onGridSectionIntervalChange: (interval: number) => void;
  showSectionLines: boolean;
  onShowSectionLinesChange: (show: boolean) => void;
  sectionLineColor: string;
  onSectionLineColorChange: (color: string) => void;
  enableCelebration: boolean;
  onEnableCelebrationChange: (enable: boolean) => void;
  onExportProgress: () => void;
  onResetProgress: () => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  guidanceMode,
  onGuidanceModeChange,
  gridSectionInterval,
  onGridSectionIntervalChange,
  showSectionLines,
  onShowSectionLinesChange,
  sectionLineColor,
  onSectionLineColorChange,
  enableCelebration,
  onEnableCelebrationChange,
  onExportProgress,
  onResetProgress,
  onClose
}) => {
  // 分割线颜色选项
  const sectionLineColors = [
    { color: '#007acc', name: '蓝色' },
    { color: '#28a745', name: '绿色' },
    { color: '#dc3545', name: '红色' },
    { color: '#6f42c1', name: '紫色' },
    { color: '#fd7e14', name: '橙色' },
    { color: '#6c757d', name: '灰色' }
  ];
  return (
    <div className="palette-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/42 p-3 backdrop-blur-md">
      <div className="focus-modal settings-shell flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[22px]">
        {/* 头部 */}
        <div className="settings-head flex items-center justify-between border-b border-[rgba(var(--line-rgb),0.14)] p-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">拼豆设置</h2>
            <p className="text-[11px] text-[var(--muted)]">引导、分割线和进度管理</p>
          </div>
          <button
            onClick={onClose}
            className="glass-action grid min-h-[40px] min-w-[40px] place-items-center"
            aria-label="关闭设置"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 设置内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 引导设置 */}
          <div className="focus-panel-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">智能引导</h3>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center rounded-xl border border-[rgba(var(--line-rgb),0.12)] bg-white/42 p-3 transition hover:bg-white/66">
                <input
                  type="radio"
                  name="guidanceMode"
                  value="nearest"
                  checked={guidanceMode === 'nearest'}
                  onChange={(e) => onGuidanceModeChange(e.target.value as 'nearest')}
                  className="mr-3 accent-[rgb(var(--accent-rgb))]"
                />
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">最近优先</div>
                  <div className="text-xs text-[var(--muted)]">推荐距离最近的格子</div>
                </div>
              </label>

              <label className="flex cursor-pointer items-center rounded-xl border border-[rgba(var(--line-rgb),0.12)] bg-white/42 p-3 transition hover:bg-white/66">
                <input
                  type="radio"
                  name="guidanceMode"
                  value="largest"
                  checked={guidanceMode === 'largest'}
                  onChange={(e) => onGuidanceModeChange(e.target.value as 'largest')}
                  className="mr-3 accent-[rgb(var(--accent-rgb))]"
                />
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">大块优先</div>
                  <div className="text-xs text-[var(--muted)]">优先推荐大色块区域</div>
                </div>
              </label>

              <label className="flex cursor-pointer items-center rounded-xl border border-[rgba(var(--line-rgb),0.12)] bg-white/42 p-3 transition hover:bg-white/66">
                <input
                  type="radio"
                  name="guidanceMode"
                  value="edge-first"
                  checked={guidanceMode === 'edge-first'}
                  onChange={(e) => onGuidanceModeChange(e.target.value as 'edge-first')}
                  className="mr-3 accent-[rgb(var(--accent-rgb))]"
                />
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">边缘优先</div>
                  <div className="text-xs text-[var(--muted)]">先完成边缘，再填充内部</div>
                </div>
              </label>
            </div>
          </div>

          {/* 显示设置 */}
          <div className="focus-panel-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">显示设置</h3>
            <div className="space-y-4">
              {/* 分割线开关 */}
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[rgba(var(--line-rgb),0.12)] bg-white/42 p-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">显示分割线</div>
                  <div className="text-xs text-[var(--muted)]">将画布分割成区块帮助定位</div>
                </div>
                <input
                  type="checkbox"
                  checked={showSectionLines}
                  onChange={(e) => onShowSectionLinesChange(e.target.checked)}
                  className="h-4 w-4 rounded accent-[rgb(var(--accent-rgb))]"
                />
              </label>

              {/* 只有开启分割线时才显示后续选项 */}
              {showSectionLines && (
                <>
                  {/* 分割线间隔 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                      分割间隔
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="20"
                        value={gridSectionInterval}
                        onChange={(e) => onGridSectionIntervalChange(parseInt(e.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[rgba(var(--line-rgb),0.16)] accent-[rgb(var(--accent-rgb))]"
                      />
                      <span className="min-w-[3rem] text-sm font-semibold text-[var(--text)]">
                        {gridSectionInterval} 格
                      </span>
                    </div>
                  </div>

                  {/* 分割线颜色 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                      分割线颜色
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {sectionLineColors.map((colorOption) => (
                        <button
                          key={colorOption.color}
                          onClick={() => onSectionLineColorChange(colorOption.color)}
                          className={`h-7 w-7 rounded-lg border-2 transition-all ${
                            sectionLineColor === colorOption.color
                              ? 'scale-110 border-[rgb(var(--accent-rgb))]'
                              : 'border-black/15 hover:border-black/40'
                          }`}
                          style={{ backgroundColor: colorOption.color }}
                          title={colorOption.name}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 庆祝动画开关 */}
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[rgba(var(--line-rgb),0.12)] bg-white/42 p-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">庆祝动画</div>
                  <div className="text-xs text-[var(--muted)]">完成颜色时显示粒子效果</div>
                </div>
                <input
                  type="checkbox"
                  checked={enableCelebration}
                  onChange={(e) => onEnableCelebrationChange(e.target.checked)}
                  className="h-4 w-4 rounded accent-[rgb(var(--accent-rgb))]"
                />
              </label>
            </div>
          </div>



          {/* 进度重置 */}
          <div className="focus-panel-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">数据管理</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={onExportProgress} className="glass-action px-4 py-2 text-sm font-medium">
                导出进度数据
              </button>
              
              <button onClick={onResetProgress} className="glass-action px-4 py-2 text-sm font-medium text-red-700">
                重置所有进度
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
