import { escapeAttribute, escapeHtml, inlineMarkdown, paragraphize, styleRecord } from "./html.js";
import type { LayoutBlock, LayoutValidationIssue, LayoutValidationReport, SupportedBlockMetadata, Theme } from "./types.js";
import { getSupportedBlockMetadata } from "./layout-assets.js";

interface JsonParseSuccess {
  ok: true;
  value: unknown;
}

interface JsonParseFailure {
  ok: false;
  error: string;
}

type JsonParseResult = JsonParseSuccess | JsonParseFailure;

interface BlockValidationInput {
  block: LayoutBlock;
  metadata: SupportedBlockMetadata;
  report: LayoutValidationReport;
}

interface RowCardRenderingOptions {
  title: string;
  primaryIndex: number;
  secondaryIndex?: number;
  detailIndexes?: number[];
  accentIndex?: number;
  linkIndex?: number;
}

interface EmbeddedContentCardStyle {
  background: string;
  shadow: string;
}

interface LayoutVisualTokens {
  text: string;
  heading: string;
  muted: string;
  border: string;
  subtleBorder: string;
  surface: string;
  canvas: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  onAccent: string;
  shadow: string;
  rgb: string;
}

interface CalloutToneTokens {
  label: string;
  accent: string;
  background: string;
  border: string;
}

const layoutDisplayNames: Record<string, string> = {
  "author-card": "作者介绍",
  "image-text": "图文说明",
  "section": "章节",
  "toc": "目录",
};

export function parseLayoutBlocks(markdown: string): LayoutBlock[] {
  const lines = markdown.split("\n");
  const blocks: LayoutBlock[] = [];

  for (let index = 0; index < lines.length; index++) {
    const opener = parseLayoutBlockOpen(lines[index].trim(), index + 1);
    if (!opener) {
      continue;
    }

    const body: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].trim() !== ":::") {
      body.push(lines[cursor]);
      cursor++;
    }
    blocks.push({
      ...opener,
      body,
    });
    index = cursor;
  }

  return blocks;
}

export function validateLayoutBlocks(markdown: string): LayoutValidationReport {
  const report: LayoutValidationReport = {
    errors: [],
    warnings: []
  };

  for (const block of parseLayoutBlocks(markdown)) {
    const metadata = getSupportedBlockMetadata(block.name);
    if (!metadata) {
      report.errors.push({
        module: block.name,
        line: block.line ?? 0,
        message: "unknown layout module"
      });
      continue;
    }

    // 按本地 layout catalog 的 body_format 选择校验路径，避免 JSON 模块被当成普通 fields 误判。
    validateKnownLayoutBlock({ block, metadata, report });
  }

  return report;
}

export function parseLayoutBlockOpen(line: string, lineNumber: number): Omit<LayoutBlock, "body"> | undefined {
  const match = /^:::([a-z][a-z0-9_-]*)(?:\s+([^\[][^]*?))?(?:\[([^\]]+)\])?\s*$/.exec(line);
  if (!match) {
    return undefined;
  }
  return {
    name: match[1],
    argument: match[2]?.trim() || match[3]?.trim() || "",
    line: lineNumber
  };
}

export function renderLayoutBlock(block: LayoutBlock, theme: Theme): string {
  // 先走已经有明确本地设计的模块；新增模块则按 schema 类型进入对应的本地近似实现。
  switch (block.name) {
    case "hero":
      return renderHero(block, theme);
    case "callout":
      return renderCallout(block, theme);
    case "quote":
      return renderQuote(block, theme);
    case "reading-note":
      return renderReadingNote(block, theme);
    case "summary":
      return renderSummary(block, theme);
    case "cta":
      return renderCta(block, theme);
    case "steps":
      return renderSteps(block, theme);
    case "timeline":
      return renderTimeline(block, theme);
    case "section":
      return renderSection(block, theme);
    default:
      throw new Error(`unsupported layout module: ${block.name}`);
  }
}

function validateKnownLayoutBlock(input: BlockValidationInput): void {
  switch (input.metadata.bodyFormat) {
    case "json_object":
    case "json_array":
      validateJsonLayoutBlock(input);
      return;
    case "rows":
      validateRowLayoutBlock(input);
      return;
    case "fields":
    case "text":
      validateFieldLayoutBlock(input);
      return;
    default:
      validateFieldLayoutBlock(input);
  }
}

function validateFieldLayoutBlock(input: BlockValidationInput): void {
  const fields = parseFieldBody(input.block.body);
  for (const field of input.metadata.fields.required) {
    if (!hasCompatibleField(input.block.name, fields, field.name)) {
      input.report.errors.push(missingFieldIssue(input.block, field.name));
    }
  }
}

function validateRowLayoutBlock(input: BlockValidationInput): void {
  const rows = parseRows(input.block.body);
  if (rows.length === 0 && input.metadata.rows?.minColumns) {
    input.report.errors.push({
      module: input.block.name,
      field: "rows",
      line: input.block.line ?? 0,
      message: "at least one row required"
    });
    return;
  }

  const minColumns = input.metadata.rows?.minColumns ?? 0;
  if (minColumns <= 0) {
    return;
  }

  rows.forEach((row, index) => {
    const filledColumns = row.filter((cell) => cell.trim() !== "").length;
    if (filledColumns < minColumns) {
      input.report.errors.push({
        module: input.block.name,
        field: "rows",
        line: input.block.line ?? 0,
        message: `row ${index + 1} needs at least ${minColumns} columns`
      });
    }
  });
}

function validateJsonLayoutBlock(input: BlockValidationInput): void {
  const parsed = parseJsonBody(input.block.body);
  if (!parsed.ok) {
    input.report.errors.push({
      module: input.block.name,
      field: "body",
      line: input.block.line ?? 0,
      message: "invalid json body"
    });
    return;
  }

  if (input.metadata.bodyFormat === "json_object") {
    if (!isRecord(parsed.value)) {
      input.report.errors.push({
        module: input.block.name,
        field: "body",
        line: input.block.line ?? 0,
        message: "json object required"
      });
      return;
    }
    validateJsonRequiredFields(input, [parsed.value]);
    return;
  }

  if (!Array.isArray(parsed.value)) {
    input.report.errors.push({
      module: input.block.name,
      field: "body",
      line: input.block.line ?? 0,
      message: "json array required"
    });
    return;
  }
  if (parsed.value.length === 0) {
    input.report.errors.push({
      module: input.block.name,
      field: "body",
      line: input.block.line ?? 0,
      message: "json array must not be empty"
    });
    return;
  }

  const records = parsed.value.filter(isRecord);
  if (records.length !== parsed.value.length) {
    input.report.errors.push({
      module: input.block.name,
      field: "body",
      line: input.block.line ?? 0,
      message: "json array entries must be objects"
    });
    return;
  }

  validateJsonRequiredFields(input, records);
}

function validateJsonRequiredFields(input: BlockValidationInput, records: Record<string, unknown>[]): void {
  for (const field of input.metadata.fields.required) {
    if (records.some((record) => !hasJsonPathValue(record, field.name))) {
      input.report.errors.push(missingFieldIssue(input.block, field.name));
    }
  }
}

function missingFieldIssue(block: LayoutBlock, field: string): LayoutValidationIssue {
  return {
    module: block.name,
    field,
    line: block.line ?? 0,
    message: "required field missing"
  };
}

