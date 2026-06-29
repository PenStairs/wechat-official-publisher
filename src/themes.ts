import type { Theme, ThemeColors, ThemePresentation, ThemePresentationStyle, ThemeSpacing, ThemeTypography } from "./types.js";
import { buildWechatThemeStyleSheet } from "./theme-css.js";

interface ThemePalettePreset {
  text: string;
  heading: string;
  muted: string;
  border: string;
  surface: string;
  canvas: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  codeText: string;
  codeBackground: string;
  codeHeader: string;
  inlineCodeText: string;
  inlineCodeBackground: string;
  shadow: string;
}

interface ThemeRecipe {
  name: string;
  description: string;
  palette: ThemePalettePreset;
  presentationStyle: ThemePresentationStyle;
  typography?: Partial<ThemeTypography>;
  spacing?: Partial<ThemeSpacing>;
}

const baseSpacing: ThemeSpacing = {
  block: "26px",
  paragraph: "14px",
  compact: "12px"
};

const baseTypography: ThemeTypography = {
  fontFamily: "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Segoe UI',sans-serif",
  titleSize: "24px",
  headingSize: "20px",
  bodySize: "16px",
  smallSize: "13px",
  lineHeight: "1.78"
};

const presentationByStyle: Record<ThemePresentationStyle, ThemePresentation> = {
  standard: {
    style: "standard",
    radius: "10px",
    shadow: "none"
  },
  minimal: {
    style: "minimal",
    radius: "6px",
    shadow: "none"
  },
  focus: {
    style: "focus",
    radius: "0",
    shadow: "none"
  },
  elegant: {
    style: "elegant",
    radius: "12px",
    shadow: "0 6px 18px rgba(24, 24, 27, 0.05)"
  },
  bold: {
    style: "bold",
    radius: "12px",
    shadow: "0 8px 22px rgba(19, 52, 99, 0.13)"
  }
};

