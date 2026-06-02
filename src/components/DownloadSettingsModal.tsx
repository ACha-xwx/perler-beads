import React, { useEffect, useState } from 'react';
import { GridDownloadOptions } from '../types/downloadTypes';

const gridLineColorOptions = [
  { name: '深灰', value: '#555555' },
  { name: '红色', value: '#FF0000' },
  { name: '蓝色', value: '#0000FF' },
  { name: '绿色', value: '#008000' },
  { name: '紫色', value: '#800080' },
  { name: '橙色', value: '#FFA500' },
];

interface DownloadSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: GridDownloadOptions;
  onOptionsChange: (options: GridDownloadOptions) => void;
  onDownload: (opts?: GridDownloadOptions) => void;
  themeClassName?: string;
  themeStyle?: React.CSSProperties;
}

const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative flex h-7 w-12 items-center rounded-full border p-1 transition duration-[420ms] ${
      checked
        ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgb(var(--accent-rgb))] shadow-[0_0_24px_rgba(var(--accent-rgb),0.24)]'
        : 'border-[rgba(var(--line-rgb),0.24)] bg-white/45'
    }`}
    aria-pressed={checked}
  >
    <span
      className={`block h-5 w-5 rounded-full bg-[#f7f2e9] shadow transition-[transform,box-shadow] duration-[420ms] ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const DownloadSettingsModal: React.FC<DownloadSettingsModalProps> = ({
  isOpen,
  onClose,
  options,
  onOptionsChange,
  onDownload,
  themeClassName = '',
  themeStyle,
}) => {
  const [tempOptions, setTempOptions] = useState<GridDownloadOptions>({ ...options });

  useEffect(() => {
    if (isOpen) {
      setTempOptions({ ...options });
    }
  }, [isOpen, options]);

  if (!isOpen) return null;

  const handleOptionChange = (key: keyof GridDownloadOptions, value: string | number | boolean) => {
    setTempOptions(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    onOptionsChange(tempOptions);
    onDownload(tempOptions);
    onClose();
  };

  return (
    <div
      className={`palette-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-black/38 p-4 backdrop-blur-md ${themeClassName}`}
      style={themeStyle}
    >
      <div className="palette-modal w-full max-w-[680px]">
        <div className="palette-lab settings-shell flex max-h-[88vh] flex-col overflow-hidden rounded-[22px]">
          <div className="palette-lab-head settings-head flex items-start justify-between gap-4 border-b border-[rgba(var(--line-rgb),0.16)] px-6 py-5">
            <div>
              <div className="text-base font-semibold">下载图纸设置</div>
              <div className="mt-1 text-xs text-[var(--muted)]">导出图纸、采购统计和可重新导入的源数据</div>
            </div>
            <button type="button" onClick={onClose} className="palette-icon-button" aria-label="关闭下载设置">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section className="download-panel-card">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-[var(--text)]">作者署名</span>
                <input
                  type="text"
                  value={tempOptions.authorName}
                  onChange={event => handleOptionChange('authorName', event.target.value)}
                  placeholder="可留空"
                  className="h-11 rounded-xl border border-[rgba(var(--line-rgb),0.18)] bg-white/58 px-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)]/70 focus:border-[rgba(var(--accent-rgb),0.8)] focus:bg-white/80 focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.14)]"
                />
              </label>
            </section>

            <section className="download-panel-card space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">显示网格线</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">按间隔加粗辅助线，方便拼豆定位</div>
                </div>
                <Toggle checked={tempOptions.showGrid} onChange={checked => handleOptionChange('showGrid', checked)} />
              </div>

              {tempOptions.showGrid && (
                <div className="grid gap-5 border-l border-[rgba(var(--line-rgb),0.16)] pl-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="block space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--text)]">网格线间隔</span>
                      <span className="tabular-nums text-[var(--text)]">{tempOptions.gridInterval}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="20"
                      step="1"
                      value={tempOptions.gridInterval}
                      onChange={event => handleOptionChange('gridInterval', Number(event.target.value))}
                      className="control-range w-full"
                      style={{ '--range-progress': `${((tempOptions.gridInterval - 5) / 15) * 100}%` } as React.CSSProperties}
                    />
                  </label>

                  <div className="space-y-3">
                    <div className="text-sm font-medium text-[var(--text)]">网格线颜色</div>
                    <div className="flex flex-wrap gap-2">
                      {gridLineColorOptions.map(colorOpt => (
                        <button
                          key={colorOpt.value}
                          type="button"
                          onClick={() => handleOptionChange('gridLineColor', colorOpt.value)}
                          className={`grid h-10 w-10 place-items-center rounded-full border transition ${
                            tempOptions.gridLineColor === colorOpt.value
                              ? 'border-[rgba(var(--accent-rgb),0.72)] ring-2 ring-[rgba(var(--accent-rgb),0.36)]'
                              : 'border-[rgba(var(--line-rgb),0.2)] hover:border-[rgba(var(--accent-rgb),0.45)]'
                          }`}
                          title={colorOpt.name}
                        >
                          <span className="h-7 w-7 rounded-full border border-black/15" style={{ backgroundColor: colorOpt.value }} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="download-panel-card grid gap-4 sm:grid-cols-2">
              {[
                ['显示坐标数字', 'showCoordinates', '在上下左右显示格子坐标'],
                ['隐藏格内色号', 'showCellNumbers', '只导出纯像素色块', true],
                ['包含色号统计', 'includeStats', '在图纸下方追加采购清单'],
                ['水平镜像', 'horizontalMirror', '适合反面烫片或翻面制作'],
                ['添加署名', 'addWatermark', '可选写入工具名和作者名，默认不添加'],
                ['同时导出源数据', 'exportCsv', '导出 hex CSV，可重新导入'],
              ].map(([label, key, helper, inverted], index) => {
                const optionKey = key as keyof GridDownloadOptions;
                const checked = Boolean(inverted ? !tempOptions[optionKey] : tempOptions[optionKey]);
                return (
                  <div key={String(key)} className="download-option-row flex items-center justify-between gap-4 rounded-xl border border-[rgba(var(--line-rgb),0.14)] bg-white/50 px-3 py-3" style={{ animationDelay: `${Math.min(index * 25, 140)}ms` }}>
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{helper}</div>
                    </div>
                    <Toggle
                      checked={checked}
                      onChange={nextChecked => handleOptionChange(optionKey, inverted ? !nextChecked : nextChecked)}
                    />
                  </div>
                );
              })}
            </section>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[rgba(var(--line-rgb),0.16)] px-6 py-4">
            <button type="button" onClick={onClose} className="palette-footer-button">取消</button>
            <button type="button" onClick={handleSave} className="palette-save-button">下载图纸</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadSettingsModal;
export { gridLineColorOptions };