function renderHero(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const tokens = layoutTokens(theme);
  const eyebrow = fields.eyebrow ?? block.argument ?? "Theme Detail";
  const subtitle = fields.subtitle ?? "";
  const ctaText = fields.cta_text ?? "";
  return `<section data-mpa-action-id="hero" style="${styleRecord({
    "margin": "0 0 34px",
    "background": tokens.surface,
    "border-radius": "10px",
    "overflow": "hidden",
    "width": "100%"
  })}">
  <section data-mpa-action-id="hero-content" style="${styleRecord({"padding": "24px 20px 18px", "background": tokens.surface})}">
    <section style="${styleRecord({"margin-bottom": "12px"})}">
      <span style="${styleRecord({"display": "inline-block", "padding": "4px 9px", "font-size": theme.typography.smallSize, "font-weight": "700", "letter-spacing": "0.08em", "text-transform": "uppercase", "color": tokens.accentDark, "background": tokens.accentSoft, "border-radius": "999px"})}">${escapeHtml(eyebrow)}</span>
    </section>
    <h1 style="${styleRecord({"font-size": theme.typography.titleSize, "font-weight": "900", "color": tokens.heading, "margin": "0 0 10px", "line-height": "1.16", "letter-spacing": "0"})}">${inlineMarkdown(fields.title ?? "")}</h1>
    ${subtitle ? `<p style="${styleRecord({"font-size": theme.typography.bodySize, "color": tokens.muted, "margin": "0", "line-height": "1.7", "font-weight": "600"})}">${inlineMarkdown(subtitle)}</p>` : ""}
    ${ctaText ? `<section data-mpa-action-id="hero-cta" style="${styleRecord({"background": tokens.surface, "padding": "12px 0 0", "margin": "14px 0 0"})}">
    <span style="${styleRecord({"display": "inline-block", "padding": "6px 10px", "border-radius": "999px", "background": tokens.accentSoft, "font-size": theme.typography.smallSize, "font-weight": "800", "color": tokens.heading, "line-height": "1.5"})}">${inlineMarkdown(ctaText)}</span>
  </section>` : ""}
  </section>
</section>`;
}

function renderCards(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const tokens = layoutTokens(theme);
  const cards = rows.map((row, index) => {
    const label = row[0] ?? `PART ${String(index + 1).padStart(2, "0")}`;
    const title = row[1] ?? row[0] ?? "";
    const description = row[2] ?? "";
    const accent = /^(accent|推荐|primary|highlight)$/i.test(row[3] ?? "") || index === 0;
    const cardBackground = accent ? tokens.accentSoft : tokens.surface;
    const cardBorder = accent ? tokens.border : tokens.subtleBorder;
    const iconBackground = accent ? tokens.accentSoft : tokens.canvas;
    return `<section style="${styleRecord({"min-width": "0", "background": cardBackground, "border": `1px solid ${cardBorder}`, "border-radius": "12px", "padding": "16px 14px 13px", "box-sizing": "border-box"})}">
      <p style="${styleRecord({"margin": "0 0 10px", "font-size": theme.typography.smallSize, "font-weight": "700", "letter-spacing": "0.08em", "text-transform": "uppercase", "color": tokens.accentDark})}">
        <span style="${styleRecord({"display": "inline-block", "width": "30px", "height": "30px", "line-height": "30px", "text-align": "center", "background": iconBackground, "border-radius": "10px", "border": `1px solid ${cardBorder}`, "color": accent ? tokens.accentDark : tokens.muted, "font-size": "16px", "font-weight": "900", "margin": "0 8px 0 0"})}">${escapeHtml(String(index + 1))}</span>${inlineMarkdown(label)}
      </p>
      <p style="${styleRecord({"margin": "0", "font-size": theme.typography.bodySize, "font-weight": "900", "line-height": "1.45", "color": tokens.heading})}">${inlineMarkdown(title)}</p>
      ${description ? `<p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "line-height": "1.7", "color": tokens.muted})}">${inlineMarkdown(description)}</p>` : ""}
    </section>`;
  }).join("");
  return `<section data-mpa-action-id="cards" style="${styleRecord({"margin": "0 0 32px"})}">
  <section style="${styleRecord({"margin-bottom": "10px"})}">
    <p style="${styleRecord({"display": "inline-block", "padding": "4px 8px", "font-size": theme.typography.smallSize, "font-weight": "700", "letter-spacing": "0.08em", "text-transform": "uppercase", "color": tokens.accentDark, "background": tokens.accentSoft, "border-radius": "999px", "margin": "0"})}">${escapeHtml(block.argument || "模块速览")}</p>
    <p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "color": tokens.muted, "letter-spacing": "0.08em", "text-transform": "uppercase"})}">Structure</p>
  </section>
  <section>
    ${cards}
  </section>
</section>`;
}

function renderCallout(block: LayoutBlock, theme: Theme): string {
  const tone = block.argument || "info";
  const toneTokens = calloutToneTokens(tone, theme);
  return `<section style="${styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "14px 16px",
    "border-radius": theme.presentation.radius,
    "background": toneTokens.background,
    "color": theme.colors.text,
    "line-height": theme.typography.lineHeight,
    "font-size": theme.typography.bodySize
  })}">
    <p style="${styleRecord({"margin": "0 0 6px", "font-size": theme.typography.smallSize, "font-weight": "900", "letter-spacing": "0.08em", "color": toneTokens.accent})}">${toneTokens.label}</p>
    <section style="${styleRecord({"color": theme.colors.text})}">${paragraphize(block.body)}</section>
  </section>`;
}

function renderQuote(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const quoteText = fields.quote ?? fields.text ?? paragraphize(block.body);
  const tokens = layoutTokens(theme);
  return `<blockquote data-mpa-action-id="quote" style="${styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "17px 16px 16px",
    "border-radius": theme.presentation.radius,
    "background": tokens.surface,
    "color": tokens.text,
    "font-size": theme.typography.bodySize,
    "line-height": theme.typography.lineHeight,
    "overflow": "hidden"
  })}">
  <p style="${styleRecord({"margin": "0 0 8px", "line-height": "1.4"})}">
    <span style="${styleRecord({"display": "inline-block", "width": "30px", "height": "30px", "line-height": "34px", "text-align": "center", "border-radius": "999px", "background": tokens.accentSoft, "color": tokens.accentDark, "font-size": "28px", "font-weight": "900", "vertical-align": "middle"})}">“</span>
    ${fields.eyebrow ? `<span style="${styleRecord({"display": "inline-block", "margin": "0 0 0 8px", "padding": "3px 8px", "border-radius": "999px", "background": tokens.accentSoft, "color": tokens.accentDark, "font-size": theme.typography.smallSize, "font-weight": "800", "vertical-align": "middle"})}">${escapeHtml(fields.eyebrow)}</span>` : ""}
  </p>
  <p style="${styleRecord({"margin": "0", "color": tokens.heading, "font-size": theme.typography.headingSize, "font-weight": "900", "line-height": "1.55"})}">${inlineMarkdown(quoteText)}</p>
  ${fields.source ? `<p data-mpa-action-id="quote-source" style="${styleRecord({"margin": "12px 0 0", "padding": "8px 0 0", "font-size": theme.typography.smallSize, "color": tokens.muted, "font-weight": "700", "text-align": "right"})}"><span style="${styleRecord({"display": "inline-block", "width": "32px", "border-top": `1px solid ${tokens.muted}`, "vertical-align": "middle", "margin": "0 8px 0 0"})}"></span><span style="${styleRecord({"vertical-align": "middle"})}">${escapeHtml(fields.source)}</span></p>` : ""}
</blockquote>`;
}

function renderSummary(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  if (fields.highlight || fields.title || fields.body || fields.content || fields.points || fields.eyebrow) {
    const highlight = fields.highlight ?? fields.title ?? "";
    const body = fields.body ?? fields.content ?? "";
    const points = splitList(fields.points);
    const pointItems = points.map((point) => `<li style="margin:6px 0;">${inlineMarkdown(point)}</li>`).join("");
    return `<section style="${baseBlockStyle(theme)}">
  <p style="${blockTitleStyle(theme)}">${escapeHtml(fields.eyebrow || block.argument || "一句话总结")}</p>
  ${highlight ? `<p style="${styleRecord({"margin": "8px 0 0", "font-size": theme.typography.bodySize, "line-height": theme.typography.lineHeight, "font-weight": "700", "color": theme.colors.text})}">${inlineMarkdown(highlight)}</p>` : ""}
  ${body ? `<p style="${styleRecord({"margin": "8px 0 0", "font-size": theme.typography.smallSize, "line-height": "1.75", "color": theme.colors.muted})}">${inlineMarkdown(body)}</p>` : ""}
  ${pointItems ? `<ul style="margin:8px 0 0;padding-left:20px;color:${theme.colors.text};line-height:${theme.typography.lineHeight};font-size:${theme.typography.bodySize};">${pointItems}</ul>` : ""}
</section>`;
  }
  const rows = parseRows(block.body);
  const items = rows.map((row) => `<li style="margin:6px 0;">${inlineMarkdown(row.join(" "))}</li>`).join("");
  return `<section style="${baseBlockStyle(theme)}">
  <p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "本文要点")}</p>
  <ul style="margin:8px 0 0;padding-left:20px;color:${theme.colors.text};line-height:${theme.typography.lineHeight};font-size:${theme.typography.bodySize};">${items}</ul>
