import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { BlockBodyFormat, BlockFieldMetadata, BlockRowsMetadata, SupportedBlockMetadata } from "./types.js";

export type ArticleAssetKind = "layout";

export interface ArticleAsset {
  kind: ArticleAssetKind;
  key: string;
  name: string;
  category?: string;
  description?: string;
  filePath: string;
  source: "wechat-official-publisher";
  renderingSupport: "local";
  metadata?: SupportedBlockMetadata;
}

export interface ArticleAssetSummary {
  source: "wechat-official-publisher";
  resourceRoot: string;
  note: string;
  counts: Record<ArticleAssetKind, number>;
}

const supportedLayoutOrder = ["hero", "summary", "callout", "quote", "reading-note", "section", "steps", "timeline", "cta"];

export function buildAgentLayoutGuide(blocks: SupportedBlockMetadata[] = listSupportedBlockMetadata()): string {
  const sections = blocks.map((block) => {
    const requiredFields = block.fields.required.map(formatFieldForAgent).join("\n") || "- 无";
    const optionalFields = block.fields.optional.map(formatFieldForAgent).join("\n") || "- 无";
    const rowSchema = block.rows ? [
      `- delimiter: ${block.rows.delimiter ?? "line"}`,
      `- minColumns: ${block.rows.minColumns ?? "无"}`,
      ...block.rows.columns.map(formatFieldForAgent)
    ].join("\n") : "- 无";

    return [
      `## ${block.name}`,
      `- position: ${block.position ?? "body"}`,
      `- body_format: ${block.bodyFormat}`,
      `- when_to_use: ${normalizeGuideText(block.whenToUse) || "无"}`,
      `- when_not_to_use: ${normalizeGuideText(block.whenNotToUse) || "无"}`,
      `- anti_pattern: ${normalizeGuideText(block.antiPattern) || "无"}`,
      "",
      "Required fields:",
      requiredFields,
      "",
      "Optional fields:",
      optionalFields,
      "",
      "Rows schema:",
      rowSchema,
      "",
      "Example:",
      "```md",
      block.example ?? "",
      "```"
    ].join("\n");
  });

  return [
    "# WeChat Article Layout Guide",
    "",
    "Use only the layouts listed below. Do not invent layout names or fields.",
    "Keep normal Markdown for ordinary paragraphs; add layouts only where they improve reading structure.",
    "The publisher renders these :::layout blocks during inspect/render/draft, so do not convert them to HTML.",
    "",
    "Recommended placement:",
    "- opening: at most one hero near the beginning.",
    "- body: section, callout, quote, steps, timeline as needed.",
    "- closing: summary and at most one cta near the end.",
    "",
    ...sections
  ].join("\n");
}

export function articleAssetRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../resources");
}

export function listArticleAssets(kind?: ArticleAssetKind): ArticleAsset[] {
  const assets = listLayoutAssets();
  return kind ? assets.filter((asset) => asset.kind === kind) : assets;
}

export function listSupportedBlockMetadata(): SupportedBlockMetadata[] {
  return listLayoutAssets()
    .map((asset) => asset.metadata)
    .filter((metadata): metadata is SupportedBlockMetadata => Boolean(metadata));
}

export function getSupportedBlockMetadata(name: string): SupportedBlockMetadata | undefined {
  return listSupportedBlockMetadata().find((metadata) => metadata.name === name);
}

export function summarizeArticleAssets(): ArticleAssetSummary {
  const counts: Record<ArticleAssetKind, number> = {
    layout: 0
  };
  for (const asset of listArticleAssets()) {
    counts[asset.kind]++;
  }

  return {
    source: "wechat-official-publisher",
    resourceRoot: articleAssetRoot(),
    note: "Only the layout metadata used by the current WeChat article renderer is kept in this local resource catalog.",
    counts
  };
}

function listLayoutAssets(): ArticleAsset[] {
  const root = path.join(articleAssetRoot(), "layouts");
  const assetsByName = new Map(listYamlFiles(root).map((filePath) => {
    const raw = parseYamlFile(filePath);
    const name = stringField(raw, "name") || path.basename(filePath, path.extname(filePath));
    const category = stringField(raw, "category") || "general";
    const asset: ArticleAsset = {
      kind: "layout",
      key: `layouts/${name}`,
      name,
      category,
      description: stringField(raw, "when_to_use") || stringField(raw, "description"),
      filePath,
      source: "wechat-official-publisher",
      renderingSupport: "local",
      metadata: parseSupportedBlockMetadata(raw, name, category)
    };
    return [asset.name, asset] as const;
  }));
  return supportedLayoutOrder.map((name) => assetsByName.get(name)).filter((asset): asset is ArticleAsset => Boolean(asset));
}

