import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticleDocument, renderMarkdownArticle, themes } from "../dist/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewDir = path.join(projectRoot, "previews");
const articlePath = path.join(projectRoot, "tests", "fixtures", "template-gallery.md");
const indexPath = path.join(previewDir, "template-gallery-index.html");
fs.mkdirSync(previewDir, { recursive: true });
const markdown = fs.readFileSync(articlePath, "utf8");
const article = parseArticleDocument(markdown, articlePath);
const themeEntries = Object.values(themes);

for (const fileName of fs.readdirSync(previewDir)) {
  if (/^template-gallery-[a-z0-9-]+\.html$/.test(fileName)) {
    fs.unlinkSync(path.join(previewDir, fileName));
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function previewFileName(themeName) {
  return `template-gallery-${themeName}.html`;
}

function wrapContentPreview(content, title) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#f5f5f5;">
  <main style="max-width:680px;margin:0 auto;padding:28px 18px;background:#ffffff;">
${content}
  </main>
</body>
</html>
`;
}

function renderIndex() {
  const defaultFileName = previewFileName(themeEntries[0].name);
  const options = themeEntries.map((theme) => {
    return `<option value="${escapeHtml(previewFileName(theme.name))}">${escapeHtml(theme.name)} · ${escapeHtml(theme.description)}</option>`;
  }).join("\n          ");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>微信公众号内容预览</title>
    <style>
      :root {
        color-scheme: light;
        --text: #1f2329;
        --muted: #646a73;
        --border: #dfe3e8;
        --surface: #f7f8fa;
        --accent: #2563eb;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        overflow-x: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
        color: var(--text);
        background: #ffffff;
      }

      header {
        padding: 22px 24px 16px;
        border-bottom: 1px solid var(--border);
      }

      h1 {
        margin: 0;
        font-size: 22px;
        line-height: 1.4;
      }

      .summary {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.8;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 14px;
      }

      select,
      a {
        min-height: 38px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: #fff;
        font-size: 13px;
      }

      select {
        min-width: min(620px, 100%);
        padding: 0 10px;
      }

      a {
        display: inline-flex;
        align-items: center;
        padding: 0 10px;
        color: var(--accent);
        text-decoration: none;
      }

      main {
        padding: 16px;
        background: var(--surface);
        min-height: calc(100vh - 146px);
      }

      iframe {
        display: block;
        width: 100%;
        min-height: calc(100vh - 178px);
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
      }

      @media (max-width: 640px) {
        header {
          padding: 18px 16px 14px;
        }

        select,
        a {
          width: 100%;
        }

        main {
          padding: 10px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>微信公众号内容预览</h1>
      <p class="summary">同一篇完整文章按当前主题注册表渲染，便于检查正文、标题、代码、图片和 layout 模块在不同主题下的整体效果。</p>
      <div class="toolbar">
        <select id="themeSelect" aria-label="选择主题">
          ${options}
        </select>
        <a id="openLink" href="${escapeHtml(defaultFileName)}">打开当前主题</a>
      </div>
    </header>
    <main>
      <iframe id="previewFrame" title="内容预览" src="${escapeHtml(defaultFileName)}"></iframe>
    </main>
    <script>
      const select = document.getElementById("themeSelect");
      const frame = document.getElementById("previewFrame");
      const link = document.getElementById("openLink");

      select.addEventListener("change", () => {
        frame.src = select.value;
        link.href = select.value;
      });
    </script>
  </body>
</html>
`;
}

for (const theme of themeEntries) {
  const rendered = renderMarkdownArticle(article.body, theme);
  const outputPath = path.join(previewDir, previewFileName(theme.name));
  fs.writeFileSync(outputPath, wrapContentPreview(rendered.html, `${article.metadata.title} · ${theme.name}`));
}

fs.writeFileSync(indexPath, renderIndex());
console.log(indexPath);