</section>`;
}

function renderReadingNote(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const tokens = layoutTokens(theme);
  const eyebrow = fields.eyebrow ?? block.argument ?? "";
  const source = fields.source ?? "";
  const content = fields.content ?? fields.summary ?? "";

  return `<section data-mpa-action-id="reading-note" style="${styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "16px",
    "border-radius": theme.presentation.radius,
    "background": tokens.surface,
    "color": tokens.text,
    "font-size": theme.typography.bodySize,
    "line-height": theme.typography.lineHeight
  })}">
  ${eyebrow ? `<p style="${styleRecord({"display": "inline-block", "margin": "0 0 10px", "padding": "3px 8px", "border-radius": "999px", "background": tokens.accentSoft, "color": tokens.accentDark, "font-size": theme.typography.smallSize, "font-weight": "800"})}">${escapeHtml(eyebrow)}</p>` : ""}
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "line-height": "1.65", "color": tokens.muted, "font-weight": "700"})}">来源：${inlineMarkdown(source)}</p>
  <p style="${styleRecord({"margin": "10px 0 0", "font-size": theme.typography.bodySize, "line-height": theme.typography.lineHeight, "color": tokens.text})}">${inlineMarkdown(content)}</p>
</section>`;
}

function renderCta(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const title = fields.title ?? fields.action ?? "";
  return `<section style="${styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "20px 18px",
    "border-radius": theme.presentation.radius,
    "background": theme.colors.accentSoft,
    "text-align": "center"
  })}">
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.headingSize, "line-height": "1.5", "font-weight": "800", "color": theme.colors.text})}">${inlineMarkdown(title)}</p>
  ${fields.subtitle ? `<p style="${styleRecord({"margin": "8px 0 0", "font-size": theme.typography.smallSize, "color": theme.colors.muted})}">${inlineMarkdown(fields.subtitle)}</p>` : ""}
  ${fields.link ? `<p style="margin:14px 0 0;"><a href="${escapeAttribute(fields.link)}" style="${styleRecord({"display": "inline-block", "padding": "7px 15px", "border-radius": "999px", "background": theme.colors.accent, "color": theme.colors.onAccent, "text-decoration": "none", "font-weight": "700", "font-size": theme.typography.smallSize})}">${escapeHtml(fields.action ?? "查看详情")}</a></p>` : ""}
  ${fields.qrcode ? `<p style="margin:12px 0 0;">${renderImage(fields.qrcode, "qrcode", theme, "width:120px;max-width:45%;")}</p>` : ""}
  ${fields.note ? `<p style="${styleRecord({"margin": "12px 0 0", "font-size": theme.typography.smallSize, "color": theme.colors.muted})}">${escapeHtml(fields.note)}</p>` : ""}
</section>`;
}

function renderSteps(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const tokens = layoutTokens(theme);
  const itemCard = embeddedContentCardStyle(theme);
  const content = rows.map((row, index) => {
    const label = String(index + 1).padStart(2, "0");
    const title = row[0] || "";
    const detail = row.slice(1).filter(Boolean).join(" ");
    return `<section data-mpa-action-id="steps-item" style="${styleRecord({"margin": "12px 0 0", "padding": "12px", "background": itemCard.background, "border-radius": "10px"})}">
      <p style="${styleRecord({"margin": "0", "color": tokens.heading, "font-size": theme.typography.bodySize, "font-weight": "800", "line-height": "1.5"})}">
        <span style="${styleRecord({"display": "inline-block", "width": "32px", "height": "32px", "line-height": "32px", "text-align": "center", "border-radius": "999px", "background": tokens.accent, "color": tokens.onAccent, "font-size": theme.typography.smallSize, "font-weight": "900", "margin": "0 8px 0 0", "vertical-align": "middle"})}">${escapeHtml(label)}</span>
        <span style="${styleRecord({"vertical-align": "middle"})}">${inlineMarkdown(title)}</span>
      </p>
        ${detail ? `<p style="${styleRecord({"margin": "4px 0 0", "color": tokens.muted, "font-size": theme.typography.smallSize, "line-height": "1.7"})}">${inlineMarkdown(detail)}</p>` : ""}
    </section>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "步骤")}</p>${content}</section>`;
}

function renderTimeline(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const tokens = layoutTokens(theme);
  const itemCard = embeddedContentCardStyle(theme);
  const content = rows.map((row, index) => {
    const time = row[0] ?? "";
    const title = row[1] ?? "";
    const detail = row.length >= 3 ? row.slice(2).filter(Boolean).join(" ") : row.length === 1 ? row[0] ?? "" : "";
    const marker = time || String(index + 1).padStart(2, "0");
    const isLast = index === rows.length - 1;
    return `<section data-mpa-action-id="timeline-item" style="${styleRecord({"margin": "0 0 0 8px", "padding": `0 0 ${isLast ? "0" : "16px"} 14px`, "border-left": `2px solid rgba(${tokens.rgb},0.38)`})}">
      <p style="${styleRecord({"margin": "0 0 8px", "line-height": "1.3"})}">
        <span data-mpa-action-id="timeline-node" style="${styleRecord({"display": "inline-block", "width": "8px", "height": "8px", "line-height": "8px", "border-radius": "999px", "background": tokens.accent, "margin": "0 7px 0 -19px", "vertical-align": "middle"})}"></span>
        <span style="${styleRecord({"display": "inline-block", "padding": "3px 8px", "border-radius": "999px", "background": tokens.accentSoft, "color": tokens.accentDark, "font-size": theme.typography.smallSize, "font-weight": "900", "line-height": "1.35", "vertical-align": "middle"})}">${escapeHtml(marker)}</span>
      </p>
      <section style="${styleRecord({"padding": "11px 12px 10px", "background": itemCard.background, "border-radius": "10px"})}">
        ${title ? `<p style="${styleRecord({"margin": "0", "color": tokens.heading, "font-size": theme.typography.bodySize, "font-weight": "800", "line-height": theme.typography.lineHeight})}">${inlineMarkdown(title)}</p>` : ""}
        <p style="${styleRecord({"margin": title ? "3px 0 0" : "0", "color": tokens.muted, "font-size": theme.typography.smallSize, "line-height": "1.7"})}">${inlineMarkdown(detail)}</p>
      </section>
    </section>`;
  }).join("");
  return `<section style="${timelineBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "时间线")}</p>${content}</section>`;
}

function renderAuthorCard(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const tags = splitList(fields.tags).slice(0, 4);
  return `<section style="${baseBlockStyle(theme)}">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      ${fields.avatar ? `<td style="width:56px;padding:0 12px 0 0;vertical-align:top;">${renderImage(fields.avatar, fields.name ?? "avatar", theme, "width:56px;height:56px;object-fit:cover;border-radius:999px;")}</td>` : ""}
      <td style="vertical-align:top;">
        <p style="${styleRecord({"margin": "0", "font-size": theme.typography.headingSize, "font-weight": "800", "color": theme.colors.text})}">${inlineMarkdown(fields.name ?? "")}</p>
        ${fields.role ? `<p style="${smallTextStyle(theme, "4px 0 0")}">${inlineMarkdown(fields.role)}</p>` : ""}
        <p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.bio ?? "")}</p>
        ${renderPills(tags, theme)}
        ${fields.note ? `<p style="${smallTextStyle(theme, "10px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
        ${fields.link ? `<p style="${smallTextStyle(theme, "6px 0 0")}">${escapeHtml(fields.link)}</p>` : ""}
      </td>
    </tr>
  </table>
</section>`;
}

function renderSeries(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const progress = fields.index && fields.total ? `${fields.index}/${fields.total}` : fields.issue;
  const description = fields.desc ?? fields.description;
  return `<section style="${baseBlockStyle(theme)}">
  <p style="${blockTitleStyle(theme)}">${escapeHtml(fields.label || block.argument || "系列")}</p>
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "font-weight": "700", "color": theme.colors.accent})}">${escapeHtml([fields.name, progress].filter(Boolean).join(" / "))}</p>
  <p style="${styleRecord({"margin": "6px 0 0", "font-size": theme.typography.headingSize, "font-weight": "800", "line-height": "1.45", "color": theme.colors.text})}">${inlineMarkdown(fields.title ?? "")}</p>
  ${description ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(description)}</p>` : ""}
  ${renderPills(splitList(fields.tags), theme)}
  ${fields.next ? `<p style="${smallTextStyle(theme, "10px 0 0")}">下一篇：${inlineMarkdown(fields.next)}</p>` : ""}
</section>`;
}