const palettes: Record<string, ThemePalettePreset> = {
  life: {
    text: "#2f2722",
    heading: "#5b3826",
    muted: "#7a6658",
    border: "#ead8c6",
    surface: "#fffaf4",
    canvas: "#ffffff",
    accent: "#9a5530",
    accentSoft: "#f8eadf",
    onAccent: "#ffffff",
    codeText: "#3b342f",
    codeBackground: "rgba(255,250,244,0.98)",
    codeHeader: "rgba(184,107,60,0.14)",
    inlineCodeText: "#8f4d2c",
    inlineCodeBackground: "rgba(184,107,60,0.14)",
    shadow: "0 2px 10px rgba(91,56,38,0.07)"
  },
  tech: {
    text: "#172033",
    heading: "#0B1020",
    muted: "#64748B",
    border: "#D7E8F7",
    surface: "#F5FAFF",
    canvas: "#FFFFFF",
    accent: "#0284C7",
    accentSoft: "#EAF7FF",
    onAccent: "#FFFFFF",
    codeText: "#E0F7FF",
    codeBackground: "#0B1020",
    codeHeader: "rgba(2,132,199,0.22)",
    inlineCodeText: "#BE185D",
    inlineCodeBackground: "rgba(2,132,199,0.10)",
    shadow: "0 8px 22px rgba(2,132,199,0.12)"
  },
  insight: {
    text: "#202124",
    heading: "#202124",
    muted: "#666a72",
    border: "#ddd7ce",
    surface: "#fbfaf7",
    canvas: "#ffffff",
    accent: "#6b5b45",
    accentSoft: "#f1eee8",
    onAccent: "#ffffff",
    codeText: "#1f2937",
    codeBackground: "#fbfaf7",
    codeHeader: "rgba(107,91,69,0.14)",
    inlineCodeText: "#5b4d3a",
    inlineCodeBackground: "rgba(107,91,69,0.12)",
    shadow: "0 2px 8px rgba(32,33,36,0.06)"
  },
  "academic-paper": {
    text: "#1a1a1a",
    heading: "#000000",
    muted: "#555555",
    border: "#dddddd",
    surface: "#fafafa",
    canvas: "#ffffff",
    accent: "#800000",
    accentSoft: "#fff3cd",
    onAccent: "#ffffff",
    codeText: "#1a1a1a",
    codeBackground: "#f7f7f7",
    codeHeader: "#eeeeee",
    inlineCodeText: "#800000",
    inlineCodeBackground: "#fff3cd",
    shadow: "none"
  },
  "aurora-glass": {
    text: "#444444",
    heading: "#333333",
    muted: "#666666",
    border: "#dcd8f2",
    surface: "#fbfaff",
    canvas: "#ffffff",
    accent: "#4158D0",
    accentSoft: "#f0f2ff",
    onAccent: "#ffffff",
    codeText: "#2b2b45",
    codeBackground: "#f6f4ff",
    codeHeader: "#ece8ff",
    inlineCodeText: "#C850C0",
    inlineCodeBackground: "#f6eafa",
    shadow: "none"
  },
  bauhaus: {
    text: "#333333",
    heading: "#111111",
    muted: "#555555",
    border: "#111111",
    surface: "#f9f9f9",
    canvas: "#ffffff",
    accent: "#D32F2F",
    accentSoft: "#FFF4CC",
    onAccent: "#ffffff",
    codeText: "#111111",
    codeBackground: "#f4f4f4",
    codeHeader: "#FBC02D",
    inlineCodeText: "#1976D2",
    inlineCodeBackground: "rgba(25,118,210,0.16)",
    shadow: "none"
  },
  "cyberpunk-neon": {
    text: "#444444",
    heading: "#12161F",
    muted: "#666666",
    border: "#00F3FF",
    surface: "rgba(0,243,255,0.06)",
    canvas: "#ffffff",
    accent: "#00A6B2",
    accentSoft: "rgba(0,243,255,0.12)",
    onAccent: "#12161F",
    codeText: "#E0F7FF",
    codeBackground: "#12161F",
    codeHeader: "rgba(0,243,255,0.22)",
    inlineCodeText: "#B00086",
    inlineCodeBackground: "rgba(255,0,193,0.10)",
    shadow: "none"
  },
  "knowledge-base": {
    text: "#37352F",
    heading: "#37352F",
    muted: "#6b6963",
    border: "#E3E2E0",
    surface: "#F7F6F3",
    canvas: "#ffffff",
    accent: "#37352F",
    accentSoft: "#F1F1EF",
    onAccent: "#ffffff",
    codeText: "#37352F",
    codeBackground: "#F7F6F3",
    codeHeader: "#ECEBE8",
    inlineCodeText: "#EB5757",
    inlineCodeBackground: "#F1F1EF",
    shadow: "none"
  },
  "luxury-gold": {
    text: "#444444",
    heading: "#000000",
    muted: "#666666",
    border: "#D8C69A",
    surface: "#ffffff",
    canvas: "#ffffff",
    accent: "#9E8045",
    accentSoft: "#f7f0df",
    onAccent: "#ffffff",
    codeText: "#3a3325",
    codeBackground: "#faf7ef",
    codeHeader: "#efe4c8",
    inlineCodeText: "#9E8045",
    inlineCodeBackground: "#f7f0df",
    shadow: "none"
  },
  "morandi-forest": {
    text: "#3A4D39",
    heading: "#1A261D",
    muted: "#556B58",
    border: "#739072",
    surface: "#F6F8F6",
    canvas: "#ffffff",
    accent: "#4F6F52",
    accentSoft: "#F1F4F0",
    onAccent: "#ffffff",
    codeText: "#2F3E32",
    codeBackground: "#F6F8F6",
    codeHeader: "#E8EBE9",
    inlineCodeText: "#4F6F52",
    inlineCodeBackground: "#F1F4F0",
    shadow: "none"
  },
  "neo-brutalism": {
    text: "#000000",
    heading: "#000000",
    muted: "#222222",
    border: "#000000",
    surface: "#f4f4f4",
    canvas: "#ffffff",
    accent: "#6A00FF",
    accentSoft: "#CCFF00",
    onAccent: "#ffffff",
    codeText: "#000000",
    codeBackground: "#f4f4f4",
    codeHeader: "#CCFF00",
    inlineCodeText: "#6A00FF",
    inlineCodeBackground: "#CCFF00",
    shadow: "none"
  },
  receipt: {
    text: "#222222",
    heading: "#000000",
    muted: "#555555",
    border: "#111111",
    surface: "#f8f8f8",
    canvas: "#ffffff",
    accent: "#000000",
    accentSoft: "#eeeeee",
    onAccent: "#ffffff",
    codeText: "#111111",
    codeBackground: "#f8f8f8",
    codeHeader: "#dddddd",
    inlineCodeText: "#000000",
    inlineCodeBackground: "#dddddd",
    shadow: "none"
  },
  "sunset-film": {
    text: "#5D4037",
    heading: "#4A3B32",
    muted: "#6D4C41",
    border: "#D98C45",
    surface: "#FFF8E7",
    canvas: "#ffffff",
    accent: "#B33D25",
    accentSoft: "#F7EED6",
    onAccent: "#FFFBF0",
    codeText: "#4A3B32",
    codeBackground: "#FFF8E7",
    codeHeader: "#F7EED6",
    inlineCodeText: "#B33D25",
    inlineCodeBackground: "#F7EED6",
    shadow: "none"
  }
};

