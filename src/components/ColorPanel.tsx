import React, { useState } from 'react';

interface ColorInfo {
  color: string;
  name: string;
  total: number;
  completed: number;
}

interface ColorPanelProps {
  colors: ColorInfo[];
  currentColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
}

const ColorPanel: React.FC<ColorPanelProps> = ({
  colors,
  currentColor,
  onColorSelect,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'name' | 'total'>('progress');

  // 过滤和排序颜色
  const filteredAndSortedColors = colors
    .filter(color => 
      color.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      color.color.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          const progressA = (a.completed / a.total) * 100;
          const progressB = (b.completed / b.total) * 100;
          return progressA - progressB; // 进度低的在前
        case 'name':
          return a.name.localeCompare(b.name);
        case 'total':
          return b.total - a.total; // 数量多的在前
        default:
          return 0;
      }
    });

  return (
    <div className="palette-backdrop fixed inset-0 z-50 flex items-end bg-black/42 p-3 backdrop-blur-md sm:items-center sm:justify-center">
      <div className="focus-drawer settings-shell flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px]">
        {/* 拖拽指示条 */}
        <div className="settings-head flex items-center justify-between border-b border-[rgba(var(--line-rgb),0.14)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">颜色进度</h2>
            <p className="text-[11px] text-[var(--muted)]">按色号切换当前拼豆颜色</p>
          </div>
          <button
            onClick={onClose}
            className="glass-action grid min-h-[40px] min-w-[40px] place-items-center"
            aria-label="关闭颜色面板"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 pb-3 pt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索颜色..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-[rgba(var(--line-rgb),0.22)] bg-white/64 py-2.5 pl-10 pr-4 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.55)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.12)]"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 排序选项 */}
        <div className="px-4 pb-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'progress' | 'name' | 'total')}
            className="w-full rounded-xl border border-[rgba(var(--line-rgb),0.22)] bg-white/64 p-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.55)]"
          >
            <option value="progress">按进度排序</option>
            <option value="name">按名称排序</option>
            <option value="total">按数量排序</option>
          </select>
        </div>

        {/* 颜色列表 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredAndSortedColors.map((colorInfo, index) => {
            const progressPercentage = Math.round((colorInfo.completed / colorInfo.total) * 100);
            const isSelected = colorInfo.color === currentColor;
            const isCompleted = progressPercentage === 100;

            return (
              <button
                key={colorInfo.color}
                onClick={() => onColorSelect(colorInfo.color)}
                className={`focus-color-row mb-2 w-full rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.12)] shadow-[0_16px_28px_rgba(var(--shadow-rgb),0.12)]'
                    : 'border-[rgba(var(--line-rgb),0.14)] bg-white/48 hover:border-[rgba(var(--accent-rgb),0.34)] hover:bg-white/68'
                } ${isCompleted ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${Math.min(index * 16, 260)}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-10 w-10 flex-shrink-0 rounded-xl border border-black/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                      style={{ backgroundColor: colorInfo.color }}
                    />
                    <div className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">
                        {colorInfo.name}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {colorInfo.completed}/{colorInfo.total} ({progressPercentage}%)
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <div className="text-[rgb(var(--accent-rgb))]">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {isSelected && (
                      <div className="text-[rgb(var(--accent-rgb))]">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(var(--line-rgb),0.14)]">
                  <div 
                    className="focus-progress-fill h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--accent-rgb)),rgb(var(--accent-2-rgb)))]"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* 关闭按钮 */}
        <div className="border-t border-[rgba(var(--line-rgb),0.14)] p-4">
          <button
            onClick={onClose}
            className="glass-action w-full px-4 py-2.5 text-sm font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorPanel;