function renderSubscribe(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const description = fields.subtitle ?? fields.description;
  const action = fields.cta ?? fields.primary;
  return `<section style="${styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "18px 16px",
    "border-radius": theme.presentation.radius,
    "background": theme.colors.accentSoft,
    "text-align": "center",
    "border": `1px solid ${theme.colors.border}`
  })}">
  ${fields.label ? `<p style="${smallTextStyle(theme, "0 0 6px")}">${escapeHtml(fields.label)}</p>` : ""}
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.headingSize, "font-weight": "800", "line-height": "1.45", "color": theme.colors.text})}">${inlineMarkdown(fields.title ?? "")}</p>
  ${description ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(description)}</p>` : ""}
  ${action ? `<p style="${styleRecord({"display": "inline-block", "margin": "14px 0 0", "padding": "7px 14px", "border-radius": "999px", "background": theme.colors.accent, "color": theme.colors.onAccent, "font-size": theme.typography.smallSize, "font-weight": "700"})}">${inlineMarkdown(action)}</p>` : ""}
  ${fields.secondary ? `<p style="${smallTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.secondary)}</p>` : ""}
  ${fields.qrcode ? `<p style="margin:12px 0 0;">${renderImage(fields.qrcode, "qrcode", theme, "width:128px;max-width:48%;")}</p>` : ""}
  ${fields.note ? `<p style="${smallTextStyle(theme, "10px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
</section>`;
}

function renderChecklist(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const items = rows.map((row) => {
    const hasExplicitStatus = row.length > 1;
    const status = hasExplicitStatus ? row[0] : "";
    const item = hasExplicitStatus ? row[1] : row[0];
    const note = hasExplicitStatus ? row.slice(2).filter(Boolean).join(" ") : row.slice(1).filter(Boolean).join(" ");
    const done = /^(done|yes|true|ok|完成|已完成|通过|check)$/i.test(status);
    const marker = done ? "OK" : status || "-";
    return `<li style="margin:9px 0;padding-left:0;">
      <span style="${styleRecord({"display": "inline-block", "min-width": "28px", "margin-right": "6px", "color": done ? theme.colors.success : theme.colors.accent, "font-size": theme.typography.smallSize, "font-weight": "800"})}">${escapeHtml(marker)}</span>
      <span style="color:${theme.colors.text};font-size:${theme.typography.bodySize};line-height:${theme.typography.lineHeight};">${inlineMarkdown(item ?? "")}</span>
      ${note ? `<p style="${smallTextStyle(theme, "4px 0 0 36px")}">${inlineMarkdown(note)}</p>` : ""}
    </li>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "检查清单")}</p><ul style="list-style:none;margin:8px 0 0;padding:0;">${items}</ul></section>`;
}

function renderFaq(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const items = rows.map((row, index) => {
    const question = row[0] ?? "";
    const answer = row.slice(1).filter(Boolean).join(" ");
    return `<section style="${subCardStyle(theme)}">
      <p style="${styleRecord({"margin": "0", "font-size": theme.typography.bodySize, "font-weight": "800", "color": theme.colors.text, "line-height": theme.typography.lineHeight})}">${index + 1}. ${inlineMarkdown(question)}</p>
      ${answer ? `<p style="${bodyTextStyle(theme, "6px 0 0")}">${inlineMarkdown(answer)}</p>` : ""}
    </section>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "常见问题")}</p>${items}</section>`;
}

function renderSpecs(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const items = rows.map((row) => {
    const spec = row[0] ?? "";
    const value = row[1] ?? "";
    const note = row.slice(2).filter(Boolean).join(" ");
    return `<tr>
      <td style="width:34%;padding:9px 8px;border-bottom:1px solid ${theme.colors.border};color:${theme.colors.muted};font-size:${theme.typography.smallSize};vertical-align:top;">${inlineMarkdown(spec)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid ${theme.colors.border};color:${theme.colors.text};font-size:${theme.typography.bodySize};line-height:${theme.typography.lineHeight};vertical-align:top;">${inlineMarkdown(value)}${note ? `<p style="${smallTextStyle(theme, "4px 0 0")}">${inlineMarkdown(note)}</p>` : ""}</td>
    </tr>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "规格")}</p><table style="width:100%;border-collapse:collapse;">${items}</table></section>`;
}

function renderImageAnnotate(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  return `<section style="${baseBlockStyle(theme)}">
  ${renderBlockHeading(theme, fields.eyebrow || block.argument || "图片标注", fields.title)}
  ${renderImage(fields.image ?? "", fields.alt ?? fields.title ?? "image", theme)}
  ${fields.point ? `<p style="${styleRecord({"margin": "12px 0 0", "padding": "9px 12px", "border-left": `3px solid ${theme.colors.accent}`, "background": theme.colors.canvas, "font-size": theme.typography.smallSize, "line-height": "1.7", "color": theme.colors.text})}">${inlineMarkdown(fields.point)}</p>` : ""}
  ${fields.note ? `<p style="${smallTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
</section>`;
}

function renderImageSteps(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const content = rows.map((row, index) => {
    const number = row[0] || String(index + 1);
    const title = row[1] ?? "";
    const description = row[2] ?? "";
    const image = row[3] ?? "";
    const note = row.slice(4).filter(Boolean).join(" ");
    return `<section style="${subCardStyle(theme)}">
      <p style="margin:0;color:${theme.colors.accent};font-size:${theme.typography.smallSize};font-weight:800;">${escapeHtml(number)}</p>
      <p style="${styleRecord({"margin": "3px 0 0", "font-size": theme.typography.bodySize, "font-weight": "800", "color": theme.colors.text})}">${inlineMarkdown(title)}</p>
      ${description ? `<p style="${bodyTextStyle(theme, "5px 0 8px")}">${inlineMarkdown(description)}</p>` : ""}
      ${renderImage(image, title || "step image", theme)}
      ${note ? `<p style="${smallTextStyle(theme, "8px 0 0")}">${inlineMarkdown(note)}</p>` : ""}
    </section>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "图文步骤")}</p>${content}</section>`;
}

function renderImageText(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const imageFirst = fields.layout !== "text-first";
  const imageHtml = renderImage(fields.image ?? "", fields.alt ?? fields.title ?? "image", theme);
  const textHtml = `<section>
    ${renderBlockHeading(theme, fields.eyebrow || block.argument || "图文说明", fields.title)}
    ${fields.body ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.body)}</p>` : ""}
    ${fields.note ? `<p style="${smallTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
  </section>`;
  return `<section style="${baseBlockStyle(theme)}">${imageFirst ? `${imageHtml}${textHtml}` : `${textHtml}${imageHtml}`}</section>`;
}

function renderInfographic(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const items = splitList(fields.items ?? fields.flow);
  const type = fields.type ?? fields.variant ?? "";
  const itemHtml = items.map((item, index) => `<li style="margin:7px 0;"><span style="color:${theme.colors.accent};font-weight:800;">${index + 1}</span> ${inlineMarkdown(item)}</li>`).join("");
  return `<section style="${baseBlockStyle(theme)}">
  ${renderBlockHeading(theme, fields.eyebrow || block.argument || "信息图", fields.title, fields.subtitle)}
  ${fields.value ? `<p style="${styleRecord({"margin": "10px 0 0", "font-size": "28px", "font-weight": "900", "line-height": "1.2", "color": fields.accent || theme.colors.accent, "text-align": "center"})}">${inlineMarkdown(fields.value)}${fields.label ? `<span style="font-size:${theme.typography.smallSize};margin-left:4px;color:${theme.colors.muted};">${inlineMarkdown(fields.label)}</span>` : ""}</p>` : ""}
  ${fields.quote ? `<blockquote style="${styleRecord({"margin": "12px 0 0", "padding": "8px 0 8px 12px", "border-left": `3px solid ${theme.colors.accent}`, "color": theme.colors.text, "line-height": theme.typography.lineHeight})}">${inlineMarkdown(fields.quote)}</blockquote>` : ""}
  ${fields.left || fields.right ? `<table style="width:100%;border-collapse:collapse;margin:12px 0 0;"><tr><td style="width:50%;padding:10px;background:${theme.colors.canvas};border:1px solid ${theme.colors.border};vertical-align:top;">${inlineMarkdown(fields.left ?? "")}</td><td style="width:50%;padding:10px;background:${theme.colors.accentSoft};border:1px solid ${theme.colors.border};vertical-align:top;">${inlineMarkdown(fields.right ?? "")}</td></tr></table>` : ""}
  ${itemHtml ? `<ul style="margin:10px 0 0;padding-left:18px;color:${theme.colors.text};font-size:${theme.typography.bodySize};line-height:${theme.typography.lineHeight};">${itemHtml}</ul>` : ""}
  ${fields.note ? `<p style="${smallTextStyle(theme, "10px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
  ${type ? `<p style="${smallTextStyle(theme, "8px 0 0")}">${escapeHtml(type)}</p>` : ""}
</section>`;
}

function renderMetrics(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const items = rows.map((row) => {
    const label = row[0] ?? "";
    const value = row[1] ?? "";
    const suffix = row[2] ?? "";
    const style = row[3] ?? "";
    return `<section style="${subCardStyle(theme)};text-align:center;">
      <p style="${smallTextStyle(theme, "0 0 4px")}">${inlineMarkdown(label)}</p>
      <p style="${styleRecord({"margin": "0", "font-size": "26px", "font-weight": "900", "line-height": "1.2", "color": style === "muted" ? theme.colors.muted : theme.colors.accent})}">${inlineMarkdown(value)}${suffix ? `<span style="font-size:${theme.typography.smallSize};margin-left:3px;">${inlineMarkdown(suffix)}</span>` : ""}</p>
    </section>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "关键指标")}</p>${items}</section>`;
}

function renderAudienceFit(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const fitItems = splitList(fields.fit).map((item) => `<li style="margin:6px 0;">${inlineMarkdown(item)}</li>`).join("");
  const avoidItems = splitList(fields.avoid).map((item) => `<li style="margin:6px 0;">${inlineMarkdown(item)}</li>`).join("");
  return `<section style="${baseBlockStyle(theme)}">
  ${renderBlockHeading(theme, block.argument || "适合谁", fields.title, fields.subtitle)}
  <table style="width:100%;border-collapse:collapse;margin:8px 0 0;">
    <tr>
      <td style="width:50%;padding:10px;vertical-align:top;border:1px solid ${theme.colors.border};background:${theme.colors.accentSoft};">
        <p style="${blockTitleStyle(theme)}">适合</p>
        <ul style="margin:0;padding-left:18px;color:${theme.colors.text};line-height:${theme.typography.lineHeight};">${fitItems}</ul>
      </td>
      <td style="width:50%;padding:10px;vertical-align:top;border:1px solid ${theme.colors.border};background:${theme.colors.canvas};">
        <p style="${blockTitleStyle(theme)}">不适合</p>
        <ul style="margin:0;padding-left:18px;color:${theme.colors.text};line-height:${theme.typography.lineHeight};">${avoidItems}</ul>
      </td>
    </tr>
  </table>
  ${fields.note ? `<p style="${smallTextStyle(theme, "10px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
</section>`;
}

function renderBridge(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  return `<section style="${baseBlockStyle(theme)}">
  ${renderBlockHeading(theme, fields.label || block.argument || "接下来", fields.title)}
  ${fields.body ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.body)}</p>` : ""}
  ${fields.next ? `<p style="${styleRecord({"margin": "12px 0 0", "font-size": theme.typography.bodySize, "font-weight": "800", "color": theme.colors.accent})}">${inlineMarkdown(fields.next)}</p>` : ""}
</section>`;
}

function renderManifesto(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  return `<section style="${baseBlockStyle(theme)}">
  ${renderBlockHeading(theme, fields.label || block.argument || "主张", fields.title, fields.subtitle)}
  ${fields.body ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.body)}</p>` : ""}
  ${fields.believe ? `<p style="${styleRecord({"margin": "10px 0 0", "padding": "10px", "background": theme.colors.accentSoft, "border-left": `3px solid ${theme.colors.success}`, "font-size": theme.typography.bodySize, "line-height": theme.typography.lineHeight, "color": theme.colors.text})}">我相信：${inlineMarkdown(fields.believe)}</p>` : ""}
  ${fields.against ? `<p style="${styleRecord({"margin": "8px 0 0", "padding": "10px", "background": theme.colors.canvas, "border-left": `3px solid ${theme.colors.danger}`, "font-size": theme.typography.bodySize, "line-height": theme.typography.lineHeight, "color": theme.colors.text})}">我反对：${inlineMarkdown(fields.against)}</p>` : ""}
  ${fields.note ? `<p style="${smallTextStyle(theme, "10px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
</section>`;
}

function renderMythFact(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const items = rows.map((row) => `<section style="${subCardStyle(theme)}">
    <p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "font-weight": "800", "color": theme.colors.danger})}">误区</p>
    <p style="${bodyTextStyle(theme, "3px 0 8px")}">${inlineMarkdown(row[0] ?? "")}</p>
    <p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "font-weight": "800", "color": theme.colors.success})}">事实</p>
    <p style="${bodyTextStyle(theme, "3px 0 0")}">${inlineMarkdown(row[1] ?? "")}</p>
    ${row[2] ? `<p style="${smallTextStyle(theme, "6px 0 0")}">${inlineMarkdown(row[2])}</p>` : ""}
  </section>`).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "误区与事实")}</p>${items}</section>`;
}

function renderVerdict(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  return `<section style="${styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "20px 18px",
    "border-radius": theme.presentation.radius,
    "background": theme.colors.accentSoft,
    "border": `1px solid ${theme.colors.border}`,
    "border-left": `5px solid ${theme.colors.accent}`
  })}">
  ${renderBlockHeading(theme, fields.eyebrow || block.argument || "判断", fields.title, fields.meta)}
  ${fields.body ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.body)}</p>` : paragraphize(block.body)}
  ${fields.note ? `<p style="${smallTextStyle(theme, "10px 0 0")}">${inlineMarkdown(fields.note)}</p>` : ""}
</section>`;
}

