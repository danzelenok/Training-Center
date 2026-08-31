export interface ThemePatternVariant {
  id: string;
  paletteId: string;
  variantIndex: number;
  name: string;
  patternCss: string; // content-card background
  deepCss: string; // cover-slide background
}

export interface ThemePalette {
  id: string;
  name: string;
  baseColors: { primary: string; secondary: string; accent: string };
  sortOrder: number;
  fontFamily: string;
  displayFontFamily: string;
  fontWeight: number;
  letterSpacing: string;
  cardRadius: number;
  accentColor: string;
  accentInkColor: string;
  isDark: boolean;
  variants: ThemePatternVariant[];
}

export const themePalettesKeys = {
  list: () => ["theme-palettes"] as const,
};
