import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listSupportedBlockMetadata, renderMarkdownArticle, themes } from "../dist/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(projectRoot, "previews", "block-gallery.html");
const localImage = "codex-parallel-dev-cover.png";
const blocks = listSupportedBlockMetadata();
const themeEntries = Object.values(themes);

function escapeJsonForHtml(value) {
  const replacements = {
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029"
  };

  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => replacements[character]);
}

function slug(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function normalizeExample(example = "") {
  return example
    .replaceAll("https://example.com/before.png", localImage)
    .replaceAll("https://example.com/after.png", localImage)
    .replaceAll("https://example.com/avatar.png", localImage)
    .replaceAll("https://example.com/qrcode.png", localImage)
    .replaceAll("https://example.com/step1.png", localImage)
    .replaceAll("https://example.com/step2.png", localImage)
    .replaceAll("https://example.com/screenshot.png", localImage)
    .replaceAll("https://example.com/image.png", localImage)
    .replace(/https:\/\/example\.com\/[a-z0-9._/-]+/gi, localImage)
    .trim();
}

function renderExample(block, example, theme) {
  if (!example) {
    return '<p class="empty-preview">无示例</p>';
  }

  try {
    return renderMarkdownArticle(example, theme).html;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[block-gallery] render failed block="${block.name}" theme="${theme.name}": ${message}`);
    return `<p class="empty-preview">渲染失败：${message}</p>`;
  }
}

function renderThemePreviews(block, example) {
  return Object.fromEntries(themeEntries.map((theme) => [theme.name, renderExample(block, example, theme)]));
}

function summarizeTheme(theme) {
  return {
    name: theme.name,
    description: theme.description,
    accent: theme.colors.accent,
    surface: theme.colors.surface,
    presentationStyle: theme.presentation.style
  };
}

function summarizeBlock(block) {
  const example = normalizeExample(block.example || "");

  return {
    id: slug(block.name),
    name: block.name,
    category: block.category || "layout",
    position: block.position || "body",
    bodyFormat: block.bodyFormat,
    renderingSupport: block.renderingSupport,
    example,
    previews: renderThemePreviews(block, example),
    details: {
      whenToUse: block.whenToUse || "",
      whenNotToUse: block.whenNotToUse || "",
      antiPattern: block.antiPattern || "",
      pairsWellWith: block.pairsWellWith,
      avoidCombiningWith: block.avoidCombiningWith,
      serves: block.serves,
      contentTypes: block.contentTypes,
      industry: block.industry,
      tags: block.tags,
      metadata: block.metadata,
      fields: block.fields,
      rows: block.rows
    }
  };
}

function galleryApp() {
  const dataElement = document.getElementById("galleryData");
  const data = JSON.parse(dataElement.textContent || "{}");
  const themeSelect = document.getElementById("themeSelect");
  const themeMeta = document.getElementById("themeMeta");
  const layoutList = document.getElementById("layoutList");
  const blockDetail = document.getElementById("blockDetail");
  const layoutCount = document.getElementById("layoutCount");
  const themeByName = new Map(data.themes.map((theme) => [theme.name, theme]));
  const blockById = new Map(data.blocks.map((block) => [block.id, block]));
  const state = {
    themeName: resolveThemeName(readStoredValue("wechatBlockGalleryTheme") || data.defaultTheme),
    blockId: resolveBlockId(decodeURIComponent(location.hash.slice(1)) || data.defaultBlockId)
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readStoredValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("[block-gallery] localStorage read failed, using default state.", error);
      return null;
    }
  }

  function rememberValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[block-gallery] localStorage write failed key="${key}" value="${value}".`, error);
    }
  }

  function resolveThemeName(themeName) {
    if (themeByName.has(themeName)) {
      return themeName;
    }

    if (themeName) {
      console.warn(`[block-gallery] unknown theme="${themeName}", fallback="${data.defaultTheme}".`);
    }
    return data.defaultTheme;
  }

  function resolveBlockId(blockId) {
    if (blockById.has(blockId)) {
      return blockId;
    }

    if (blockId) {
      console.warn(`[block-gallery] unknown layout="${blockId}", fallback="${data.defaultBlockId}".`);
    }
    return data.defaultBlockId;
  }

  function renderThemeOptions() {
    themeSelect.innerHTML = data.themes.map((theme) => {
      return `<option value="${escapeHtml(theme.name)}">${escapeHtml(theme.name)} · ${escapeHtml(theme.description)}</option>`;
    }).join("");
    themeSelect.value = state.themeName;
  }

  function renderThemeMeta() {
    const theme = themeByName.get(state.themeName);
    themeMeta.innerHTML = `
      <span class="theme-swatch" style="background:${escapeHtml(theme.accent)}"></span>
      <span>${escapeHtml(theme.presentationStyle)}</span>
      <span>${escapeHtml(theme.description)}</span>
    `;
  }

  function renderLayoutList() {
    layoutCount.textContent = `${data.blocks.length} 个 layout`;
    layoutList.innerHTML = data.blocks.map((block, index) => {
      const isActive = block.id === state.blockId;
      return `
        <button type="button" class="layout-item${isActive ? " active" : ""}" data-block-id="${escapeHtml(block.id)}" aria-current="${isActive ? "true" : "false"}">
          <span class="layout-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="layout-copy">
            <strong>${escapeHtml(block.name)}</strong>
            <span>${escapeHtml(block.category)} · ${escapeHtml(block.position)} · ${escapeHtml(block.bodyFormat)}</span>
          </span>
        </button>
      `;
    }).join("");
  }

  function renderSelectedBlock() {
    const block = blockById.get(state.blockId);
    const theme = themeByName.get(state.themeName);
    const preview = block.previews[state.themeName] || block.previews[data.defaultTheme];

    if (!block.previews[state.themeName]) {
      console.warn(`[block-gallery] preview missing layout="${block.id}" theme="${state.themeName}", fallback="${data.defaultTheme}".`);
    }

    blockDetail.innerHTML = `
      <div class="detail-head">
        <div>
          <p class="eyebrow">${escapeHtml(block.category)} · ${escapeHtml(block.position)} · ${escapeHtml(block.bodyFormat)}</p>
          <h2>${escapeHtml(block.name)}</h2>
        </div>
        <div class="detail-badges">
          <span>${escapeHtml(block.renderingSupport)}</span>
          <span>${escapeHtml(theme.name)}</span>
        </div>
      </div>

      <div class="example-grid">
        <section class="source-panel">
          <div class="section-head">
            <h3>示例代码</h3>
            <p>可直接放进 Markdown 文章里的 layout 代码</p>
          </div>
          <pre><code>${escapeHtml(block.example || "无示例")}</code></pre>
        </section>

        <section class="preview-panel">
          <div class="section-head">
            <h3>预览效果</h3>
            <p>当前主题：${escapeHtml(theme.name)}</p>
          </div>
          <div class="wechat-canvas">${preview}</div>
        </section>
      </div>

      ${renderReference(block)}
    `;

    renderLayoutList();
    history.replaceState(null, "", `#${encodeURIComponent(block.id)}`);
  }

  function renderReference(block) {
    const details = block.details;
    return `
      <section class="reference-panel">
        <div class="reference-grid">
          <section>
            <h3>使用说明</h3>
            ${renderParagraph("适合使用", details.whenToUse)}
            ${renderParagraph("不适合", details.whenNotToUse)}
            ${renderParagraph("反模式", details.antiPattern)}
          </section>
          <section>
            <h3>内容定位</h3>
            ${renderTagGroup("服务目标", details.serves)}
            ${renderTagGroup("内容类型", details.contentTypes)}
            ${renderTagGroup("行业", details.industry)}
            ${renderTagGroup("标签", details.tags)}
          </section>
          <section>
            <h3>组合建议</h3>
            ${renderTagGroup("适合搭配", details.pairsWellWith)}
            ${renderTagGroup("避免组合", details.avoidCombiningWith)}
          </section>
          <section>
            <h3>来源信息</h3>
            ${renderParagraph("作者", details.metadata.author)}
            ${renderParagraph("来源", details.metadata.provenance)}
            ${renderParagraph("灵感", details.metadata.inspiredBy)}
          </section>
        </div>

        <div class="schema-grid">
          <section>
            <h3>Required Fields</h3>
            ${renderFieldTable(details.fields.required)}
          </section>
          <section>
            <h3>Optional Fields</h3>
            ${renderFieldTable(details.fields.optional)}
          </section>
        </div>

        ${renderRowsSchema(details.rows)}
      </section>
    `;
  }

  function renderParagraph(label, value) {
    if (!value) {
      return `<div class="fact-row"><strong>${escapeHtml(label)}</strong><span class="empty">无</span></div>`;
    }

    return `<div class="fact-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value).replaceAll("\n", "<br>")}</span></div>`;
  }

  function renderTagGroup(label, values) {
    if (!values || values.length === 0) {
      return `<div class="fact-row"><strong>${escapeHtml(label)}</strong><span class="empty">无</span></div>`;
    }

    return `
      <div class="tag-group">
        <strong>${escapeHtml(label)}</strong>
        <div class="tags">${values.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join("")}</div>
      </div>
    `;
  }

  function renderFieldTable(fields) {
    if (!fields || fields.length === 0) {
      return '<p class="empty">无</p>';
    }

    const rows = fields.map((field) => {
      const enumValue = field.enum && field.enum.length > 0 ? field.enum.join(" / ") : "";
      return `
        <tr>
          <td><code>${escapeHtml(field.name)}</code></td>
          <td>${escapeHtml(field.description || "")}</td>
          <td>${escapeHtml(field.example || enumValue || "")}</td>
        </tr>
      `;
    }).join("");

    return `<table><thead><tr><th>字段</th><th>说明</th><th>示例</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderRowsSchema(rows) {
    if (!rows) {
      return "";
    }

    return `
      <section class="rows-panel">
        <h3>Rows Schema</h3>
        <p class="schema-note">delimiter: <code>${escapeHtml(rows.delimiter || "line")}</code> · minColumns: <code>${escapeHtml(rows.minColumns ?? "无")}</code></p>
        ${renderFieldTable(rows.columns)}
      </section>
    `;
  }

  themeSelect.addEventListener("change", () => {
    state.themeName = resolveThemeName(themeSelect.value);
    rememberValue("wechatBlockGalleryTheme", state.themeName);
    renderThemeMeta();
    renderSelectedBlock();
  });

  layoutList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-block-id]");
    if (!button) {
      return;
    }

    state.blockId = resolveBlockId(button.dataset.blockId);
    renderSelectedBlock();
  });

  window.addEventListener("hashchange", () => {
    state.blockId = resolveBlockId(decodeURIComponent(location.hash.slice(1)));
    renderSelectedBlock();
  });

  renderThemeOptions();
  renderThemeMeta();
  renderLayoutList();
  renderSelectedBlock();
}

const galleryData = {
  defaultTheme: themeEntries[0]?.name || "",
  defaultBlockId: slug(blocks[0]?.name || ""),
  themes: themeEntries.map(summarizeTheme),
  blocks: blocks.map(summarizeBlock)
};

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>微信公众号 Layout 预览</title>
    <style>
      :root {
        color-scheme: light;
        --text: #18181b;
        --muted: #60646c;
        --quiet: #858b98;
        --border: #e3e5ea;
        --surface: #f6f7f9;
        --surface-strong: #ffffff;
        --accent: #2f7d68;
        --accent-soft: #eaf5f0;
        --shadow: 0 12px 30px rgba(17, 24, 39, 0.08);
      }

      * { box-sizing: border-box; }

      html { min-height: 100%; }

      body {
        min-height: 100dvh;
        margin: 0;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        color: var(--text);
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
      }

      header {
        flex: 0 0 auto;
        padding: 20px 28px 16px;
        border-bottom: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(10px);
      }

      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.36;
      }

      .summary {
        max-width: 980px;
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.75;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        margin-top: 14px;
      }

      label {
        color: var(--text);
        font-size: 13px;
        font-weight: 700;
      }

      select {
        min-width: min(560px, 100%);
        min-height: 44px;
        padding: 0 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
        color: var(--text);
        font-size: 14px;
      }

      select:focus-visible,
      button:focus-visible {
        outline: 3px solid rgba(47, 125, 104, 0.22);
        outline-offset: 2px;
      }

      .theme-meta {
        display: inline-flex;
        flex: 1 1 320px;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .theme-swatch {
        width: 12px;
        height: 28px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 999px;
      }

      .app-shell {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
      }

      aside {
        min-height: 0;
        border-right: 1px solid var(--border);
        background: var(--surface);
        overflow: auto;
      }

      .sidebar-head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
        border-bottom: 1px solid var(--border);
        background: rgba(246, 247, 249, 0.96);
        backdrop-filter: blur(10px);
      }

      .sidebar-head strong {
        font-size: 14px;
      }

      .sidebar-head span {
        color: var(--muted);
        font-size: 12px;
      }

      .layout-list {
        display: grid;
        gap: 8px;
        padding: 12px;
      }

      .layout-item {
        width: 100%;
        min-height: 58px;
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 9px 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
        color: var(--text);
        text-align: left;
        cursor: pointer;
      }

      .layout-item:hover {
        border-color: #b7c9c2;
        background: #fbfdfc;
      }

      .layout-item.active {
        border-color: var(--accent);
        background: var(--accent-soft);
        box-shadow: 0 0 0 2px rgba(47, 125, 104, 0.12);
      }

      .layout-index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: var(--surface);
        color: var(--muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      .layout-item.active .layout-index {
        background: #ffffff;
        color: var(--accent);
        font-weight: 800;
      }

      .layout-copy {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .layout-copy strong {
        overflow: hidden;
        color: var(--text);
        font-size: 13px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .layout-copy span {
        overflow: hidden;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .workspace {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        background: #fff;
      }

      .detail-panel {
        max-width: 1280px;
        margin: 0 auto;
        padding: 20px 24px 34px;
      }

      .detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--border);
      }

      .eyebrow {
        margin: 0 0 5px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        line-height: 1.4;
      }

      h2 {
        margin: 0;
        font-size: 26px;
        line-height: 1.35;
      }

      h3 {
        margin: 0;
        font-size: 15px;
        line-height: 1.4;
      }

      p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .detail-badges,
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .detail-badges span,
      .tag {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 4px 8px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: #fff;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.2;
      }

      .example-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
        gap: 16px;
        align-items: start;
      }

      .source-panel,
      .preview-panel,
      .reference-panel {
        min-width: 0;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
      }

      .source-panel,
      .preview-panel {
        overflow: hidden;
      }

      .section-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        background: #fbfbfc;
      }

      .section-head p {
        max-width: 300px;
        text-align: right;
      }

      pre {
        min-height: 520px;
        max-height: calc(100dvh - 302px);
        margin: 0;
        padding: 14px;
        overflow: auto;
        background: #fff;
        color: #24272d;
        font-size: 12px;
        line-height: 1.7;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
      }

      .preview-panel {
        background: var(--surface);
      }

      .wechat-canvas {
        max-height: calc(100dvh - 302px);
        min-height: 520px;
        overflow: auto;
        padding: 18px;
        background: #f3f4f6;
      }

      .wechat-canvas > section {
        max-width: 680px;
        margin: 0 auto;
        padding: 22px 18px;
        background: #fff;
        box-shadow: var(--shadow);
      }

      .wechat-canvas img {
        max-width: 100%;
      }

      .reference-panel {
        margin-top: 16px;
        padding: 14px;
        background: #fff;
      }

      .reference-grid,
      .schema-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .schema-grid {
        margin-top: 12px;
      }

      .reference-grid > section,
      .schema-grid > section,
      .rows-panel {
        min-width: 0;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
      }

      .fact-row,
      .tag-group {
        display: grid;
        gap: 5px;
        margin-top: 10px;
      }

      .fact-row strong,
      .tag-group strong {
        color: var(--text);
        font-size: 12px;
        line-height: 1.4;
      }

      .fact-row span {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }

      table {
        width: 100%;
        margin-top: 10px;
        border-collapse: collapse;
        background: #fff;
        font-size: 12px;
        line-height: 1.6;
      }

      th,
      td {
        padding: 7px 8px;
        border: 1px solid var(--border);
        text-align: left;
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-weight: 800;
        background: #fff;
      }

      .rows-panel {
        margin-top: 12px;
      }

      .schema-note {
        margin-top: 8px;
      }

      .empty,
      .empty-preview {
        color: var(--quiet);
        font-size: 12px;
      }

      @media (max-width: 980px) {
        body {
          display: block;
        }

        header {
          padding: 18px 16px 14px;
        }

        .app-shell {
          display: block;
        }

        aside {
          max-height: 310px;
          border-right: 0;
          border-bottom: 1px solid var(--border);
        }

        .layout-list {
          grid-template-columns: 1fr;
        }

        .detail-panel {
          padding: 16px;
        }

        .detail-head,
        .section-head {
          display: grid;
        }

        .section-head p {
          max-width: none;
          text-align: left;
        }

        .example-grid,
        .reference-grid,
        .schema-grid {
          grid-template-columns: 1fr;
        }

        pre,
        .wechat-canvas {
          min-height: 360px;
          max-height: none;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>微信公众号 Layout 预览</h1>
      <p class="summary">左侧选择某一个 layout，右侧只展示它的示例代码、当前主题下的预览效果和完整字段说明。颜色、字体和整体气质由主题控制，因此可以在这里直接切换主题观察同一个 layout 的变化。</p>
      <div class="toolbar">
        <label for="themeSelect">主题</label>
        <select id="themeSelect" aria-label="选择主题"></select>
        <div id="themeMeta" class="theme-meta" aria-live="polite"></div>
      </div>
    </header>
    <main class="app-shell">
      <aside aria-label="Layout 列表">
        <div class="sidebar-head">
          <strong>Layout 列表</strong>
          <span id="layoutCount"></span>
        </div>
        <div id="layoutList" class="layout-list"></div>
      </aside>
      <section class="workspace" aria-label="Layout 详情">
        <article id="blockDetail" class="detail-panel" aria-live="polite"></article>
      </section>
    </main>
    <script type="application/json" id="galleryData">${escapeJsonForHtml(galleryData)}</script>
    <script>(${galleryApp.toString()})();</script>
  </body>
</html>
`;

fs.writeFileSync(outPath, html);
console.log(outPath);
