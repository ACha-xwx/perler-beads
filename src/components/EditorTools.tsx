import React from 'react';
import { ColorReplaceState } from '../hooks/useManualEditingState';
import { TRANSPARENT_KEY } from '../utils/pixelEditingUtils';
import { ColorSystem, getColorKeyByHex } from '../utils/colorSystemUtils';

export type EditorTool =
  | 'palette'
  | 'pan'
  | 'brush'
  | 'eraser'
  | 'eyedropper'
  | 'fill'
  | 'line'
  | 'rectangle'
  | 'selection';

type SimpleColor = { key: string; color: string };
type EditorLayerItem = {
  id: string;
  name: string;
  type: 'base' | 'layer' | 'sticker';
  visible: boolean;
  locked: boolean;
};
type GridPoint = { row: number; col: number } | null;
type SelectionArea = { startRow: number; startCol: number; endRow: number; endCol: number } | null;

interface EditorToolRailProps {
  activeTool: EditorTool;
  selectedColor: SimpleColor | null;
  fallbackColor: SimpleColor | null;
  selectedColorSystem: ColorSystem;
  showMinimap: boolean;
  onToolChange: (tool: EditorTool) => void;
  onToggleMinimap: () => void;
  variant?: 'floating' | 'drawer';
  className?: string;
}

interface EditorSidePanelProps {
  activeTool: EditorTool;
  selectedColor: SimpleColor | null;
  selectedColorSystem: ColorSystem;
  currentColors: SimpleColor[];
  fullPaletteColors: SimpleColor[];
  showFullPalette: boolean;
  onToggleFullPalette: () => void;
  onColorSelect: (color: SimpleColor | null) => void;
  onHighlightColor: (hex: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushMirrorX: boolean;
  onBrushMirrorXChange: (enabled: boolean) => void;
  brushMirrorY: boolean;
  onBrushMirrorYChange: (enabled: boolean) => void;
  eraserSize: number;
  onEraserSizeChange: (size: number) => void;
  lineSize: number;
  onLineSizeChange: (size: number) => void;
  lineMirrorX: boolean;
  onLineMirrorXChange: (enabled: boolean) => void;
  lineMirrorY: boolean;
  onLineMirrorYChange: (enabled: boolean) => void;
  rectangleSize: number;
  onRectangleSizeChange: (size: number) => void;
  rectangleFilled: boolean;
  onRectangleFilledChange: (filled: boolean) => void;
  rectangleMirrorX: boolean;
  onRectangleMirrorXChange: (enabled: boolean) => void;
  rectangleMirrorY: boolean;
  onRectangleMirrorYChange: (enabled: boolean) => void;
  colorReplaceState: ColorReplaceState;
  onColorReplaceToggle: () => void;
  onRegionErase: () => void;
  selectionArea: SelectionArea;
  pendingLineStart: GridPoint;
  pendingRectangleStart: GridPoint;
  onCancelPendingShape: () => void;
  layers: EditorLayerItem[];
  activeLayerId: string;
  onAddSticker: () => void;
  onAddLayer: () => void;
  onLayerSelect: (id: string) => void;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
}

const toolItems: Array<{ key: EditorTool; label: string; icon: React.ReactNode }> = [
  {
    key: 'pan',
    label: '拖拽',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 11V6a2 2 0 00-4 0v3" />
        <path d="M14 10V4a2 2 0 00-4 0v6" />
        <path d="M10 10.5V5a2 2 0 00-4 0v9" />
        <path d="M22 10.5V14a8 8 0 01-8 8h-1C8.58 22 6 18 6 14" />
      </svg>
    ),
  },
  {
    key: 'brush',
    label: '画笔',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    key: 'eraser',
    label: '橡皮',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 21h10" />
        <path d="M5.5 11.5l8-8a2.83 2.83 0 114 4l-8 8a2 2 0 01-1.41.59H5a2 2 0 01-2-2v-3.17c0-.53.21-1.04.59-1.42z" />
      </svg>
    ),
  },
  {
    key: 'eyedropper',
    label: '取色',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 22l1-1h3l9-9" />
        <path d="M3 21v-3l9-9" />
        <path d="M14.5 5.5l4-4a1.41 1.41 0 012 2l-4 4" />
        <path d="M12 8l4 4" />
      </svg>
    ),
  },
  {
    key: 'fill',
    label: '填充',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 11V4a2 2 0 00-2-2H4a2 2 0 00-2 2v13a2 2 0 002 2h7" />
        <path d="M16 22l4.5-4.5a2.12 2.12 0 000-3L18 12l-7 7 2.5 2.5a2.12 2.12 0 003 0z" />
      </svg>
    ),
  },
  {
    key: 'line',
    label: '直线',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    ),
  },
  {
    key: 'rectangle',
    label: '矩形',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    key: 'selection',
    label: '选区',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3h4M15 3h4M3 5v4M3 15v4M21 5v4M21 15v4M5 21h4M15 21h4" />
      </svg>
    ),
  },
];