function formatFieldForAgent(field: BlockFieldMetadata): string {
  const details = [
    field.description,
    field.example ? `example: ${field.example}` : undefined,
    field.enum?.length ? `enum: ${field.enum.join(" / ")}` : undefined
  ].filter(Boolean).join("；");
  return details ? `- ${field.name}: ${details}` : `- ${field.name}`;
}

function normalizeGuideText(value: string | undefined): string {
  return value?.replace(/\s*\n\s*/g, " ").trim() ?? "";
}

function listYamlFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    console.warn(`[wechat-publisher] article asset root missing: ${root}`);
    return [];
  }
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listYamlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function parseYamlFile(filePath: string): unknown {
  try {
    return YAML.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[wechat-publisher] article asset parse failed file="${filePath}" error=${String(error)}`);
    return {};
  }
}

function parseSupportedBlockMetadata(raw: unknown, fallbackName: string, fallbackCategory: string): SupportedBlockMetadata {
  const metadataRecord = recordField(raw, "metadata");
  return {
    name: stringField(raw, "name") ?? fallbackName,
    bodyFormat: parseBodyFormat(stringField(raw, "body_format")),
    version: stringField(raw, "version"),
    since: stringField(raw, "since"),
    category: stringField(raw, "category") ?? fallbackCategory,
    serves: stringArrayField(raw, "serves"),
    contentTypes: stringArrayField(raw, "content_types"),
    industry: stringArrayField(raw, "industry"),
    tags: stringArrayField(raw, "tags"),
    position: stringField(raw, "position"),
    whenToUse: stringField(raw, "when_to_use"),
    whenNotToUse: stringField(raw, "when_not_to_use"),
    pairsWellWith: stringArrayField(raw, "pairs_well_with"),
    avoidCombiningWith: stringArrayField(raw, "avoid_combining_with"),
    antiPattern: stringField(raw, "anti_pattern"),
    fields: parseBlockFields(recordField(raw, "fields")),
    rows: parseBlockRows(recordField(raw, "rows")),
    example: stringField(raw, "example"),
    metadata: {
      author: stringField(metadataRecord, "author"),
      provenance: stringField(metadataRecord, "provenance"),
      inspiredBy: stringField(metadataRecord, "inspired_by")
    },
    renderingSupport: "local"
  };
}

function parseBodyFormat(value: string | undefined): BlockBodyFormat {
  switch (value) {
    case "fields":
    case "rows":
    case "json_object":
    case "json_array":
      return value;
    default:
      return "text";
  }
}

function parseBlockFields(value: Record<string, unknown> | undefined): SupportedBlockMetadata["fields"] {
  return {
    required: fieldList(value?.required),
    optional: fieldList(value?.optional)
  };
}

function parseBlockRows(value: Record<string, unknown> | undefined): BlockRowsMetadata | undefined {
  if (!value) {
    return undefined;
  }
  const columns = fieldList(value.schema).concat(fieldList(value.columns));
  return {
    delimiter: typeof value.delimiter === "string" ? value.delimiter : undefined,
    minColumns: numberField(value, "min_columns") ?? numberField(value, "min_cols"),
    columns
  };
}

function fieldList(value: unknown): BlockFieldMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const field = asRecord(item);
    const enumValue = field.enum;
    return {
      name: stringField(field, "name") ?? "",
      description: stringField(field, "description"),
      example: stringField(field, "example"),
      enum: Array.isArray(enumValue) ? enumValue.filter((entry): entry is string => typeof entry === "string") : undefined
    };
  }).filter((field) => field.name !== "");
}

function stringField(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" && fieldValue.trim() !== "" ? fieldValue.trim() : undefined;
}

function stringArrayField(value: unknown, field: string): string[] {
  const fieldValue = asRecord(value)[field];
  if (!Array.isArray(fieldValue)) {
    return [];
  }
  return fieldValue.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "").map((entry) => entry.trim());
}

function numberField(value: unknown, field: string): number | undefined {
  const fieldValue = asRecord(value)[field];
  return typeof fieldValue === "number" ? fieldValue : undefined;
}

function recordField(value: unknown, field: string): Record<string, unknown> | undefined {
  const fieldValue = asRecord(value)[field];
  return isRecord(fieldValue) ? fieldValue : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
