export type MusicVizionTheme = 'neon' | 'metal';

export interface ThemeToggleProps {
  theme: MusicVizionTheme;
  onChange: (theme: MusicVizionTheme) => void;
}

const OPTIONS: { value: MusicVizionTheme; label: string }[] = [
  { value: 'neon', label: 'NEON' },
  { value: 'metal', label: 'METAL' },
];

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className="mvt" role="radiogroup" aria-label="Color theme" data-testid="theme-toggle">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          data-theme={o.value}
          className="mvt-opt"
          onClick={() => onChange(o.value)}
          data-testid={`button-theme-${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
