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
  elapsedTime: string;
  isPaused: boolean;
  onPauseToggle: () => void;
}

const ColorStatusBar: React.FC<ColorStatusBarProps> = ({
  currentColor,
  colorInfo,
  progressPercentage,
  elapsedTime,
  isPaused,
  onPauseToggle,
}) => {
  if (!colorInfo) {
    return (
      <div className="focus-status-bar border-b border-[rgba(var(--line-rgb),0.16)] bg-[rgba(var(--panel-rgb),0.7)] px-4 py-2 backdrop-blur-xl">
        <div className="text-xs text-[var(--muted)]">请选择颜色</div>
      </div>
    );
  }

  return (
    <div className="focus-status-bar border-b border-[rgba(var(--line-rgb),0.16)] bg-[rgba(var(--panel-rgb),0.72)] px-3 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="focus-current-bead h-9 w-9 flex-shrink-0 rounded-full border border-black/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_10px_24px_rgba(var(--shadow-rgb),0.12)]"
            style={{ backgroundColor: currentColor }}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-[rgba(var(--line-rgb),0.16)] bg-white/52 px-2 py-1 text-sm font-bold text-[var(--text)]">
                {colorInfo.name}
              </div>
              <div className="text-sm font-semibold tabular-nums text-[var(--text)]">
                {colorInfo.completed}/{colorInfo.total}
              </div>
              <div className="text-sm font-black tabular-nums text-[rgb(var(--accent-rgb))]">
                {progressPercentage}%
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onPauseToggle}
          className={`focus-timer-button glass-action flex min-h-[40px] items-center gap-2 px-3 text-xs font-semibold tabular-nums ${isPaused ? 'glass-action-active' : ''}`}
          aria-label={isPaused ? '继续计时' : '暂停计时'}
        >
          {isPaused ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.75 4.7v10.6l8-5.3-8-5.3z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6 4h3v12H6V4zm5 0h3v12h-3V4z" />
            </svg>
          )}
          <span>{elapsedTime}</span>
        </button>
      </div>
    </div>
  );
};

export default ColorStatusBar;
