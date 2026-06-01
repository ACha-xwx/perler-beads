export type AppearanceTheme = 'mono' | 'jade' | 'coral' | 'azure' | 'violet' | 'graphite';
export type AppearanceFont = 'system' | 'rounded' | 'serif' | 'mono';

export interface AppearanceSettings {
  theme: AppearanceTheme;
  font: AppearanceFont;
  scale: number;
}

export const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'mono',
  font: 'serif',
  scale: 100,
};

export const appearanceThemes: Array<{
  key: AppearanceTheme;
  name: string;
  note: string;
  colors: string[];
}> = [
  { key: 'mono', name: 'Ink wash', note: '黑白默认', colors: ['#f8f8f5', '#1f211f', '#8c8c84'] },
  { key: 'jade', name: 'Jade breeze', note: '青玉微风', colors: ['#eff8ef', '#2f6f5f', '#c85b42'] },
  { key: 'coral', name: 'Coral glow', note: '暖珊瑚光', colors: ['#fff3ea', '#d86345', '#229781'] },
  { key: 'azure', name: 'Azure tide', note: '晴空潮汐', colors: ['#eef7ff', '#3e73b8', '#13a6a6'] },
  { key: 'violet', name: 'Violet dusk', note: '暮紫回声', colors: ['#f6f0ff', '#7d5ac7', '#df7f4f'] },
  { key: 'graphite', name: 'Graphite mist', note: '石墨雾色', colors: ['#f2f3f1', '#3e4240', '#9b7a55'] },
];

export const appearanceFonts: Array<{
  key: AppearanceFont;
  name: string;
  stack: string;
}> = [
  {
    key: 'system',
    name: 'System',
    stack: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    key: 'rounded',
    name: 'Rounded',
    stack: '"Trebuchet MS", "Segoe UI", "Microsoft YaHei UI", sans-serif',
  },
  {
    key: 'serif',
    name: 'Serif',
    stack: 'Georgia, "Times New Roman", "Noto Serif SC", serif',
  },
  {
    key: 'mono',
    name: 'Mono',
    stack: 'var(--font-geist-mono), "Cascadia Code", Consolas, monospace',
  },
];

export function normalizeAppearanceSettings(value?: Partial<AppearanceSettings> | null): AppearanceSettings {
  const theme = appearanceThemes.some(item => item.key === value?.theme) ? value!.theme! : defaultAppearanceSettings.theme;
  const font = appearanceFonts.some(item => item.key === value?.font) ? value!.font! : defaultAppearanceSettings.font;
  const rawScale = Number(value?.scale ?? defaultAppearanceSettings.scale);
  const scale = Math.min(125, Math.max(85, Math.round(Number.isFinite(rawScale) ? rawScale : defaultAppearanceSettings.scale)));

  return { theme, font, scale };
}

