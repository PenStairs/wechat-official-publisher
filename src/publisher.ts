import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixedArticleAuthor } from "./article-defaults.js";
import { parseArticleDocument } from "./article-parser.js";
import { escapeAttribute } from "./html.js";
import { renderMarkdownArticle } from "./markdown-renderer.js";
import { resolveTheme } from "./themes.js";
import type { PublisherLogger } from "./logger.js";
import type {
  ArticleDocument,
  DraftArtifact,
  DraftPayload,
  PublishDraftInput,
  RenderedArticle,
  RenderedImage
} from "./types.js";
import { WeChatClient } from "./wechat-client.js";

export interface RenderArticleFileInput {
  articlePath: string;
  themeName?: string;
}

export interface RenderArticleFileOutput {
  article: ArticleDocument;
  rendered: RenderedArticle;
}

export interface PublishDraftOutput {
  mediaId: string;
  article: ArticleDocument;
  coverMediaId: string;
  html: string;
}

export interface InspectArticleOutput {
  article: ArticleDocument;
  imageCount: number;
  missingLocalImages: string[];
  readyForRender: boolean;
  readyForDraft: boolean;
  blockers: string[];
}

interface RewriteImageInput {
  html: string;
  images: RenderedImage[];
  articleDir: string;
}

interface RewriteImageOutput {
  html: string;
}

interface ImageSourceRewriteResult {
  html: string;
  replacementCount: number;
}

export class ArticlePublisher {
  constructor(
    private readonly wechat: WeChatClient,
    private readonly logger: PublisherLogger
  ) {}

  inspectArticleFile(input: RenderArticleFileInput): InspectArticleOutput {
    const output = renderArticleFile(input);
    const missingLocalImages = output.rendered.images
      .map((image) => resolveImagePath(image.source, output.article.sourceDir ?? process.cwd()))
      .filter((imagePath): imagePath is string => Boolean(imagePath))
      .filter((imagePath) => !fs.existsSync(imagePath));
    const blockers = inspectDraftBlockers(output.article, missingLocalImages);

    return {
      article: output.article,
      imageCount: output.rendered.images.length,
      missingLocalImages,
      readyForRender: Boolean(output.article.metadata.title),
      readyForDraft: blockers.length === 0,
      blockers
    };
  }

  async publishDraft(input: PublishDraftInput): Promise<PublishDraftOutput> {
    const output = renderArticleFile(input);
    const articleDir = output.article.sourceDir ?? process.cwd();

    // 先把正文图片上传到微信图文图片接口，并把 HTML 中的 src 改写成微信 URL。
    const rewritten = await this.rewriteArticleImages({
      html: output.rendered.html,
      images: output.rendered.images,
      articleDir
    });

    // 再处理封面：优先使用显式 media_id，否则上传本地/远程封面为永久素材。
    const coverMediaId = await this.resolveCoverMediaId(input, output.article, articleDir);

    const payload = buildDraftPayload({
      metadata: output.article.metadata,
      html: rewritten.html,
      coverMediaId
    });
    const draft = await this.wechat.createDraft(payload);

    if (input.outputPath) {
      fs.writeFileSync(input.outputPath, rewritten.html);
    }

    return {
      mediaId: draft.mediaId,
      article: output.article,
      coverMediaId,
      html: rewritten.html
    };
  }

  async uploadArticleImage(imagePath: string): Promise<string> {
    const localPath = await this.resolveUploadableImage(imagePath, process.cwd());
    const result = await this.wechat.uploadArticleImage(localPath);
    return result.url;
  }

  async uploadCoverImage(imagePath: string): Promise<string> {
    const localPath = await this.resolveUploadableImage(imagePath, process.cwd());
    const result = await this.wechat.uploadPermanentImage(localPath);
    return result.mediaId;
  }

  private async rewriteArticleImages(input: RewriteImageInput): Promise<RewriteImageOutput> {
    let html = input.html;
    for (const image of input.images) {
      const uploadablePath = await this.resolveUploadableImage(image.source, input.articleDir);
      const result = await this.wechat.uploadArticleImage(uploadablePath);
      const rewrite = replaceImageSource(html, image.source, result.url);
      if (rewrite.replacementCount === 0) {
        this.logger.warn("article image uploaded but no matching src was rewritten", {
          source: image.source,
          url: result.url
        });
        throw new Error(`article image uploaded but HTML src was not rewritten: ${image.source}`);
      }
      html = rewrite.html;
      this.logger.info("article image uploaded and rewritten", {
        source: image.source,
        url: result.url,
        replacementCount: rewrite.replacementCount
      });
    }
    return {
      html
    };
  }