function renderLabelTitle(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  return `<section style="${styleRecord({"margin": `${theme.spacing.block} 0`, "padding": "6px 0"})}">
  <p style="${styleRecord({"display": "inline-block", "margin": "0 0 8px", "padding": "3px 9px", "border-radius": "999px", "background": theme.colors.accentSoft, "color": theme.colors.accent, "font-size": theme.typography.smallSize, "font-weight": "800"})}">${inlineMarkdown(fields.label ?? "")}</p>
  <h2 style="${styleRecord({"margin": "0", "font-size": theme.typography.headingSize, "line-height": "1.45", "color": theme.colors.text, "font-weight": "800"})}">${inlineMarkdown(fields.title ?? "")}</h2>
</section>`;
}

function renderPart(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  return `<section style="${baseBlockStyle(theme)}">
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "color": theme.colors.accent, "font-weight": "800"})}">${escapeHtml([fields.label || block.argument || "Part", fields.index].filter(Boolean).join(" "))}</p>
  <h2 style="${styleRecord({"margin": "6px 0 0", "font-size": theme.typography.headingSize, "line-height": "1.45", "color": theme.colors.text, "font-weight": "800"})}">${inlineMarkdown(fields.title ?? "")}</h2>
  ${fields.subtitle ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(fields.subtitle)}</p>` : ""}
</section>`;
}

function renderSection(block: LayoutBlock, theme: Theme): string {
  const fields = parseFieldBody(block.body);
  const label = fields.label ?? block.argument;
  const title = fields.title ?? block.body.find((line) => line.trim() !== "" && !line.includes(":"))?.trim() ?? "";
  const subtitle = fields.subtitle ?? fields.description ?? "";
  return `<section data-mpa-action-id="section" style="${baseBlockStyle(theme)}">
  ${label ? `<p style="${styleRecord({"margin": "0", "font-size": theme.typography.smallSize, "color": theme.colors.accent, "font-weight": "800"})}">${escapeHtml(label)}</p>` : ""}
  <h2 style="${styleRecord({"margin": label ? "6px 0 0" : "0", "font-size": theme.typography.headingSize, "line-height": "1.45", "color": theme.colors.text, "font-weight": "800"})}">${inlineMarkdown(title)}</h2>
  ${subtitle ? `<p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(subtitle)}</p>` : ""}
