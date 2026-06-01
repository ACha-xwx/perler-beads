'use client';

import React, { useMemo, useState } from 'react';
import { PaletteColor } from '../utils/pixelation';
import { PaletteSelections } from '../utils/localStorageUtils';
import { ColorSystem, colorSystemOptions, getDisplayColorKey } from '../utils/colorSystemUtils';

interface CustomPaletteEditorProps {
  allColors: PaletteColor[];
  currentSelections: PaletteSelections;
  onSelectionChange: (key: string, isSelected: boolean) => void;
  onSaveCustomPalette: () => void;
  onClose: () => void;
  onExportCustomPalette: () => void;
  onImportCustomPalette: () => void;
  selectedColorSystem: ColorSystem;
  onColorSystemChange?: (system: ColorSystem) => void;
}

type ColorGroup = {
  key: string;
  colors: PaletteColor[];
  selectedCount: number;
};

function getSeriesKey(displayKey: string, colorSystem: ColorSystem): string {
  if (colorSystem === '盼盼' || colorSystem === '咪小窝') {
    const number = Number.parseInt(displayKey, 10);
    if (Number.isFinite(number)) {
      if (number <= 50) return '001-050';
      if (number <= 100) return '051-100';
      if (number <= 150) return '101-150';
      if (number <= 200) return '151-200';
      if (number <= 250) return '201-250';
      return '251+';
    }
  }

  return displayKey.match(/^[A-Z]+/)?.[0] || '其他';
}

function sortByDisplayKey(a: PaletteColor, b: PaletteColor, colorSystem: ColorSystem): number {
  const keyA = getDisplayColorKey(a.hex, colorSystem);
  const keyB = getDisplayColorKey(b.hex, colorSystem);
  return keyA.localeCompare(keyB, 'zh-CN', { numeric: true, sensitivity: 'base' });
}