const lifeTheme = makeTheme({
  name: "life",
  description: "生活分享：温润、轻松、有留白，适合日常记录、旅行、读书观影和个人感悟",
  palette: palettes.life,
  presentationStyle: "elegant"
});

export const techTheme = makeTheme({
  name: "tech",
  description: "技术分享：白底高可读、青色技术点缀和清晰代码块，适合工程实践、教程、源码解析和工具链文章",
  palette: palettes.tech,
  presentationStyle: "bold",
  typography: {
    fontFamily: "'JetBrains Mono','SF Mono',Menlo,Consolas,'PingFang SC','Hiragino Sans GB',monospace",
    headingSize: "21px",
    lineHeight: "1.72"
  }
});

const insightTheme = makeTheme({
  name: "insight",
  description: "观点长文：克制、专栏感、结构清楚，适合复盘、方法论、产品观察和行业评论",
  palette: palettes.insight,
  presentationStyle: "minimal",
  typography: {
    headingSize: "21px",
    lineHeight: "1.76"
  }
});

const academicPaperTheme = makeTheme({
  name: "academic-paper",
  description: "WeMD 学术论文：宋体/衬线、黑白论文层级，适合研究笔记、报告和严肃长文",
  palette: palettes["academic-paper"],
  presentationStyle: "minimal",
  typography: {
    fontFamily: "\"Times New Roman\",\"Songti SC\",\"SimSun\",serif",
    headingSize: "18px",
    lineHeight: "1.7"
  }
});

export const auroraGlassTheme = makeTheme({
  name: "aurora-glass",
  description: "WeMD 极光玻璃：蓝紫粉文字渐变与轻盈浅色块，适合趋势、品牌和现代视觉文章",
  palette: palettes["aurora-glass"],
  presentationStyle: "elegant",
  spacing: { paragraph: "22px" },
  typography: {
    lineHeight: "1.9"
  }
});

const bauhausTheme = makeTheme({
  name: "bauhaus",
  description: "WeMD 包豪斯：红蓝黄几何高对比，适合设计、品牌和观点文章",
  palette: palettes.bauhaus,
  presentationStyle: "bold",
  spacing: { paragraph: "24px" },
  typography: {
    lineHeight: "1.8"
  }
});

const cyberpunkNeonTheme = makeTheme({
  name: "cyberpunk-neon",
  description: "WeMD 赛博朋克：青色与品红技术感，已去除渐变和发光等不稳定 CSS",
  palette: palettes["cyberpunk-neon"],
  presentationStyle: "bold",
  spacing: { paragraph: "22px" },
  typography: {
    headingSize: "20px",
    lineHeight: "1.75"
  }
});

export const knowledgeBaseTheme = makeTheme({
  name: "knowledge-base",
  description: "WeMD 知识库：Notion 风格浅灰块、清晰结构，适合教程、手册和知识沉淀",
  palette: palettes["knowledge-base"],
  presentationStyle: "minimal",
  typography: {
    headingSize: "22px",
    lineHeight: "1.75"
  }
});

export const luxuryGoldTheme = makeTheme({
  name: "luxury-gold",
  description: "WeMD 黑金奢华：宋体留白与金色细线，适合品牌、审美和高质感长文",
  palette: palettes["luxury-gold"],
  presentationStyle: "focus",
  spacing: { paragraph: "30px" },
  typography: {
    fontFamily: "\"Songti SC\",\"SimSun\",\"STSong\",Georgia,serif",
    headingSize: "19px",
    lineHeight: "2"
  }
});