</section>`;
}

function renderToc(block: LayoutBlock, theme: Theme): string {
  const rows = parseRows(block.body);
  const items = rows.map((row) => `<li style="margin:8px 0;">
    <span style="color:${theme.colors.accent};font-weight:800;margin-right:6px;">${escapeHtml(row[0] ?? "")}</span>
    <span style="color:${theme.colors.text};font-weight:700;">${inlineMarkdown(row[1] ?? "")}</span>
    ${row[2] ? `<p style="${smallTextStyle(theme, "3px 0 0 24px")}">${inlineMarkdown(row[2])}</p>` : ""}
  </li>`).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "目录")}</p><ol style="list-style:none;margin:8px 0 0;padding:0;">${items}</ol></section>`;
}

function renderChangelog(block: LayoutBlock, theme: Theme): string {
  const data = jsonObjectOrFallback(block);
  if (!data) {
    return renderJsonFallback(block, theme);
  }
  const version = stringValue(data, "version");
  const date = stringValue(data, "date");
  const groups = [
    ["Added", "added"],
    ["Changed", "changed"],
    ["Fixed", "fixed"],
    ["Removed", "removed"]
  ].map(([label, key]) => renderJsonList(label, stringArrayValue(data, key), theme)).join("");
  return `<section style="${baseBlockStyle(theme)}">
  ${renderBlockHeading(theme, block.argument || "Changelog", version, date)}
  ${groups}
</section>`;
}

function renderComparisonTable(block: LayoutBlock, theme: Theme): string {
  const data = jsonObjectOrFallback(block);
  if (!data) {
    return renderJsonFallback(block, theme);
  }
  const left = recordValue(data, "left");
  const right = recordValue(data, "right");
  return `<section style="${baseBlockStyle(theme)}">
  <p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "方案对比")}</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      ${renderComparisonCell(left, theme, theme.colors.canvas)}
      ${renderComparisonCell(right, theme, theme.colors.accentSoft)}
    </tr>
  </table>
</section>`;
}

function renderDefinition(block: LayoutBlock, theme: Theme): string {
  const data = jsonObjectOrFallback(block);
  if (!data) {
    return renderJsonFallback(block, theme);
  }
  const termLabel = stringValue(data, "termLabel") ?? (block.argument || "定义");
  return `<section style="${baseBlockStyle(theme)}">
  <p style="${smallTextStyle(theme, "0 0 6px")}">${inlineMarkdown(termLabel)}</p>
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.headingSize, "font-weight": "900", "line-height": "1.45", "color": theme.colors.text})}">${inlineMarkdown(stringValue(data, "term") ?? "")}</p>
  <p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(stringValue(data, "def") ?? "")}</p>
</section>`;
}

function renderQuestion(block: LayoutBlock, theme: Theme): string {
  const records = jsonArrayOrFallback(block);
  if (!records) {
    return renderJsonFallback(block, theme);
  }
  const items = records.map((record, index) => `<section style="${subCardStyle(theme)}">
    <p style="${styleRecord({"margin": "0", "font-size": theme.typography.bodySize, "font-weight": "800", "color": theme.colors.text, "line-height": theme.typography.lineHeight})}">Q${index + 1}. ${inlineMarkdown(stringValue(record, "q") ?? "")}</p>
    <p style="${bodyTextStyle(theme, "6px 0 0")}">${inlineMarkdown(stringValue(record, "a") ?? "")}</p>
  </section>`).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "问答")}</p>${items}</section>`;
}

function renderQuoteCard(block: LayoutBlock, theme: Theme): string {
  const data = jsonObjectOrFallback(block);
  if (!data) {
    return renderJsonFallback(block, theme);
  }
  const source = stringValue(data, "source") ?? stringValue(data, "author");
  return `<blockquote style="${styleRecord({"margin": `${theme.spacing.block} 0`, "padding": "16px", "border-radius": theme.presentation.radius, "background": theme.colors.accentSoft, "border-left": `4px solid ${theme.colors.accent}`, "color": theme.colors.text, "line-height": theme.typography.lineHeight})}">
  <p style="${styleRecord({"margin": "0", "font-size": theme.typography.bodySize, "font-weight": "700"})}">${inlineMarkdown(stringValue(data, "text") ?? "")}</p>
  ${source ? `<p style="${smallTextStyle(theme, "8px 0 0")}">- ${inlineMarkdown(source)}</p>` : ""}
</blockquote>`;
}

function renderResourceList(block: LayoutBlock, theme: Theme): string {
  const records = jsonArrayOrFallback(block);
  if (!records) {
    return renderJsonFallback(block, theme);
  }
  const items = records.map((record) => {
    const name = stringValue(record, "name") ?? "";
    const url = stringValue(record, "url") ?? "";
    const icon = stringValue(record, "icon") ?? name.slice(0, 1).toUpperCase();
    const desc = stringValue(record, "desc") ?? stringValue(record, "description");
    const nameHtml = isHttpUrl(url) ? `<a href="${escapeAttribute(url)}" style="color:${theme.colors.accent};text-decoration:none;font-weight:800;">${inlineMarkdown(name)}</a>` : `<span style="font-weight:800;color:${theme.colors.text};">${inlineMarkdown(name)}</span>`;
    return `<section style="${subCardStyle(theme)}">
      <p style="margin:0;"><span style="${styleRecord({"display": "inline-block", "min-width": "24px", "margin-right": "6px", "color": theme.colors.accent, "font-weight": "800"})}">${escapeHtml(icon)}</span>${nameHtml}</p>
      ${desc ? `<p style="${smallTextStyle(theme, "5px 0 0 30px")}">${inlineMarkdown(desc)}</p>` : ""}
    </section>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "资源列表")}</p>${items}</section>`;
}

function renderStatRow(block: LayoutBlock, theme: Theme): string {
  const records = jsonArrayOrFallback(block);
  if (!records) {
    return renderJsonFallback(block, theme);
  }
  const items = records.map((record) => `<section style="${subCardStyle(theme)};text-align:center;">
    <p style="${smallTextStyle(theme, "0 0 5px")}">${inlineMarkdown(stringValue(record, "label") ?? "")}</p>
    <p style="${styleRecord({"margin": "0", "font-size": "26px", "font-weight": "900", "line-height": "1.2", "color": theme.colors.accent})}">${inlineMarkdown(stringValue(record, "value") ?? "")}${stringValue(record, "unit") ? `<span style="font-size:${theme.typography.smallSize};margin-left:3px;">${inlineMarkdown(stringValue(record, "unit") ?? "")}</span>` : ""}</p>
    ${stringValue(record, "note") ? `<p style="${smallTextStyle(theme, "5px 0 0")}">${inlineMarkdown(stringValue(record, "note") ?? "")}</p>` : ""}
  </section>`).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || "数据")}</p>${items}</section>`;
}

function renderTweet(block: LayoutBlock, theme: Theme): string {
  const data = jsonObjectOrFallback(block);
  if (!data) {
    return renderJsonFallback(block, theme);
  }
  const name = stringValue(data, "name") ?? "";
  const handle = stringValue(data, "handle") ?? "";
  const avatar = stringValue(data, "avatar") ?? "";
  return `<section style="${baseBlockStyle(theme)}">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      ${avatar ? `<td style="width:44px;padding:0 10px 0 0;vertical-align:top;">${renderImage(avatar, name || "avatar", theme, "width:44px;height:44px;object-fit:cover;border-radius:999px;")}</td>` : ""}
      <td style="vertical-align:top;">
        ${name || handle ? `<p style="margin:0;color:${theme.colors.text};font-size:${theme.typography.smallSize};font-weight:800;">${inlineMarkdown(name)} ${handle ? `<span style="color:${theme.colors.muted};font-weight:400;">${inlineMarkdown(handle)}</span>` : ""}</p>` : ""}
        <p style="${bodyTextStyle(theme, "8px 0 0")}">${inlineMarkdown(stringValue(data, "text") ?? "")}</p>
        <p style="${smallTextStyle(theme, "10px 0 0")}">${[stringValue(data, "timestamp"), stringValue(data, "likes") ? `${stringValue(data, "likes")} likes` : ""].filter((value): value is string => Boolean(value)).map(escapeHtml).join(" · ")}</p>
      </td>
    </tr>
  </table>
</section>`;
}

