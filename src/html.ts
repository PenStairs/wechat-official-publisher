export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("\n", " ");
}

export interface InlineMarkdownOptions {
  codeStyle?: string;
  linkStyle?: string;
}

export function inlineMarkdown(value: string, options: InlineMarkdownOptions = {}): string {
  let html = escapeHtml(value);
  const codeStyle = options.codeStyle ?? "background:#f6f8fa;border-radius:4px;padding:2px 4px;font-size:0.92em;";
  const linkStyle = options.linkStyle ?? "color:#576b95;text-decoration:none;";
  html = html.replace(/`([^`]+)`/g, `<code style="${codeStyle}">$1</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    return `<a href="${escapeAttribute(href)}" style="${linkStyle}">${label}</a>`;
  });
  return html;
}

export function styleRecord(styles: Record<string, string | undefined>): string {
  return Object.entries(styles)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "")
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

export function paragraphize(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => inlineMarkdown(line))
    .join("<br/>");
}

export function wrapPreviewDocument(content: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title || "WeChat Preview")}</title>
</head>
<body style="margin:0;background:#f5f5f5;">
  <main style="max-width:680px;margin:0 auto;padding:28px 18px;background:#ffffff;">
${content}
  </main>
</body>
</html>
`;
}