const morandiForestTheme = makeTheme({
  name: "morandi-forest",
  description: "WeMD 莫兰迪森林：低饱和绿色、安静自然，适合生活方式和读书笔记",
  palette: palettes["morandi-forest"],
  presentationStyle: "elegant",
  spacing: { paragraph: "26px" },
  typography: {
    fontFamily: "Optima,Georgia,\"PingFang SC\",\"Microsoft YaHei\",serif",
    headingSize: "19px",
    lineHeight: "2"
  }
});

const neoBrutalismTheme = makeTheme({
  name: "neo-brutalism",
  description: "WeMD 新粗野主义：黑边框、荧光黄和电光紫，保留高对比但去除硬阴影",
  palette: palettes["neo-brutalism"],
  presentationStyle: "bold",
  spacing: { paragraph: "24px" },
  typography: {
    headingSize: "20px",
    lineHeight: "1.8"
  }
});

const receiptTheme = makeTheme({
  name: "receipt",
  description: "WeMD 购物小票：等宽字体、虚线票据感，适合清单、复盘和轻量记录",
  palette: palettes.receipt,
  presentationStyle: "focus",
  spacing: { paragraph: "18px" },
  typography: {
    fontFamily: "\"Courier New\",\"SimSun\",\"Songti SC\",monospace",
    bodySize: "15px",
    headingSize: "18px",
    lineHeight: "1.6"
  }
});

export const sunsetFilmTheme = makeTheme({
  name: "sunset-film",
  description: "WeMD 落日胶片：陶土红和旧纸色，适合影评、随笔和叙事文章",
  palette: palettes["sunset-film"],
  presentationStyle: "elegant",
  spacing: { paragraph: "26px" },
  typography: {
    fontFamily: "\"Songti SC\",\"SimSun\",\"STSong\",Georgia,serif",
    headingSize: "19px",
    lineHeight: "1.9"
  }
});

export const defaultTheme = knowledgeBaseTheme;

export const themes: Record<string, Theme> = Object.fromEntries([
  techTheme,
  auroraGlassTheme,
  knowledgeBaseTheme,
  luxuryGoldTheme,
  sunsetFilmTheme
].map((theme) => [theme.name, theme]));

export function resolveTheme(themeName: string | undefined): Theme {
  if (!themeName) {
    return defaultTheme;
  }

  const theme = themes[themeName];
  if (!theme) {
    console.warn(`[wechat-publisher] unknown theme="${themeName}", fallback="${defaultTheme.name}".`);
    return defaultTheme;
  }
  return theme;
}

function makeTheme(recipe: ThemeRecipe): Theme {
  const colors = withSemanticColors(recipe.name, recipe.palette);
  const typography = {
    ...baseTypography,
    ...recipe.typography
  };
  const spacing = {
    ...baseSpacing,
    ...recipe.spacing
  };
  const presentation = presentationByStyle[recipe.presentationStyle];
  return {
    name: recipe.name,
    description: recipe.description,
    styleSheet: buildWechatThemeStyleSheet({
      name: recipe.name,
      colors,
      fontFamily: typography.fontFamily,
      bodySize: typography.bodySize,
      smallSize: typography.smallSize,
      lineHeight: typography.lineHeight,
      presentationStyle: presentation.style,
      radius: presentation.radius
    }),
    colors,
    spacing,
    typography,
    presentation
  };
}

function withSemanticColors(themeName: string, palette: ThemePalettePreset): ThemeColors {
  const semanticColors = calloutSemanticColors(themeName);
  return {
    ...palette,
    ...semanticColors
  };
}

function calloutSemanticColors(themeName: string): Pick<ThemeColors, "info" | "tip" | "warning" | "success" | "danger"> {
  if (themeName === "tech") {
    return {
      info: "#0284C7",
      tip: "#7C3AED",
      warning: "#D97706",
      success: "#15803D",
      danger: "#BE123C"
    };
  }
  if (themeName === "insight") {
    return {
      info: "#2563eb",
      tip: "#7c3aed",
      warning: "#b45309",
      success: "#15803d",
      danger: "#b91c1c"
    };
  }
  return {
    info: "#1677a3",
    tip: "#7c4d9e",
    warning: "#ad6800",
    success: "#237804",
    danger: "#a8071a"
  };
}