const clampSize = (value: number) => Math.max(1, Math.min(12, Math.round(value)));

const PanelCard = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <section className="editor-panel-card" style={{ animationDelay: `${delay}ms` }}>
    {children}
  </section>
);

const SizeControl = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className="block space-y-2">
    <div className="flex items-center justify-between text-xs text-[var(--muted)]">
      <span className="font-medium">{label}</span>
      <span className="tabular-nums text-[var(--text)]">{value}</span>
    </div>
    <input
      type="range"
      min="1"
      max="12"
      value={value}
      onChange={event => onChange(clampSize(Number(event.target.value)))}
      className="control-range w-full"
      style={{ '--range-progress': `${((value - 1) / 11) * 100}%` } as React.CSSProperties}
    />
  </label>
);

const ToggleButton = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`rounded-lg border px-2 py-2 text-xs ${
      checked
        ? 'border-[rgba(var(--accent-rgb),0.72)] bg-[rgb(var(--accent-rgb))] text-white'
        : 'border-[rgba(var(--line-rgb),0.16)] bg-white/55 text-[var(--muted)] hover:border-[rgba(var(--accent-rgb),0.38)] hover:bg-[rgba(var(--accent-rgb),0.08)] hover:text-[var(--text)]'
    }`}
    aria-pressed={checked}
  >
    {label}
  </button>
);