const CustomPaletteEditor: React.FC<CustomPaletteEditorProps> = ({
  allColors,
  currentSelections,
  onSelectionChange,
  onSaveCustomPalette,
  onClose,
  onExportCustomPalette,
  onImportCustomPalette,
  selectedColorSystem,
  onColorSystemChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeSeries, setActiveSeries] = useState<string>('ALL');

  const selectedCount = useMemo(
    () => Object.values(currentSelections).filter(Boolean).length,
    [currentSelections],
  );

  const filteredColors = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return allColors
      .filter(color => {
        if (!search) return true;
        const originalKey = color.key.toLowerCase();
        const displayKey = getDisplayColorKey(color.hex, selectedColorSystem).toLowerCase();
        return originalKey.includes(search) || displayKey.includes(search) || color.hex.toLowerCase().includes(search);
      })
      .sort((a, b) => sortByDisplayKey(a, b, selectedColorSystem));
  }, [allColors, searchTerm, selectedColorSystem]);

  const groups = useMemo<ColorGroup[]>(() => {
    const grouped = new Map<string, PaletteColor[]>();
    filteredColors.forEach(color => {
      const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
      const series = getSeriesKey(displayKey, selectedColorSystem);
      grouped.set(series, [...(grouped.get(series) || []), color]);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' }))
      .map(([key, colors]) => ({
        key,
        colors,
        selectedCount: colors.filter(color => currentSelections[color.hex.toUpperCase()]).length,
      }));
  }, [currentSelections, filteredColors, selectedColorSystem]);

  const visibleColors = useMemo(() => {
    if (activeSeries === 'ALL') return filteredColors;
    return groups.find(group => group.key === activeSeries)?.colors || [];
  }, [activeSeries, filteredColors, groups]);

  const handleColorSystemChange = (system: ColorSystem) => {
    onColorSystemChange?.(system);
    setActiveSeries('ALL');
  };

  const toggleSeries = (series: string, selected: boolean) => {
    const targetColors = series === 'ALL' ? filteredColors : groups.find(group => group.key === series)?.colors || [];
    targetColors.forEach(color => onSelectionChange(color.hex.toUpperCase(), selected));
  };

  return (
    <div className="palette-lab flex h-[min(82vh,780px)] w-full flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[#181715] text-[#f7f2e9] shadow-[0_34px_100px_rgba(0,0,0,0.42)]">
      <div className="palette-lab-head flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
        <div>
          <div className="text-base font-semibold">色板设置</div>
          <div className="mt-1 text-xs text-white/48">已选 {selectedCount} / {allColors.length}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="palette-icon-button"
          aria-label="关闭色板设置"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] px-6 pb-5 pt-4">
        <div className="palette-toolbar grid gap-3 border-b border-white/10 pb-4 lg:grid-cols-[auto_auto_minmax(240px,1fr)]">
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {colorSystemOptions.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleColorSystemChange(option.key)}
                className={`palette-tab ${selectedColorSystem === option.key ? 'palette-tab-active' : ''}`}
              >
                {option.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`palette-view-button ${viewMode === 'grid' ? 'palette-view-button-active' : ''}`}
              aria-label="网格视图"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`palette-view-button ${viewMode === 'list' ? 'palette-view-button-active' : ''}`}
              aria-label="列表视图"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                <path d="M8 6h12" />
                <path d="M8 12h12" />
                <path d="M8 18h12" />
                <path d="M4 6h.01" />
                <path d="M4 12h.01" />
                <path d="M4 18h.01" />
              </svg>
            </button>
          </div>

          <label className="relative min-w-0">
            <span className="sr-only">搜索色号</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={event => {
                setSearchTerm(event.target.value);
                setActiveSeries('ALL');
              }}
              placeholder="搜索色号"
              className="h-11 w-full rounded-xl border border-white/12 bg-white/7 pl-10 pr-3 text-sm text-white outline-none transition focus:border-orange-300/80 focus:bg-white/10 focus:ring-4 focus:ring-orange-400/12"
            />
          </label>
        </div>

        <div className="grid min-h-0 gap-4 py-4 md:grid-cols-[120px_minmax(0,1fr)]">
          <nav className="palette-series-list min-h-0 overflow-auto pr-1">
            <button
              type="button"
              onClick={() => setActiveSeries('ALL')}
              className={`palette-series-button ${activeSeries === 'ALL' ? 'palette-series-button-active' : ''}`}
            >
              <span>全部</span>
              <span>{selectedCount}/{allColors.length}</span>
            </button>
            {groups.map(group => (
              <button
                key={group.key}
                type="button"
                onClick={() => setActiveSeries(group.key)}
                className={`palette-series-button ${activeSeries === group.key ? 'palette-series-button-active' : ''}`}
              >
                <span>{group.key}</span>
                <span>{group.selectedCount}/{group.colors.length}</span>
              </button>
            ))}
          </nav>

          <div className={`palette-color-scroll min-h-0 overflow-auto pr-1 ${viewMode === 'grid' ? 'palette-grid' : 'palette-list'}`}>
            {visibleColors.map((color, index) => {
              const hex = color.hex.toUpperCase();
              const isSelected = Boolean(currentSelections[hex]);
              const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
              return (
                <button
                  key={`${selectedColorSystem}-${hex}`}
                  type="button"
                  onClick={() => onSelectionChange(hex, !isSelected)}
                  className={`palette-color-cell ${isSelected ? 'palette-color-cell-selected' : ''}`}
                  style={{ '--cell-color': color.hex, '--cell-index': index } as React.CSSProperties}
                  title={`${displayKey} ${hex}`}
                >
                  <span className="palette-color-fill" />
                  <span className="palette-color-key">{displayKey}</span>
                  <span className="palette-color-check">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M3 8l3 3 7-7" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="palette-footer flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toggleSeries(activeSeries, true)} className="palette-footer-button">全选</button>
            <button type="button" onClick={() => toggleSeries(activeSeries, false)} className="palette-footer-button">清空</button>
            <button type="button" onClick={onImportCustomPalette} className="palette-footer-button">导入</button>
            <button type="button" onClick={onExportCustomPalette} className="palette-footer-button">导出</button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="palette-footer-button">取消</button>
            <button type="button" onClick={onSaveCustomPalette} className="palette-save-button">保存并应用</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomPaletteEditor;