  private async resolveCoverMediaId(input: PublishDraftInput, article: ArticleDocument, articleDir: string): Promise<string> {
    if (input.coverPath && input.coverMediaId) {
      throw new Error("draft cover input conflict: --cover and --cover-media-id cannot be used together");
    }
    if (input.coverMediaId) {
      return input.coverMediaId;
    }

    const coverPath = input.coverPath ?? article.metadata.cover;
    if (!coverPath) {
      throw new Error("draft creation requires a cover image path or cover media_id");
    }

    const uploadablePath = await this.resolveUploadableImage(coverPath, articleDir);
    const result = await this.wechat.uploadPermanentImage(uploadablePath);
    this.logger.info("cover image uploaded", {
      coverPath,
      mediaId: maskId(result.mediaId)
    });
    return result.mediaId;
  }

  private async resolveUploadableImage(source: string, baseDir: string): Promise<string> {
    if (isRemoteUrl(source)) {
      return downloadRemoteImage(source, this.logger);
    }

    const imagePath = path.isAbsolute(source) ? source : path.join(baseDir, source);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`image file not found: ${imagePath}`);
    }
    return imagePath;
  }
}

export function renderArticleFile(input: RenderArticleFileInput): RenderArticleFileOutput {
  const markdown = fs.readFileSync(input.articlePath, "utf8");
  const article = parseArticleDocument(markdown, input.articlePath);
  const theme = resolveTheme(input.themeName ?? article.metadata.theme);
  const rendered = renderMarkdownArticle(article.body, theme);

  return {
    article,
    rendered
  };
}

export function buildDraftPayload(artifact: DraftArtifact): DraftPayload {
  const metadata = artifact.metadata;
  const article = {
    title: metadata.title,
    author: fixedArticleAuthor,
    digest: metadata.digest,
    content: artifact.html,
    thumb_media_id: artifact.coverMediaId,
    show_cover_pic: metadata.showCoverPic ? 1 : 0,
    content_source_url: metadata.contentSourceUrl,
    need_open_comment: metadata.needOpenComment === undefined ? undefined : metadata.needOpenComment ? 1 : 0,
    only_fans_can_comment: metadata.onlyFansCanComment === undefined ? undefined : metadata.onlyFansCanComment ? 1 : 0
  } as const;

  return {
    articles: [dropUndefined(article)]
  };
}

function inspectDraftBlockers(article: ArticleDocument, missingLocalImages: string[]): string[] {
  const blockers: string[] = [];
  if (!article.metadata.title) {
    blockers.push("missing title");
  }
  if (!article.metadata.cover) {
    blockers.push("missing cover; use frontmatter cover or --cover/--cover-media-id");
  } else {
    const coverPath = resolveImagePath(article.metadata.cover, article.sourceDir ?? process.cwd());
    if (coverPath && !fs.existsSync(coverPath)) {
      blockers.push(`missing cover image: ${coverPath}`);
    }
  }
  for (const imagePath of missingLocalImages) {
    blockers.push(`missing local image: ${imagePath}`);
  }
  return blockers;
}

function resolveImagePath(source: string, baseDir: string): string | undefined {
  if (isRemoteUrl(source)) {
    return undefined;
  }
  return path.isAbsolute(source) ? source : path.join(baseDir, source);
}

async function downloadRemoteImage(source: string, logger: PublisherLogger): Promise<string> {
  const url = new URL(source);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`unsupported remote image protocol: ${url.protocol}`);
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`download image failed status=${response.status} url=${source}`);
  }

  const extension = path.extname(url.pathname) || ".jpg";
  const tmpPath = path.join(os.tmpdir(), `wechat-publisher-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
  const data = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tmpPath, data);
  logger.warn("remote image downloaded to temporary file for WeChat upload", {
    source,
    tmpPath
  });
  return tmpPath;
}

function replaceImageSource(html: string, originalSource: string, replacementUrl: string): ImageSourceRewriteResult {
  let rewrittenHtml = html;
  let replacementCount = 0;
  const replacementAttribute = escapeAttribute(replacementUrl);
  const sourceCandidates = new Set([originalSource, escapeAttribute(originalSource)]);

  for (const source of sourceCandidates) {
    const escaped = escapeRegExp(source);
    rewrittenHtml = rewrittenHtml
      .replace(new RegExp(`src="${escaped}"`, "g"), () => {
        replacementCount++;
        return `src="${replacementAttribute}"`;
      })
      .replace(new RegExp(`src='${escaped}'`, "g"), () => {
        replacementCount++;
        return `src='${replacementAttribute}'`;
      });
  }

  return {
    html: rewrittenHtml,
    replacementCount
  };
}

function dropUndefined<TRecord extends Record<string, unknown>>(record: TRecord): TRecord {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined && value !== "") {
      output[key] = value;
    }
  }
  return output as TRecord;
}

function isRemoteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskId(id: string): string {
  if (id.length < 8) {
    return "***";
  }
  return `${id.slice(0, 4)}***${id.slice(-4)}`;
}