export function EditorToolRail({
  activeTool,
  selectedColor,
  fallbackColor,
  selectedColorSystem,
  showMinimap,
  onToolChange,
  onToggleMinimap,
  variant = 'floating',
  className = '',
}: EditorToolRailProps) {
  const displayColor = selectedColor && selectedColor.key !== TRANSPARENT_KEY ? selectedColor : fallbackColor;
  const displayKey = displayColor ? getColorKeyByHex(displayColor.color, selectedColorSystem) : 'T01';
  const railClassName =
    variant === 'drawer'
      ? 'editor-tool-rail editor-tool-rail-drawer flex w-full flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.9)] p-2 shadow-[0_12px_28px_rgba(var(--shadow-rgb),0.14)] min-w-[96px]'
      : 'editor-tool-rail absolute left-3 top-1/2 z-30 flex max-h-[calc(100%-1.5rem)] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.78)] p-1.5 shadow-[0_18px_44px_rgba(var(--shadow-rgb),0.16)] backdrop-blur-xl';

  return (
    <div className={`${railClassName} ${className}`.trim()}>
      <button
        type="button"
        onClick={() => onToolChange('palette')}
        className="mb-1 flex flex-shrink-0 cursor-pointer flex-col items-center gap-0.5"
        aria-label="切换色板"
      >
        <span className="h-9 w-9 rounded-lg border-2 border-[rgba(var(--line-rgb),0.28)]" style={{ backgroundColor: displayColor?.color || '#FFFFFF' }} />
        <span className="max-w-[40px] truncate font-mono text-[9px] leading-none text-[var(--muted)]">{displayKey}</span>
      </button>

      <div className="h-px w-7 flex-shrink-0 bg-[rgba(var(--line-rgb),0.24)]" />

      {toolItems.map(item => (
        <button
          key={item.key}
          type="button"
          onClick={() => onToolChange(item.key)}
          className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-all duration-200 ${
            activeTool === item.key
              ? 'scale-110 bg-[rgb(var(--accent-rgb))] text-white shadow-lg shadow-[rgba(var(--accent-rgb),0.3)]'
              : 'text-[var(--muted)] hover:bg-[rgba(var(--accent-rgb),0.1)] hover:text-[var(--text)] active:scale-95'
          }`}
          title={item.label}
          aria-label={item.label}
        >
          <span className="h-5 w-5">{item.icon}</span>
        </button>
      ))}

      <div className="h-px w-7 flex-shrink-0 bg-[rgba(var(--line-rgb),0.24)]" />

      <button
        type="button"
        onClick={onToggleMinimap}
        className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-all duration-200 ${
          showMinimap
            ? 'scale-105 bg-[rgba(var(--accent-rgb),0.16)] text-[var(--text)] shadow-[0_0_22px_rgba(var(--accent-rgb),0.18)]'
            : 'text-[var(--muted)] hover:bg-[rgba(var(--accent-rgb),0.1)] hover:text-[var(--text)] active:scale-95'
        }`}
        title={showMinimap ? '隐藏小地图' : '显示小地图'}
        aria-label={showMinimap ? '隐藏小地图' : '显示小地图'}
        aria-pressed={showMinimap}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z" />
          <path d="M9 3v14" />
          <path d="M15 7v14" />
        </svg>
      </button>
    </div>
  );
}

export function EditorSidePanel({
  activeTool,
  selectedColor,
  selectedColorSystem,
  currentColors,
  fullPaletteColors,
  showFullPalette,
  onToggleFullPalette,
  onColorSelect,
  onHighlightColor,
  brushSize,
  onBrushSizeChange,
  brushMirrorX,
  onBrushMirrorXChange,
  brushMirrorY,
  onBrushMirrorYChange,
  eraserSize,
  onEraserSizeChange,
  lineSize,
  onLineSizeChange,
  lineMirrorX,
  onLineMirrorXChange,
  lineMirrorY,
  onLineMirrorYChange,
  rectangleSize,
  onRectangleSizeChange,
  rectangleFilled,
  onRectangleFilledChange,
  rectangleMirrorX,
  onRectangleMirrorXChange,
  rectangleMirrorY,
  onRectangleMirrorYChange,
  colorReplaceState,
  onColorReplaceToggle,
  onRegionErase,
  selectionArea,
  pendingLineStart,
  pendingRectangleStart,
  onCancelPendingShape,
  layers,
  activeLayerId,
  onAddSticker,
  onAddLayer,
  onLayerSelect,
  onToggleLayerVisible,
  onToggleLayerLock,
  onDuplicateLayer,
  onMoveLayer,
  onDeleteLayer,
}: EditorSidePanelProps) {
  const displayColors = showFullPalette ? fullPaletteColors : currentColors;
  const activeToolName = {
    palette: '色板',
    pan: '拖拽',
    brush: '画笔',
    eraser: '橡皮',
    eyedropper: '取色',
    fill: '填充',
    line: '直线',
    rectangle: '矩形',
    selection: '选区',
  }[activeTool];

  return (
    <aside className="editor-side-panel flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.84)] text-[var(--text)] shadow-[-18px_0_48px_rgba(var(--shadow-rgb),0.12)] backdrop-blur-2xl">
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <PanelCard>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">{activeToolName}</div>
            {(pendingLineStart || pendingRectangleStart) && (
              <button type="button" onClick={onCancelPendingShape} className="rounded-lg border border-[rgba(var(--line-rgb),0.16)] px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-[rgba(var(--accent-rgb),0.08)]">
                取消起点
              </button>
            )}
          </div>

          {activeTool === 'pan' && <p className="text-xs leading-6 text-[var(--muted)]">拖动画布区域可以平移视图。滚动条也可以直接用于移动大尺寸图纸。</p>}
          {activeTool === 'palette' && <p className="text-xs leading-6 text-[var(--muted)]">在下方色板中选择当前画笔颜色。</p>}
          {activeTool === 'brush' && (
            <div className="space-y-3">
              <SizeControl label="笔刷大小" value={brushSize} onChange={onBrushSizeChange} />
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton label="水平镜像" checked={brushMirrorX} onChange={onBrushMirrorXChange} />
                <ToggleButton label="垂直镜像" checked={brushMirrorY} onChange={onBrushMirrorYChange} />
              </div>
            </div>
          )}
          {activeTool === 'eraser' && (
            <div className="space-y-3">
              <SizeControl label="笔刷大小" value={eraserSize} onChange={onEraserSizeChange} />
              <button type="button" onClick={onRegionErase} className="w-full rounded-lg border border-[rgba(var(--line-rgb),0.16)] bg-white/55 px-3 py-2 text-xs text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.38)] hover:bg-[rgba(var(--accent-rgb),0.08)]">
                区域擦除（同色连通）
              </button>
            </div>
          )}
          {activeTool === 'eyedropper' && <p className="text-xs leading-6 text-[var(--muted)]">在画布上点击拾取颜色，拾取后会自动切回画笔。</p>}
          {activeTool === 'fill' && (
            <div className="space-y-3">
              <button type="button" onClick={onColorReplaceToggle} className="w-full rounded-lg border border-[rgba(var(--line-rgb),0.16)] bg-white/55 px-3 py-2 text-xs text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.38)] hover:bg-[rgba(var(--accent-rgb),0.08)]">
                {colorReplaceState.isActive ? (colorReplaceState.step === 'select-source' ? '点击画布选择源颜色' : '选择目标颜色') : '批量替换颜色'}
              </button>
              <p className="text-xs leading-6 text-[var(--muted)]">直接点击画布会填充同色连通区域；批量替换可把全图某个颜色替换为另一个颜色。</p>
            </div>
          )}
          {activeTool === 'line' && (
            <div className="space-y-3">
              <SizeControl label="笔刷大小" value={lineSize} onChange={onLineSizeChange} />
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton label="水平镜像" checked={lineMirrorX} onChange={onLineMirrorXChange} />
                <ToggleButton label="垂直镜像" checked={lineMirrorY} onChange={onLineMirrorYChange} />
              </div>
              <p className="text-xs leading-6 text-[var(--muted)]">
                {pendingLineStart ? `已选起点 (${pendingLineStart.col + 1}, ${pendingLineStart.row + 1})，再点终点。` : '先点起点，再点终点绘制直线。'}
              </p>
            </div>
          )}
          {activeTool === 'rectangle' && (
            <div className="space-y-3">
              <SizeControl label="笔刷大小" value={rectangleSize} onChange={onRectangleSizeChange} />
              <button
                type="button"
                onClick={() => onRectangleFilledChange(!rectangleFilled)}
                className={`w-full rounded-lg border px-3 py-2 text-xs ${rectangleFilled ? 'border-[rgba(var(--accent-rgb),0.72)] bg-[rgb(var(--accent-rgb))] text-white' : 'border-[rgba(var(--line-rgb),0.16)] bg-white/55 text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.38)] hover:bg-[rgba(var(--accent-rgb),0.08)]'}`}
              >
                实心填充
              </button>
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton label="水平镜像" checked={rectangleMirrorX} onChange={onRectangleMirrorXChange} />
                <ToggleButton label="垂直镜像" checked={rectangleMirrorY} onChange={onRectangleMirrorYChange} />
              </div>
              <p className="text-xs leading-6 text-[var(--muted)]">
                {pendingRectangleStart ? `已选起点 (${pendingRectangleStart.col + 1}, ${pendingRectangleStart.row + 1})，再点对角。` : '先点一个角，再点对角绘制矩形。'}
              </p>
            </div>
          )}
          {activeTool === 'selection' && (
            <div className="space-y-3 text-xs text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>选区尺寸</span>
                <span className="tabular-nums">
                  {selectionArea ? `${Math.abs(selectionArea.endCol - selectionArea.startCol) + 1} x ${Math.abs(selectionArea.endRow - selectionArea.startRow) + 1}` : '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {['移动', '复制', '清空', '取消'].map(label => (
                  <button key={label} type="button" disabled={!selectionArea} className="rounded-lg border border-[rgba(var(--line-rgb),0.16)] px-2 py-1.5 hover:bg-[rgba(var(--accent-rgb),0.08)] disabled:opacity-30">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard delay={45}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">色板</div>
            {selectedColor && selectedColor.key !== TRANSPARENT_KEY && (
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                <span className="h-4 w-4 rounded border border-[rgba(var(--line-rgb),0.22)]" style={{ backgroundColor: selectedColor.color }} />
                {getColorKeyByHex(selectedColor.color, selectedColorSystem)}
              </div>
            )}
          </div>
          <div className="mb-3 flex gap-1.5">
            <button type="button" onClick={onToggleFullPalette} className="flex-1 rounded-lg border border-[rgba(var(--line-rgb),0.14)] bg-white/55 px-2 py-1.5 text-xs text-[var(--text)] hover:bg-[rgba(var(--accent-rgb),0.08)]">
              {showFullPalette ? `完整色板 (${fullPaletteColors.length})` : `当前 (${currentColors.length})`}
            </button>
            <button type="button" className="rounded-lg border border-[rgba(var(--line-rgb),0.14)] bg-white/55 px-2.5 py-1.5 text-xs text-[var(--text)] hover:bg-[rgba(var(--accent-rgb),0.08)]">色相排序</button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {displayColors.slice(0, showFullPalette ? 120 : 42).map((color, index) => {
              const displayKey = getColorKeyByHex(color.color, selectedColorSystem);
              const isSelected = selectedColor?.color.toUpperCase() === color.color.toUpperCase();
              const isDark = color.color.toUpperCase() === '#000000' || color.color.toUpperCase() === '#1D1414';
              return (
                <button
                  key={`${color.key}-${color.color}`}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onHighlightColor(color.color);
                      onColorSelect(null);
                      return;
                    }

                    onHighlightColor(color.color);
                    onColorSelect(color);
                  }}
                  title={`${displayKey} ${color.color}`}
                  className={`editor-color-swatch ${isSelected ? 'editor-color-swatch-selected' : ''}`}
                  style={{ backgroundColor: color.color, animationDelay: `${Math.min(index * 12, 360)}ms` }}
                >
                  <span className={`text-[9px] font-bold leading-none ${isDark ? 'text-white/82' : 'text-black/70'}`}>{displayKey}</span>
                </button>
              );
            })}
          </div>
        </PanelCard>

        <PanelCard delay={90}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">图层</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="添加贴纸"
                aria-label="添加贴纸"
                onClick={onAddSticker}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(var(--line-rgb),0.16)] bg-white/42 text-[var(--muted)] hover:bg-[rgba(var(--accent-rgb),0.08)]"
              >
                <span className="text-base leading-none">✦</span>
              </button>
              <button
                type="button"
                title="添加空白图层"
                aria-label="添加空白图层"
                onClick={onAddLayer}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(var(--line-rgb),0.16)] bg-white/42 text-[var(--muted)] hover:bg-[rgba(var(--accent-rgb),0.08)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {layers.map(layer => {
              const isActive = layer.id === activeLayerId;
              const isBaseLayer = layer.type === 'base';
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onLayerSelect(layer.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-xs transition ${
                    isActive
                      ? 'border-[rgba(var(--accent-rgb),0.42)] bg-[rgba(var(--accent-rgb),0.1)]'
                      : 'border-[rgba(var(--line-rgb),0.14)] bg-white/55 hover:bg-white/72'
                  }`}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    title={layer.visible ? '隐藏' : '显示'}
                    onClick={event => {
                      event.stopPropagation();
                      onToggleLayerVisible(layer.id);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggleLayerVisible(layer.id);
                      }
                    }}
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-md ${layer.visible ? 'text-[var(--muted)]' : 'text-[var(--muted)] opacity-35'}`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text)]">{layer.name}</span>
                  <span className="flex flex-shrink-0 items-center gap-1 text-[var(--muted)]">
                    <span
                      role="button"
                      tabIndex={0}
                      title={layer.locked ? '解锁图层' : '锁定图层'}
                      onClick={event => {
                        event.stopPropagation();
                        onToggleLayerLock(layer.id);
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onToggleLayerLock(layer.id);
                        }
                      }}
                      className={`grid h-7 w-7 place-items-center rounded-md ${layer.locked ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--text)]' : 'hover:bg-white/70'}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        {layer.locked ? (
                          <>
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 018 0v4" />
                          </>
                        ) : (
                          <>
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 017-2" />
                          </>
                        )}
                      </svg>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="上移"
                      onClick={event => {
                        event.stopPropagation();
                        onMoveLayer(layer.id, 'up');
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onMoveLayer(layer.id, 'up');
                        }
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/70"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="下移"
                      onClick={event => {
                        event.stopPropagation();
                        onMoveLayer(layer.id, 'down');
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onMoveLayer(layer.id, 'down');
                        }
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/70"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="复制图层"
                      onClick={event => {
                        event.stopPropagation();
                        onDuplicateLayer(layer.id);
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onDuplicateLayer(layer.id);
                        }
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/70"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </span>
                    {!isBaseLayer && (
                      <span
                        role="button"
                        tabIndex={0}
                        title="删除图层"
                        onClick={event => {
                          event.stopPropagation();
                          onDeleteLayer(layer.id);
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onDeleteLayer(layer.id);
                          }
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/70 hover:text-red-500"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </PanelCard>
      </div>
    </aside>
  );
}
