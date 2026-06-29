import { describe, expect, it } from "vitest";
import { renderMarkdownArticle } from "../src/markdown-renderer.js";
import { auroraGlassTheme, defaultTheme, knowledgeBaseTheme, resolveTheme, techTheme, themes } from "../src/themes.js";

describe("wechat article themes", () => {
  it("keeps a focused five-theme set for common WeChat article scenarios", () => {
    expect(Object.keys(themes)).toEqual([
      "tech",
      "aurora-glass",
      "knowledge-base",
      "luxury-gold",
      "sunset-film"
    ]);
    expect(defaultTheme).toBe(knowledgeBaseTheme);
  });

  it("uses knowledge-base as the readable default for WeChat articles", () => {
    expect(defaultTheme.name).toBe("knowledge-base");
    expect(defaultTheme.typography.bodySize).toBe("16px");
    expect(defaultTheme.typography.lineHeight).toBe("1.75");
    expect(defaultTheme.colors.text).toBe("#37352F");
    expect(defaultTheme.colors.accent).toBe("#37352F");
    expect(contrastRatio(defaultTheme.colors.text, "#ffffff")).toBeGreaterThan(12);
  });

  it("gives technical articles a white high-readability code treatment", () => {
    const html = renderMarkdownArticle(`## 代码块预览

这里有一段行内代码：\`theme: "tech"\`。

\`\`\`ts
const theme = "tech";
\`\`\`
`, techTheme).html;

    expect(html).toContain(`background-color:${techTheme.colors.canvas}`);
    expect(html).toContain(`border-left:5px solid ${techTheme.colors.accent}`);
    expect(html).not.toContain(`background:${techTheme.colors.surface};border:1px solid ${techTheme.colors.border}`);
    expect(html).toContain(`color:${techTheme.colors.codeText}`);
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("box-shadow");
  });

  it("falls back to the readable default for unknown themes with a warning instead of silently selecting an old theme", () => {
    const theme = resolveTheme("elegant-gold");

    expect(theme).toBe(knowledgeBaseTheme);
  });

  it("renders migrated WeMD themes as inline WeChat-safe HTML without CSS runtime features", () => {
    const html = renderMarkdownArticle(`## 知识库主题

正文 **重点** 和 \`inline code\`。

> 一个提示块。
`, knowledgeBaseTheme).html;

    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain("background:#F1F1EF");
    expect(html).toContain(`border-left:3px solid ${knowledgeBaseTheme.colors.accent}`);
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
    expect(html).not.toContain('id="wemd"');
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("position:");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("clip-path");
  });

  it("preserves WeMD-style aurora glass text gradients after inlining", () => {
    const html = renderMarkdownArticle(`# 极光玻璃标题

正文 **重点文字**。
`, auroraGlassTheme).html;

    expect(html).toContain("background-image:linear-gradient(135deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)");
    expect(html).toContain("-webkit-background-clip:text");
    expect(html).toContain("background-clip:text");
    expect(html).toContain("color:transparent");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("position:");
    expect(html).not.toContain("box-shadow");
  });
});

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
