import React from 'react';
import { getDisplayColorKey, ColorSystem } from '../utils/colorSystemUtils';

interface TooltipData {
  x: number;
  y: number;
  key: string;
  color: string;
}

interface GridTooltipProps {
  tooltipData: TooltipData | null;
  selectedColorSystem?: ColorSystem;
}

const GridTooltip: React.FC<GridTooltipProps> = ({ tooltipData, selectedColorSystem = 'MARD' }) => {
  if (!tooltipData) return null;

  return (
    <div
      className="pointer-events-none absolute z-50 flex items-center space-x-1.5 rounded-lg border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.88)] px-2.5 py-1.5 text-xs text-[var(--text)] shadow-[0_14px_32px_rgba(var(--shadow-rgb),0.14)] backdrop-blur-xl"
      style={{
        left: `${tooltipData.x}px`, 
        top: `${tooltipData.y - 25}px`, // 向上偏移，使提示框显示在鼠标上方
        transform: 'translate(-50%, -100%)', // 水平居中，不再垂直偏移
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className="inline-block h-3 w-3 flex-shrink-0 rounded-sm border border-black/15"
        style={{ backgroundColor: tooltipData.color }}
      ></span>
      <span className="font-mono font-semibold">{getDisplayColorKey(tooltipData.color, selectedColorSystem)}</span>
    </div>
  );
};

export default GridTooltip;
