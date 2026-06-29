import path from "node:path";
import { fixedArticleAuthor } from "./article-defaults.js";
import type { ArticleDocument, ArticleMetadata } from "./types.js";

interface ParsedFrontmatter {
  data: Record<string, string | boolean>;
  body: string;
}

export function parseArticleDocument(markdown: string, sourcePath?: string): ArticleDocument {
  const normalized = normalizeMarkdown(markdown);
  const parsedFrontmatter = parseFrontmatter(normalized);
  const body = parsedFrontmatter?.body ?? normalized;
  const metadata = resolveArticleMetadata(parsedFrontmatter?.data ?? {}, body);

  return {
    metadata,
    body,
    sourcePath,
    sourceDir: sourcePath ? path.dirname(sourcePath) : undefined
  };
}

function resolveArticleMetadata(frontmatter: Record<string, string | boolean>, body: string): ArticleMetadata {
  const title = stringValue(frontmatter.title) || parseMarkdownTitle(body);
  const digest = firstNonEmpty(
    stringValue(frontmatter.digest),
    stringValue(frontmatter.summary),
    stringValue(frontmatter.description)
  );

  return {
    title,
    author: fixedArticleAuthor,
    digest: digest || undefined,
    cover: optionalString(frontmatter.cover),
    theme: optionalString(frontmatter.theme),
    contentSourceUrl: optionalString(frontmatter.content_source_url) ?? optionalString(frontmatter.contentSourceUrl),
    showCoverPic: optionalBoolean(frontmatter.show_cover_pic) ?? optionalBoolean(frontmatter.showCoverPic),
    needOpenComment: optionalBoolean(frontmatter.need_open_comment) ?? optionalBoolean(frontmatter.needOpenComment),
    onlyFansCanComment: optionalBoolean(frontmatter.only_fans_can_comment) ?? optionalBoolean(frontmatter.onlyFansCanComment)
  };
}

function parseFrontmatter(markdown: string): ParsedFrontmatter | undefined {
  const lines = markdown.split("\n");
  if (lines.length < 3 || lines[0].trim() !== "---") {
    return undefined;
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex <= 0) {
    console.warn("[wechat-publisher] frontmatter opener found but closer is missing; frontmatter ignored.");
    return undefined;
  }

  const data: Record<string, string | boolean> = {};
  for (const line of lines.slice(1, endIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      console.warn(`[wechat-publisher] invalid frontmatter line ignored: ${trimmed}`);
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    data[key] = parseFrontmatterValue(rawValue);
  }

  return {
    data,
    body: lines.slice(endIndex + 1).join("\n").trimStart()
  };
}

function parseFrontmatterValue(rawValue: string): string | boolean {
  const unquoted = rawValue.replace(/^['"]|['"]$/g, "");
  if (unquoted === "true") {
    return true;
  }
  if (unquoted === "false") {
    return false;
  }
  return unquoted;
}

function parseMarkdownTitle(body: string): string {
  for (const line of body.split("\n")) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match) {
      return match[1].trim();
    }
  }
  return "";
}

function optionalString(value: string | boolean | undefined): string | undefined {
  const text = stringValue(value);
  return text === "" ? undefined : text;
}

function stringValue(value: string | boolean | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function optionalBoolean(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no") {
    return false;
  }
  return undefined;
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value.trim() !== "")?.trim() ?? "";
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
}
