import { styleRecord } from "./html.js";
import type { ThemeColors, ThemePresentationStyle } from "./types.js";

export interface ThemeStyleRecipe {
  name: string;
  colors: ThemeColors;
  fontFamily: string;
  bodySize: string;
  smallSize: string;
  lineHeight: string;
  presentationStyle: ThemePresentationStyle;
  radius: string;
}

export function buildWechatThemeStyleSheet(recipe: ThemeStyleRecipe): string {
  const headingStyle = headingStyleFor(recipe);
  const strongStyle = strongStyleFor(recipe);
  return `
#wemd {
  ${cssBlock({
    "box-sizing": "border-box",
    "width": "100%",
    "max-width": "680px",
    "margin": "0 auto",
    "padding": "16px",
    "background-color": recipe.colors.canvas,
    "font-family": recipe.fontFamily,
    "font-size": recipe.bodySize,
    "line-height": recipe.lineHeight,
    "color": recipe.colors.text,
    "word-break": "break-word",
    "text-align": "left"
  })}
}
#wemd p {
  ${cssBlock({
    "margin": "14px 0",
    "font-size": recipe.bodySize,
    "line-height": recipe.lineHeight,
    "color": recipe.colors.text,
    "letter-spacing": "0"
  })}
}
#wemd h1 {
  ${cssBlock({
    ...headingStyle,
    "font-size": "24px",
    "margin": "28px 0 14px"
  })}
}
#wemd h2 {
  ${cssBlock({
    ...headingStyle,
    "font-size": "21px",
    "margin": "28px 0 12px"
  })}
}
#wemd h3, #wemd h4, #wemd h5, #wemd h6 {
  ${cssBlock({
    ...headingStyle,
    "font-size": "18px",
    "margin": "24px 0 10px"
  })}
}
#wemd strong {
  ${cssBlock(strongStyle)}
}
#wemd a {
  ${cssBlock({
    "color": recipe.colors.accent,
    "text-decoration": "none"
  })}
}
#wemd blockquote {
  ${cssBlock({
    "margin": "22px 0",
    "padding": "10px 0 10px 14px",
    "border-left": `3px solid ${recipe.colors.accent}`,
    "background": recipe.colors.canvas,
    "color": recipe.colors.muted,
    "font-size": recipe.bodySize,
    "line-height": recipe.lineHeight
  })}
}
#wemd ul, #wemd ol {
  ${cssBlock({
    "margin": "14px 0",
    "padding-left": "22px",
    "color": recipe.colors.text,
    "font-size": recipe.bodySize,
    "line-height": recipe.lineHeight
  })}
}
#wemd li {
  ${cssBlock({
    "margin": "0",
    "line-height": recipe.lineHeight
  })}
}
#wemd li p {
  ${cssBlock({
    "margin": "0",
    "line-height": recipe.lineHeight
  })}
}
#wemd code {
  ${cssBlock({
    "font-family": "'SF Mono','JetBrains Mono',Consolas,Monaco,Menlo,monospace",
    "padding": "2px 7px",
    "background": recipe.colors.inlineCodeBackground,
    "color": recipe.colors.inlineCodeText,
    "border-radius": "4px",
    "font-size": "13px",
    "line-height": "1.5"
  })}
}
#wemd pre {
  ${cssBlock({
    "box-sizing": "border-box",
    "margin": "24px 0",
    "padding": "13px 14px",
    "background": recipe.colors.codeBackground,
    "border": `1px solid ${recipe.colors.border}`,
    "border-left": `4px solid ${recipe.colors.accent}`,
    "border-radius": recipe.radius,
    "overflow-x": "auto",
    "font-size": recipe.smallSize,
    "line-height": "1.65",
    "color": recipe.colors.codeText
  })}
}
#wemd pre code {
  ${cssBlock({
    "display": "block",
    "background": "none",
    "padding": "0",
    "color": recipe.colors.codeText,
    "font-size": recipe.smallSize,
    "line-height": "1.65",
    "white-space": "pre",
    "word-break": "normal",
    "overflow-wrap": "normal"
  })}
}
#wemd img {
  ${cssBlock({
    "display": "block",
    "max-width": "100%",
    "height": "auto",
    "margin": "0 auto",
    "border-radius": recipe.radius,
    "border": `1px solid ${recipe.colors.border}`
  })}
}
#wemd hr {
  ${cssBlock({
    "border": "0",
    "border-top": `1px solid ${recipe.colors.border}`,
    "margin": "26px 0"
  })}
}
`;
}

function headingStyleFor(recipe: ThemeStyleRecipe): Record<string, string> {
  if (recipe.name === "aurora-glass") {
    return {
      "display": "inline-block",
      "padding": "0 0 10px",
      "border-bottom": `2px solid ${recipe.colors.border}`,
      "background-image": "linear-gradient(135deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)",
      "-webkit-background-clip": "text",
      "background-clip": "text",
      "color": "transparent",
      "font-weight": "800",
      "line-height": "1.4"
    };
  }

  if (recipe.name === "tech") {
    return {
      "padding": "0 0 0 12px",
      "border-left": `5px solid ${recipe.colors.accent}`,
      "color": recipe.colors.heading,
      "font-weight": "800",
      "line-height": "1.45"
    };
  }

  if (recipe.presentationStyle === "bold") {
    return {
      "padding": "8px 12px",
      "border-radius": recipe.radius,
      "background": recipe.colors.accent,
      "color": recipe.colors.onAccent,
      "font-weight": "800",
      "line-height": "1.45"
    };
  }

  if (recipe.presentationStyle === "focus") {
    return {
      "padding": "8px 0",
      "border-top": `1px solid ${recipe.colors.border}`,
      "border-bottom": `1px solid ${recipe.colors.border}`,
      "text-align": "center",
      "color": recipe.colors.accent,
      "font-weight": "700",
      "line-height": "1.45"
    };
  }

  if (recipe.presentationStyle === "elegant") {
    return {
      "padding-left": "10px",
      "border-left": `4px double ${recipe.colors.accent}`,
      "color": recipe.colors.accent,
      "font-weight": "700",
      "line-height": "1.45"
    };
  }

  return {
    "padding-left": "10px",
    "border-left": `3px solid ${recipe.colors.accent}`,
    "color": recipe.colors.heading,
    "font-weight": "800",
    "line-height": "1.45"
  };
}

function strongStyleFor(recipe: ThemeStyleRecipe): Record<string, string> {
  if (recipe.name === "aurora-glass") {
    return {
      "font-weight": "700",
      "background-image": "linear-gradient(135deg, #4158D0 0%, #C850C0 100%)",
      "-webkit-background-clip": "text",
      "background-clip": "text",
      "color": "transparent",
      "margin": "0 1px"
    };
  }

  return {
    "color": recipe.colors.heading,
    "font-weight": "800"
  };
}

function cssBlock(styles: Record<string, string | undefined>): string {
  return styleRecord(styles).replaceAll(";", ";\n  ");
}
