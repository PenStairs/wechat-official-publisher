#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadPublisherConfig, validateWeChatConfig } from "./config.js";
import { wrapPreviewDocument } from "./html.js";
import { FilePublisherLogger } from "./logger.js";
import { ArticlePublisher, renderArticleFile } from "./publisher.js";
import { themes } from "./themes.js";
import { buildAgentLayoutGuide, getSupportedBlockMetadata, listArticleAssets, listSupportedBlockMetadata, summarizeArticleAssets, type ArticleAssetKind } from "./layout-assets.js";
import { WeChatClient } from "./wechat-client.js";

interface ParsedCli {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

interface CliResponse {
  success: boolean;
  code: string;
  message?: string;
  data?: unknown;
  error?: string;
  nextActions?: string[];
}

async function main(): Promise<void> {
  const parsed = parseCli(process.argv.slice(2));
  try {
    const response = await runCommand(parsed);
    emitResponse(response, Boolean(parsed.flags.json));
    process.exitCode = response.success ? 0 : 1;
  } catch (error) {
    emitResponse({
      success: false,
      code: "ERROR",
      error: error instanceof Error ? error.message : String(error)
    }, Boolean(parsed.flags.json));
    process.exitCode = 1;
  }
}

async function runCommand(parsed: ParsedCli): Promise<CliResponse> {
  switch (parsed.command) {
    case "":
    case "help":
      return helpResponse();
    case "version":
      return ok("VERSION", { version: "0.1.0" });
    case "themes":
      return ok("THEMES_LISTED", {
        localThemes: Object.values(themes).map((theme) => ({ name: theme.name, description: theme.description, renderingSupport: "local" })),
        note: "Only the local writing-scenario themes are rendered by this CLI."
      });
    case "blocks":
      return blocksCommand(parsed);
    case "assets":
      return assetsCommand(parsed);
    case "inspect":
      return inspectCommand(parsed);
    case "render":
    case "preview":
      return renderCommand(parsed);
    case "doctor":
      return doctorCommand();
    case "upload-image":
      return uploadImageCommand(parsed);
    case "draft":
      return draftCommand(parsed);
    case "publish":
      return publishCommand(parsed);
    default:
      return {
        success: false,
        code: "UNKNOWN_COMMAND",
        error: `unknown command: ${parsed.command}`,
        nextActions: ["Run `wechat-publisher help`."]
      };
  }
}

function assetsCommand(parsed: ParsedCli): CliResponse {
  const kind = normalizeAssetKind(parsed.positional[0]);
  if (parsed.positional[0] && !kind) {
    return {
      success: false,
      code: "ASSET_KIND_INVALID",
      error: `unknown asset kind: ${parsed.positional[0]}`,
      nextActions: ["Use `layouts` or omit the kind to list all local article assets."]
    };
  }
  return ok("ASSETS_LISTED", {
    summary: summarizeArticleAssets(),
    assets: listArticleAssets(kind)
  });
}

function blocksCommand(parsed: ParsedCli): CliResponse {
  const blockName = parsed.positional[0];
  const agentMarkdown = Boolean(parsed.flags["agent-md"]);
  if (blockName) {
    const block = getSupportedBlockMetadata(blockName);
    if (!block) {
      return {
        success: false,
        code: "BLOCK_NOT_FOUND",
        error: `unknown supported block: ${blockName}`,
        nextActions: ["Run `wechat-publisher blocks --json` to list supported blocks."]
      };
    }
    if (agentMarkdown) {
      return {
        success: true,
        code: "BLOCK_AGENT_GUIDE_RENDERED",
        message: buildAgentLayoutGuide([block])
      };
    }
    return ok("BLOCK_METADATA_LOADED", { block });
  }

  if (agentMarkdown) {
    return {
      success: true,
      code: "BLOCK_AGENT_GUIDE_RENDERED",
      message: buildAgentLayoutGuide()
    };
  }

  return ok("BLOCKS_LISTED", {
    blocks: listSupportedBlockMetadata(),
    note: "These blocks are locally rendered by the CLI. Metadata is loaded from resources/layouts."
  });
}

function inspectCommand(parsed: ParsedCli): CliResponse {
  const articlePath = requireArg(parsed, 0, "article path");
  const publisher = newPublisher();
  const result = publisher.inspectArticleFile({
    articlePath,
    themeName: stringFlag(parsed, "theme")
  });

  return ok("INSPECT_COMPLETED", {
    metadata: result.article.metadata,
    imageCount: result.imageCount,
    missingLocalImages: result.missingLocalImages,
    readiness: {
      render: result.readyForRender,
      draft: result.readyForDraft,
      blockers: result.blockers
    }
  });
}

function renderCommand(parsed: ParsedCli): CliResponse {
  const articlePath = requireArg(parsed, 0, "article path");
  const result = renderArticleFile({
    articlePath,
    themeName: stringFlag(parsed, "theme")
  });
  const outputPath = stringFlag(parsed, "out");
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, wrapPreviewDocument(result.rendered.html, result.article.metadata.title));
  }

  return ok("RENDER_COMPLETED", {
    metadata: result.article.metadata,
    outputPath,
    html: outputPath ? undefined : result.rendered.html,
    imageCount: result.rendered.images.length
  });
}

