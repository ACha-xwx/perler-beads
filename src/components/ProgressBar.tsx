import React from 'react';

interface ProgressBarProps {
  progressPercentage: number;
  recommendedCell?: { row: number; col: number } | null;
  colorInfo?: {
    color: string;
    name: string;
    total: number;
    completed: number;
  };
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progressPercentage,
  recommendedCell
}) => {
  // 生成7个圆点来表示进度
  const progressDots = Array.from({ length: 7 }, (_, index) => {
    const threshold = (index + 1) * (100 / 7);
    const isFilled = progressPercentage >= threshold;
    
    return (
      <div
        key={index}
        className={`focus-progress-dot h-2.5 w-2.5 rounded-full ${
          isFilled ? 'focus-progress-dot-active bg-[rgb(var(--accent-rgb))]' : 'bg-[rgba(var(--line-rgb),0.2)]'
        }`}
      />
    );
  });

  return (
    <div className="border-t border-[rgba(var(--line-rgb),0.12)] bg-[rgba(var(--panel-rgb),0.54)] px-3 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex items-center gap-1.5">
          {progressDots}
        </div>
        <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[rgba(var(--line-rgb),0.14)]">
          <div
            className="focus-progress-fill h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--accent-rgb)),rgb(var(--accent-2-rgb)))]"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{progressPercentage}%</span>
      </div>
      
      <div className="shrink-0 text-xs text-[var(--muted)]">
        {recommendedCell ? (
          <span>下一块: {recommendedCell.row + 1},{recommendedCell.col + 1}</span>
        ) : (
          <span>已完成当前颜色</span>
        )}
      </div>
      </div>
    </div>
  );
};

export default ProgressBar;
