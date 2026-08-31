export interface ThemePatternVariant {
  id: string;
  paletteId: string;
  variantIndex: number;
  patternCss: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  baseColors: { primary: string; secondary: string; accent: string };
  sortOrder: number;
  variants: ThemePatternVariant[];
}

export const themePalettesKeys = {
  list: () => ["theme-palettes"] as const,
};