function doctorCommand(): CliResponse {
  const config = loadPublisherConfig();
  const missing = validateWeChatConfig(config);
  return ok("DOCTOR_COMPLETED", {
    config: {
      appIdPresent: Boolean(config.appId),
      appSecretPresent: Boolean(config.appSecret),
      apiBaseUrl: config.apiBaseUrl,
      tokenCacheFile: config.tokenCacheFile,
      logFile: config.logFile
    },
    readiness: {
      draft: missing.length === 0,
      blockers: missing.map((name) => `missing ${name}`)
    }
  });
}

async function uploadImageCommand(parsed: ParsedCli): Promise<CliResponse> {
  assertConfigReady();
  const imagePath = requireArg(parsed, 0, "image path");
  const purpose = stringFlag(parsed, "purpose") ?? "inline";
  const publisher = newPublisher();
  if (purpose === "cover") {
    const mediaId = await publisher.uploadCoverImage(imagePath);
    return ok("COVER_IMAGE_UPLOADED", { mediaId });
  }

  const url = await publisher.uploadArticleImage(imagePath);
  return ok("ARTICLE_IMAGE_UPLOADED", { url });
}

async function draftCommand(parsed: ParsedCli): Promise<CliResponse> {
  assertConfigReady();
  const articlePath = requireArg(parsed, 0, "article path");
  const publisher = newPublisher();
  const result = await publisher.publishDraft({
    articlePath,
    themeName: stringFlag(parsed, "theme"),
    coverPath: stringFlag(parsed, "cover"),
    coverMediaId: stringFlag(parsed, "cover-media-id"),
    outputPath: stringFlag(parsed, "out")
  });

  return ok("DRAFT_CREATED", {
    mediaId: result.mediaId,
    coverMediaId: result.coverMediaId,
    metadata: result.article.metadata,
    html: parsed.flags.includeHtml ? result.html : undefined
  });
}

async function publishCommand(parsed: ParsedCli): Promise<CliResponse> {
  assertConfigReady();
  const mediaId = requireArg(parsed, 0, "draft media_id");
  const config = loadPublisherConfig();
  const logger = new FilePublisherLogger(config.logFile);
  const wechat = new WeChatClient(config, logger);
  const result = await wechat.submitPublish(mediaId);
  return ok("PUBLISH_SUBMITTED", result);
}

function newPublisher(): ArticlePublisher {
  const config = loadPublisherConfig();
  const logger = new FilePublisherLogger(config.logFile);
  const wechat = new WeChatClient(config, logger);
  return new ArticlePublisher(wechat, logger);
}

function assertConfigReady(): void {
  const config = loadPublisherConfig();
  const missing = validateWeChatConfig(config);
  if (missing.length > 0) {
    throw new Error(`WeChat config is not ready; missing ${missing.join(", ")}`);
  }
}

function parseCli(args: string[]): ParsedCli {
  const [command = "", ...rest] = args;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[name] = true;
      continue;
    }
    flags[name] = next;
    index++;
  }

  return {
    command,
    positional,
    flags
  };
}

function requireArg(parsed: ParsedCli, index: number, label: string): string {
  const value = parsed.positional[index];
  if (!value) {
    throw new Error(`missing ${label}`);
  }
  return value;
}

function stringFlag(parsed: ParsedCli, name: string): string | undefined {
  const value = parsed.flags[name];
  return typeof value === "string" ? value : undefined;
}

function ok(code: string, data: unknown): CliResponse {
  return {
    success: true,
    code,
    data
  };
}

function helpResponse(): CliResponse {
  return ok("HELP", {
    commands: [
      "inspect <article.md> [--theme name] [--json]",
      "render <article.md> [--theme name] [--out preview.html] [--json]",
      "preview <article.md> [--theme name] [--out preview.html] [--json]",
      "upload-image <image> [--purpose inline|cover] [--json]",
      "draft <article.md> --cover cover.jpg|--cover-media-id id [--theme name] [--out final.html] [--json]",
      "publish <draft_media_id> [--json]",
      "doctor [--json]",
      "themes [--json]",
      "blocks [block-name] [--agent-md] [--json]",
      "assets [layouts] [--json]"
    ]
  });
}

function normalizeAssetKind(value: string | undefined): ArticleAssetKind | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "layout":
    case "layouts":
      return "layout";
    default:
      return undefined;
  }
}

function emitResponse(response: CliResponse, json: boolean): void {
  const normalized = removeUndefined(response);
  if (json) {
    console.log(JSON.stringify(normalized, null, 2));
    return;
  }
  if (response.success) {
    console.log(response.message ?? `${response.code}`);
    if (response.data !== undefined) {
      console.log(JSON.stringify(removeUndefined(response.data), null, 2));
    }
    return;
  }
  console.error(response.error ?? response.message ?? response.code);
  if (response.nextActions?.length) {
    console.error(response.nextActions.join("\n"));
  }
}

function removeUndefined<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefined(item)) as TValue;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      output[key] = removeUndefined(child);
    }
  }
  return output as TValue;
}

await main();