function renderRowsAsCards(block: LayoutBlock, theme: Theme, options: RowCardRenderingOptions): string {
  const rows = parseRows(block.body);
  const content = rows.map((row) => {
    const primary = row[options.primaryIndex] ?? "";
    const secondary = options.secondaryIndex === undefined ? "" : row[options.secondaryIndex] ?? "";
    const details = (options.detailIndexes ?? []).map((index) => row[index]).filter(Boolean);
    const accent = options.accentIndex === undefined ? "" : row[options.accentIndex] ?? "";
    const link = options.linkIndex === undefined ? "" : row[options.linkIndex] ?? "";
    return `<section style="${subCardStyle(theme)}">
      ${secondary ? `<p style="${smallTextStyle(theme, "0 0 5px")}">${inlineMarkdown(secondary)}</p>` : ""}
      <p style="${styleRecord({"margin": "0", "font-size": theme.typography.bodySize, "font-weight": "800", "line-height": theme.typography.lineHeight, "color": theme.colors.text})}">${inlineMarkdown(primary)}</p>
      ${details.map((detail) => `<p style="${bodyTextStyle(theme, "5px 0 0")}">${inlineMarkdown(detail)}</p>`).join("")}
      ${link ? `<p style="${smallTextStyle(theme, "6px 0 0")}">${isHttpUrl(link) ? `<a href="${escapeAttribute(link)}" style="color:${theme.colors.accent};text-decoration:none;">${escapeHtml(link)}</a>` : inlineMarkdown(link)}</p>` : ""}
      ${accent ? `<p style="${styleRecord({"display": "inline-block", "margin": "8px 0 0", "padding": "2px 7px", "border-radius": "999px", "background": theme.colors.accentSoft, "color": theme.colors.accent, "font-size": theme.typography.smallSize, "font-weight": "700"})}">${inlineMarkdown(accent)}</p>` : ""}
    </section>`;
  }).join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${escapeHtml(options.title)}</p>${content}</section>`;
}

function renderMetadataBackedBlock(block: LayoutBlock, theme: Theme): string {
  const metadata = getSupportedBlockMetadata(block.name);
  if (!metadata) {
    console.warn(`[wechat-publisher] unknown layout block module="${block.name}" line=${block.line ?? 0}; rendering body as plain paragraph.`);
    return `<section style="${baseBlockStyle(theme)}">${paragraphize(block.body)}</section>`;
  }

  switch (metadata.bodyFormat) {
    case "rows":
      return renderRowsAsCards(block, theme, { title: block.argument || layoutDisplayNames[metadata.name] || metadata.name, primaryIndex: 0, detailIndexes: [1, 2, 3] });
    case "json_object":
    case "json_array":
      return renderJsonFallback(block, theme);
    case "fields":
    case "text":
    default:
      return renderGenericFields(block, theme, metadata);
  }
}

function renderGenericFields(block: LayoutBlock, theme: Theme, metadata: SupportedBlockMetadata): string {
  const fields = parseFieldBody(block.body);
  const allFields = [...metadata.fields.required, ...metadata.fields.optional];
  const title = fields.title ?? fields.name ?? fields.label ?? block.argument ?? layoutDisplayNames[metadata.name] ?? metadata.name;
  const body = allFields
    .filter((field) => !["title", "name", "label"].includes(field.name))
    .map((field) => {
      const value = fields[field.name];
      return value ? `<p style="${bodyTextStyle(theme, "6px 0 0")}"><strong>${escapeHtml(field.name)}:</strong> ${inlineMarkdown(value)}</p>` : "";
    })
    .join("");
  return `<section style="${baseBlockStyle(theme)}"><p style="${blockTitleStyle(theme)}">${inlineMarkdown(title)}</p>${body || paragraphize(block.body)}</section>`;
}

function renderJsonFallback(block: LayoutBlock, theme: Theme): string {
  const parsed = parseJsonBody(block.body);
  if (!parsed.ok) {
    console.warn(`[wechat-publisher] invalid json layout block module="${block.name}" line=${block.line ?? 0} error=${parsed.error}; rendering body as plain paragraph.`);
    return `<section style="${baseBlockStyle(theme)}">${paragraphize(block.body)}</section>`;
  }
  return `<section style="${baseBlockStyle(theme)}">
  <p style="${blockTitleStyle(theme)}">${escapeHtml(block.argument || layoutDisplayNames[block.name] || block.name)}</p>
  <pre style="${styleRecord({"white-space": "pre-wrap", "word-break": "break-word", "margin": "8px 0 0", "font-size": theme.typography.smallSize, "line-height": "1.6", "color": theme.colors.text, "background": theme.colors.canvas, "padding": "10px", "border-radius": "6px", "border": `1px solid ${theme.colors.border}`})}">${escapeHtml(JSON.stringify(parsed.value, null, 2))}</pre>
</section>`;
}

function renderBlockHeading(theme: Theme, eyebrow: string, title?: string, subtitle?: string): string {
  return `${eyebrow ? `<p style="${blockTitleStyle(theme)}">${inlineMarkdown(eyebrow)}</p>` : ""}
  ${title ? `<p style="${styleRecord({"margin": "0", "font-size": theme.typography.headingSize, "font-weight": "800", "line-height": "1.45", "color": theme.colors.text})}">${inlineMarkdown(title)}</p>` : ""}
  ${subtitle ? `<p style="${smallTextStyle(theme, "6px 0 0")}">${inlineMarkdown(subtitle)}</p>` : ""}`;
}

function renderPills(items: string[], theme: Theme): string {
  if (items.length === 0) {
    return "";
  }
  const pills = items.map((item) => `<span style="${styleRecord({"display": "inline-block", "margin": "7px 6px 0 0", "padding": "2px 8px", "border-radius": "999px", "background": theme.colors.accentSoft, "border": `1px solid ${theme.colors.border}`, "color": theme.colors.accent, "font-size": theme.typography.smallSize, "font-weight": "700"})}">${inlineMarkdown(item)}</span>`).join("");
  return `<p style="margin:4px 0 0;">${pills}</p>`;
}

function renderImage(src: string, alt: string, theme: Theme, extraStyle = ""): string {
  if (!src) {
    return "";
  }
  return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" style="${styleRecord({
    "display": "block",
    "width": "100%",
    "max-width": "100%",
    "height": "auto",
    "border-radius": theme.presentation.radius,
    "border": `1px solid ${theme.colors.border}`
  })}${extraStyle ? `;${extraStyle}` : ""}" />`;
}

function renderJsonList(label: string, items: string[], theme: Theme): string {
  if (items.length === 0) {
    return "";
  }
  const list = items.map((item) => `<li style="margin:5px 0;">${inlineMarkdown(item)}</li>`).join("");
  return `<section style="margin:10px 0 0;">
  <p style="${styleRecord({"margin": "0 0 5px", "font-size": theme.typography.smallSize, "font-weight": "800", "color": theme.colors.accent})}">${escapeHtml(label)}</p>
  <ul style="margin:0;padding-left:18px;color:${theme.colors.text};font-size:${theme.typography.bodySize};line-height:${theme.typography.lineHeight};">${list}</ul>
</section>`;
}

function renderComparisonCell(data: Record<string, unknown> | undefined, theme: Theme, background: string): string {
  const title = data ? stringValue(data, "title") ?? "" : "";
  const items = data ? stringArrayValue(data, "items") : [];
  return `<td style="width:50%;padding:10px;vertical-align:top;background:${background};border:1px solid ${theme.colors.border};">
    <p style="${styleRecord({"margin": "0 0 8px", "font-size": theme.typography.bodySize, "font-weight": "800", "color": theme.colors.text})}">${inlineMarkdown(title)}</p>
    <ul style="margin:0;padding-left:18px;color:${theme.colors.text};font-size:${theme.typography.smallSize};line-height:1.7;">${items.map((item) => `<li style="margin:5px 0;">${inlineMarkdown(item)}</li>`).join("")}</ul>
  </td>`;
}

function layoutTokens(theme: Theme): LayoutVisualTokens {
  const rgb = hexToRgbTriplet(theme.colors.accent);
  return {
    text: theme.colors.text,
    heading: theme.colors.heading,
    muted: theme.colors.muted,
    border: theme.colors.border,
    subtleBorder: `rgba(${rgb},0.18)`,
    surface: theme.colors.surface,
    canvas: theme.colors.canvas,
    accent: theme.colors.accent,
    accentDark: theme.colors.inlineCodeText,
    accentSoft: theme.colors.accentSoft,
    onAccent: theme.colors.onAccent,
    shadow: theme.colors.shadow,
    rgb
  };
}

