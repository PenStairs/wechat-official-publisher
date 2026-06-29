import MarkdownIt from "markdown-it";
import juice from "juice";
import { parseLayoutBlockOpen, renderLayoutBlock } from "./block-renderer.js";
import type { LayoutBlock, RenderedArticle, RenderedImage, Theme } from "./types.js";

interface MarkdownRenderInput {
  markdown: string;
  theme: Theme;
}

interface PreparedMarkdown {
  markdown: string;
  images: RenderedImage[];
}

const markdownParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false
});

const unstableStyleProperties = new Set([
  "box-shadow",
  "clip-path",
  "float",
  "position",
  "transform"
]);

const unsupportedStyleValuePatterns = [
  /display\s*:\s*(flex|grid|inline-flex|inline-grid)/i,
  /repeating-linear-gradient/i,
  /calc\s*\(/i,
  /var\s*\(/i,
  /\b-?\d*\.?\d+v[wh]\b/i
];

export function renderMarkdownArticle(markdown: string, theme: Theme): RenderedArticle {
  return renderWechatArticle({ markdown, theme });
}

function renderWechatArticle(input: MarkdownRenderInput): RenderedArticle {
  // 将业务 layout 先渲染为单列内联 HTML，普通 Markdown 继续交给 markdown-it。
  const normalizedMarkdown = extractRenderableHtmlBody(input.markdown).trim();
  const prepared = prepareMarkdownForWechatRendering(normalizedMarkdown, input.theme);
  const semanticHtml = markdownParser.render(prepared.markdown).trim();
  const wrappedHtml = `<section id="wemd">${semanticHtml}</section>`;

  // 参考 WeMD 的可靠路径：CSS 主题先作用于语义 HTML，再统一内联成公众号可复制 HTML。
  const inlinedHtml = juice.inlineContent(wrappedHtml, input.theme.styleSheet, {
    inlinePseudoElements: false,
    preserveImportant: true
  });

  return {
    html: sanitizeWechatHtml(inlinedHtml),
    images: prepared.images
  };
}

function prepareMarkdownForWechatRendering(markdown: string, theme: Theme): PreparedMarkdown {
  const lines = markdown.split("\n");
  const preparedLines: string[] = [];
  const images: RenderedImage[] = [];

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    const layoutOpen = parseLayoutBlockOpen(trimmed, index + 1);

    if (layoutOpen) {
      const block: LayoutBlock = {
        ...layoutOpen,
        body: []
      };
      index++;
      while (index < lines.length && lines[index].trim() !== ":::") {
        block.body.push(lines[index]);
        index++;
      }
      if (index >= lines.length) {
        console.warn(`[wechat-publisher] layout block is not closed module="${block.name}" line=${block.line ?? 0}; rendering collected body.`);
      }
      preparedLines.push(renderLayoutBlock(block, theme));
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (image) {
      images.push({
        alt: image[1],
        source: image[2]
      });
    }

    preparedLines.push(rawLine);
  }

  return {
    markdown: preparedLines.join("\n"),
    images
  };
}

function sanitizeWechatHtml(html: string): string {
  return trimArticleShellWhitespace(html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s(?:class|id)="[^"]*"/gi, "")
    .replace(/<input\b[^>]*checked[^>]*>/gi, "✅&nbsp;")
    .replace(/<input\b[^>]*>/gi, "⬜&nbsp;")
    .replace(/\sstyle="([^"]*)"/gi, (_match, styleValue: string) => {
      const stableStyle = sanitizeStyleAttribute(styleValue);
      return stableStyle ? ` style="${stableStyle}"` : "";
    }));
}

function extractRenderableHtmlBody(markdown: string): string {
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(markdown);
  if (bodyMatch) {
    return bodyMatch[1];
  }

  return markdown
    .replace(/^\s*<!doctype\b[^>]*>\s*/i, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>\s*/gi, "")
    .replace(/<\/?html\b[^>]*>\s*/gi, "")
    .replace(/<\/?body\b[^>]*>\s*/gi, "");
}

function trimArticleShellWhitespace(html: string): string {
  return html
    .trim()
    .replace(/^(\s*<section\b[^>]*>)\s+/i, "$1")
    .replace(/\s+(<\/section>\s*)$/i, "$1");
}

function sanitizeStyleAttribute(styleValue: string): string {
  const declarations = styleValue
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);
  const stableDeclarations: string[] = [];

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    const normalizedDeclaration = `${property}:${value}`;

    if (property.startsWith("--") || unstableStyleProperties.has(property)) {
      continue;
    }
    if (isUnsupportedStyleDeclaration(property, normalizedDeclaration)) {
      continue;
    }
    stableDeclarations.push(normalizedDeclaration);
  }

  return stableDeclarations.join(";");
}

function isUnsupportedStyleDeclaration(property: string, normalizedDeclaration: string): boolean {
  if (unsupportedStyleValuePatterns.some((pattern) => pattern.test(normalizedDeclaration))) {
    return true;
  }

  if (!/linear-gradient/i.test(normalizedDeclaration)) {
    return false;
  }

  return property !== "background-image";
}
