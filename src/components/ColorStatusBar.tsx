import React from 'react';

interface ColorStatusBarProps {
  currentColor: string;
  colorInfo?: {
    color: string;
    name: string;
    total: number;
    completed: number;
  };
  progressPercentage: number;
}

const ColorStatusBar: React.FC<ColorStatusBarProps> = ({
  currentColor,
  colorInfo,
  progressPercentage
}) => {
  if (!colorInfo) {
    return (
      <div className="border-b border-[rgba(var(--line-rgb),0.16)] bg-[rgba(var(--panel-rgb),0.58)] px-4 py-2 backdrop-blur-xl">
        <div className="text-xs text-[var(--muted)]">请选择颜色</div>
      </div>
    );
  }

  const estimatedTime = Math.ceil((colorInfo.total - colorInfo.completed) * 0.1); // 假设每个格子0.5分钟

  return (
    <div className="border-b border-[rgba(var(--line-rgb),0.16)] bg-[rgba(var(--panel-rgb),0.58)] px-3 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="h-9 w-9 flex-shrink-0 rounded-xl border border-black/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_10px_24px_rgba(var(--shadow-rgb),0.12)]"
          style={{ backgroundColor: currentColor }}
        />
        <div className="rounded-lg border border-[rgba(var(--line-rgb),0.16)] bg-white/46 px-2 py-1 text-sm font-bold text-[var(--text)]">
          {colorInfo.name}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="text-sm font-semibold text-[var(--text)]">
            {colorInfo.completed}/{colorInfo.total}
          </div>
          <div className="truncate text-xs text-[var(--muted)]">
            预计还需 {estimatedTime}分钟
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-xl font-black tabular-nums text-[rgb(var(--accent-rgb))]">
          {progressPercentage}%
        </div>
      </div>
      </div>
    </div>
  );
};

export default ColorStatusBar;