function hexToRgbTriplet(hex: string): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return "87,107,149";
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ].join(",");
}

function parseFieldBody(lines: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value === "|" || value === ">") {
      const blockLines: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && !isTopLevelFieldLine(lines[cursor])) {
        blockLines.push(stripYamlBlockIndent(lines[cursor]));
        cursor++;
      }
      fields[key] = value === ">" ? blockLines.join(" ").replace(/\s+/g, " ").trim() : blockLines.join("\n").trim();
      index = cursor - 1;
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

function isTopLevelFieldLine(line: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(line);
}

function stripYamlBlockIndent(line: string): string {
  return line.replace(/^(?: {2}|\t)/, "");
}

function parseRows(lines: string[]): string[][] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-\s*/, ""))
    .map((line) => {
      if (line.includes("|")) {
        return line.split("|").map((cell) => cell.trim());
      }
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        return [line.slice(0, colonIndex).trim(), line.slice(colonIndex + 1).trim()];
      }
      const chineseColonIndex = line.indexOf("：");
      if (chineseColonIndex > 0) {
        return [line.slice(0, chineseColonIndex).trim(), line.slice(chineseColonIndex + 1).trim()];
      }
      return [line];
    });
}

function parseJsonBody(lines: string[]): JsonParseResult {
  const text = lines.join("\n").trim();
  if (!text) {
    return { ok: false, error: "empty body" };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(text) as unknown
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function jsonObjectOrFallback(block: LayoutBlock): Record<string, unknown> | undefined {
  const parsed = parseJsonBody(block.body);
  if (!parsed.ok || !isRecord(parsed.value)) {
    const reason = parsed.ok ? "json object required" : parsed.error;
    console.warn(`[wechat-publisher] invalid json layout block module="${block.name}" line=${block.line ?? 0} error=${reason}; rendering JSON fallback.`);
    return undefined;
  }
  return parsed.value;
}

function jsonArrayOrFallback(block: LayoutBlock): Record<string, unknown>[] | undefined {
  const parsed = parseJsonBody(block.body);
  if (!parsed.ok || !Array.isArray(parsed.value)) {
    const reason = parsed.ok ? "json array required" : parsed.error;
    console.warn(`[wechat-publisher] invalid json layout block module="${block.name}" line=${block.line ?? 0} error=${reason}; rendering JSON fallback.`);
    return undefined;
  }
  return parsed.value.filter(isRecord);
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/\s*(?:\||,|，|、|;|；)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function baseBlockStyle(theme: Theme): string {
  const tokens = layoutTokens(theme);
  if (theme.presentation.style === "minimal") {
    return styleRecord({
      "margin": `${theme.spacing.block} 0`,
      "padding": "12px 14px",
      "background": tokens.surface
    });
  }
  if (theme.presentation.style === "focus") {
    return styleRecord({
      "margin": `${theme.spacing.block} 0`,
      "padding": "16px 12px",
      "background": tokens.surface
    });
  }
  return styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "18px 16px",
    "border-radius": theme.presentation.radius,
    "background": tokens.surface
  });
}

function timelineBlockStyle(theme: Theme): string {
  const tokens = layoutTokens(theme);
  if (theme.presentation.style === "minimal") {
    return styleRecord({
      "margin": `${theme.spacing.block} 0`,
      "padding": "12px 14px",
      "background": tokens.surface
    });
  }
  if (theme.presentation.style === "focus") {
    return styleRecord({
      "margin": `${theme.spacing.block} 0`,
      "padding": "16px 12px",
      "background": tokens.surface
    });
  }
  return styleRecord({
    "margin": `${theme.spacing.block} 0`,
    "padding": "18px 16px",
    "border-radius": theme.presentation.radius,
    "background": tokens.surface
  });
}

function embeddedContentCardStyle(theme: Theme): EmbeddedContentCardStyle {
  const tokens = layoutTokens(theme);
  if (theme.name === "tech") {
    return {
      background: tokens.canvas,
      shadow: ""
    };
  }
  if (theme.presentation.style === "minimal") {
    return {
      background: tokens.canvas,
      shadow: ""
    };
  }
  return {
    background: tokens.canvas,
    shadow: ""
  };
}

function subCardStyle(theme: Theme): string {
  const tokens = layoutTokens(theme);
  return styleRecord({
    "margin": "12px 0 0",
    "padding": "12px 12px 11px",
    "background": tokens.surface,
    "border": `1px solid ${tokens.subtleBorder}`,
    "border-left": `3px solid ${tokens.border}`,
    "border-radius": "12px"
  });
}

function blockTitleStyle(theme: Theme): string {
  const tokens = layoutTokens(theme);
  if (theme.presentation.style === "focus") {
    return styleRecord({
      "margin": "0 0 10px",
      "padding": "0 0 8px",
      "border-bottom": `1px solid ${tokens.border}`,
      "color": tokens.accent,
      "font-size": theme.typography.smallSize,
      "font-weight": "800",
      "text-align": "center"
    });
  }
  if (theme.presentation.style === "bold") {
    return styleRecord({
      "display": "inline-block",
      "margin": "0 0 10px",
      "padding": "4px 11px",
      "border-radius": "999px",
      "background": tokens.accent,
      "color": tokens.onAccent,
      "font-size": theme.typography.smallSize,
      "font-weight": "700"
    });
  }
  return styleRecord({
    "display": "inline-block",
    "margin": "0 0 8px",
    "padding": "4px 8px",
    "border-radius": "999px",
    "background": tokens.accentSoft,
    "color": tokens.accentDark,
    "font-size": theme.typography.smallSize,
    "font-weight": "800"
  });
}

function bodyTextStyle(theme: Theme, margin: string): string {
  const tokens = layoutTokens(theme);
  return styleRecord({
    "margin": margin,
    "font-size": theme.typography.bodySize,
    "line-height": theme.typography.lineHeight,
    "color": tokens.text
  });
}

function smallTextStyle(theme: Theme, margin: string): string {
  const tokens = layoutTokens(theme);
  return styleRecord({
    "margin": margin,
    "font-size": theme.typography.smallSize,
    "line-height": "1.7",
    "color": tokens.muted
  });
}

function resolveToneColor(tone: string, theme: Theme): string {
  switch (tone.toLowerCase()) {
    case "info":
      return theme.colors.info;
    case "tip":
      return theme.colors.tip;
    case "warning":
      return theme.colors.warning;
    case "success":
      return theme.colors.success;
    case "danger":
      return theme.colors.danger;
    default:
      return theme.colors.accent;
  }
}

function calloutToneTokens(tone: string, theme: Theme): CalloutToneTokens {
  const normalizedTone = tone.toLowerCase();
  const accent = resolveToneColor(normalizedTone, theme);
  const rgb = hexToRgbTriplet(accent);
  const backgroundAlpha = theme.name === "tech" ? "0.16" : "0.09";
  const borderAlpha = theme.name === "tech" ? "0.42" : "0.30";
  const labels: Record<string, string> = {
    info: "提示",
    tip: "提示",
    warning: "注意",
    success: "完成",
    danger: "风险"
  };
  return {
    label: labels[normalizedTone] ?? "提示",
    accent,
    background: `rgba(${rgb},${backgroundAlpha})`,
    border: `rgba(${rgb},${borderAlpha})`
  };
}

function hasCompatibleField(blockName: string, fields: Record<string, string>, fieldName: string): boolean {
  const aliases = compatibleFieldAliases(blockName, fieldName);
  return aliases.some((alias) => Boolean(fields[alias]));
}

function compatibleFieldAliases(blockName: string, fieldName: string): string[] {
  if (blockName === "cta" && fieldName === "title") {
    return ["title", "action"];
  }
  if (blockName === "summary" && fieldName === "highlight") {
    return ["highlight", "title"];
  }
  return [fieldName];
}

function hasJsonPathValue(record: Record<string, unknown>, path: string): boolean {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[key];
  }, record);
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function stringValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function stringArrayValue(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string" ? item : String(item)).filter((item) => item.trim() !== "");
  }
  if (typeof value === "string") {
    return splitList(value);
  }
  return [];
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
