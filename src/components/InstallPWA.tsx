'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      console.log('PWA 安装提示已准备');
      setSupportsPWA(true);
      setPromptInstall(event);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const onClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!promptInstall) return;

    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    if (outcome === 'accepted') {
      setPromptInstall(null);
      setSupportsPWA(false);
    }
  };

  if (isInstalled || !supportsPWA) return null;

  return (
    <button
      className="install-pwa-button fixed bottom-6 right-6 z-50 flex min-h-[46px] items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.42)] bg-[rgba(var(--panel-rgb),0.76)] px-5 py-3 text-sm font-semibold text-[var(--text)] shadow-[0_18px_42px_rgba(var(--shadow-rgb),0.18),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-[rgba(var(--accent-rgb),0.7)] hover:bg-[rgba(var(--accent-rgb),0.14)] hover:shadow-[0_24px_52px_rgba(var(--shadow-rgb),0.24)] active:translate-y-0"
      onClick={onClick}
      aria-label="安装应用"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[rgba(var(--accent-rgb),0.16)] text-[rgb(var(--accent-rgb))]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
        </svg>
      </span>
      安装应用
    </button>
  );
}
