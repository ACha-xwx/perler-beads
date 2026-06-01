'use client';

import React from 'react';
import { MappedPixel } from '../utils/pixelation';
import { ColorSystem } from '../utils/colorSystemUtils';
import { exportCsvData } from '../utils/imageDownloader';

interface FocusModePreDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedWithoutDownload: () => void;
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  selectedColorSystem: ColorSystem;
  themeClassName?: string;
  themeStyle?: React.CSSProperties;
}

const FocusModePreDownloadModal: React.FC<FocusModePreDownloadModalProps> = ({
  isOpen,
  onClose,
  onProceedWithoutDownload,
  mappedPixelData,
  gridDimensions,
  selectedColorSystem,
  themeClassName = '',
  themeStyle,
}) => {
  if (!isOpen) return null;

  const handleDownloadAndProceed = () => {
    // 下载CSV数据文件
    exportCsvData({
      mappedPixelData,
      gridDimensions,
      selectedColorSystem
    });
    
    // 稍等一下让下载开始，然后进入专心拼豆模式
    setTimeout(() => {
      onProceedWithoutDownload();
    }, 500);
  };

  return (
    <div
      className={`workspace-app ${themeClassName} palette-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md`}
      style={themeStyle}
    >
      <div className="palette-modal settings-shell w-full max-w-md space-y-4 rounded-[22px] p-6">
        {/* 标题 */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.26)] bg-[rgba(var(--accent-rgb),0.12)] text-[rgb(var(--accent-rgb))]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[var(--text)]">
            进入专心拼豆模式
          </h3>
        </div>

        {/* 提醒内容 */}
        <div className="space-y-3 text-sm text-[var(--muted)]">
          <div className="rounded-xl border border-[rgba(var(--line-rgb),0.18)] bg-white/54 p-3">
            <div className="flex items-start space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-5 w-5 flex-shrink-0 text-[rgb(var(--accent-rgb))]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-[var(--text)]">进入前建议保存</p>
                <p className="text-[var(--muted)]">
                  进入专心拼豆模式后，您将无法返回到当前的编辑界面。建议您先下载当前的数据文件（CSV格式）保存，以便日后重新导入使用。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p>专心拼豆模式特点：</p>
            <ul className="space-y-1 text-xs text-[var(--muted)]">
              <li>• 专为手机优化的拼豆助手</li>
              <li>• 提供颜色引导和进度追踪</li>
              <li>• 支持触摸操作和缩放查看</li>
              <li>• 退出后将丢失当前编辑状态</li>
            </ul>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col space-y-2 pt-4">
          <button
            onClick={handleDownloadAndProceed}
            className="glass-action glass-action-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>下载数据文件并进入</span>
          </button>
          
          <button
            onClick={onProceedWithoutDownload}
            className="glass-action w-full px-4 py-2.5 font-medium"
          >
            直接进入（不下载）
          </button>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusModePreDownloadModal;
