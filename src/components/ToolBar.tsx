import React from 'react';

interface ToolBarProps {
  onColorSelect: () => void;
  onLocate: () => void;
  onPause: () => void;
  isPaused: boolean;
  elapsedTime: string;
}

const ToolBar: React.FC<ToolBarProps> = ({
  onColorSelect,
  onLocate,
  onPause,
  isPaused,
  elapsedTime,
}) => {
  return (
    <div className="focus-toolbar mt-2 rounded-xl border border-[rgba(var(--line-rgb),0.16)] bg-white/42 px-2 py-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onColorSelect}
          className="glass-action flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-3 text-[var(--text)]"
          aria-label="选择颜色"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.76l4.9-4.9a2 2 0 000-2.83L13.49 5.1a2 2 0 00-2.83 0L10 5.76v8.48zM16 18H9.07l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">颜色</span>
        </button>

        <button
          type="button"
          onClick={onLocate}
          className="glass-action flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-3 text-[var(--text)]"
          aria-label="定位推荐区域"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M2 12h4m12 0h4m-4.95-7.05l-2.83 2.83M7.78 14.22l-2.83 2.83m0-12.1l2.83 2.83m6.44 6.44l2.83 2.83" />
            <circle cx="12" cy="12" r="4" strokeWidth={2} />
          </svg>
          <span className="text-xs">定位</span>
        </button>

        <button
          type="button"
          onClick={onPause}
          className={`glass-action flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-3 ${isPaused ? 'glass-action-active' : ''}`}
          aria-label={isPaused ? '继续计时' : '暂停计时'}
        >
          {isPaused ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.75 4.7v10.6l8-5.3-8-5.3z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4h3v12H6V4zm5 0h3v12h-3V4z" />
            </svg>
          )}
          <span className="text-xs font-semibold tabular-nums">{elapsedTime}</span>
        </button>
      </div>
    </div>
  );
};

export default ToolBar;
