import fs from "node:fs";
import path from "node:path";
import type {
  AccessTokenPayload,
  CreateDraftResult,
  DraftPayload,
  SubmitPublishResult,
  UploadArticleImageResult,
  UploadPermanentImageResult,
  WeChatErrorPayload,
  WeChatPublisherConfig
} from "./types.js";
import type { PublisherLogger } from "./logger.js";

interface StableTokenResponse extends WeChatErrorPayload {
  access_token?: string;
  expires_in?: number;
}

interface UploadArticleImageResponse extends WeChatErrorPayload {
  url?: string;
}

interface UploadPermanentImageResponse extends WeChatErrorPayload {
  media_id?: string;
  url?: string;
}

interface CreateDraftResponse extends WeChatErrorPayload {
  media_id?: string;
}

interface SubmitPublishResponse extends WeChatErrorPayload {
  publish_id?: string;
}

interface MultipartBody {
  body: Buffer;
  contentType: string;
}

export class WeChatClient {
  constructor(
    private readonly config: WeChatPublisherConfig,
    private readonly logger: PublisherLogger
  ) {}

  async getAccessToken(): Promise<string> {
    const cached = this.readCachedToken();
    if (cached && cached.appId === this.config.appId && cached.expiresAt > Date.now() + 60_000) {
      return cached.accessToken;
    }
    if (cached && cached.appId !== this.config.appId) {
      this.logger.warn("provider token cache abandoned because app id changed", {
        cachedAppId: cached.appId,
        requestedAppId: this.config.appId,
        tokenCacheFile: this.config.tokenCacheFile
      });
    }
    if (cached && cached.appId === this.config.appId && cached.expiresAt <= Date.now() + 60_000) {
      this.logger.warn("provider token cache expired; requesting a fresh stable token", {
        expiresAt: new Date(cached.expiresAt).toISOString()
      });
    }

    const response = await this.postJson<StableTokenResponse>("/cgi-bin/stable_token", {
      grant_type: "client_credential",
      appid: this.config.appId,
      secret: this.config.appSecret,
      force_refresh: false
    });

    this.assertWeChatSuccess(response, "get stable token");
    if (!response.access_token || !response.expires_in) {
      throw new Error("WeChat stable_token response missing access_token or expires_in");
    }

    const payload: AccessTokenPayload = {
      accessToken: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      appId: this.config.appId
    };
    this.writeCachedToken(payload);
    return payload.accessToken;
  }

  async uploadArticleImage(filePath: string): Promise<UploadArticleImageResult> {
    const token = await this.getAccessToken();
    const response = await this.postMultipart<UploadArticleImageResponse>(`/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(token)}`, filePath);
    this.assertWeChatSuccess(response, "upload article image");
    if (!response.url) {
      throw new Error("WeChat uploadimg response missing url");
    }
    return {
      url: response.url
    };
  }

  async uploadPermanentImage(filePath: string): Promise<UploadPermanentImageResult> {
    const token = await this.getAccessToken();
    const response = await this.postMultipart<UploadPermanentImageResponse>(`/cgi-bin/material/add_material?access_token=${encodeURIComponent(token)}&type=image`, filePath);
    this.assertWeChatSuccess(response, "upload permanent image");
    if (!response.media_id) {
      throw new Error("WeChat permanent material response missing media_id");
    }
    return {
      mediaId: response.media_id,
      url: response.url
    };
  }

  async createDraft(payload: DraftPayload): Promise<CreateDraftResult> {
    const token = await this.getAccessToken();
    const response = await this.postJson<CreateDraftResponse>(`/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`, payload);
    this.assertWeChatSuccess(response, "create draft");
    if (!response.media_id) {
      throw new Error("WeChat draft/add response missing media_id");
    }
    return {
      mediaId: response.media_id
    };
  }

  async submitPublish(mediaId: string): Promise<SubmitPublishResult> {
    const token = await this.getAccessToken();
    const response = await this.postJson<SubmitPublishResponse>(`/cgi-bin/freepublish/submit?access_token=${encodeURIComponent(token)}`, {
      media_id: mediaId
    });
    this.assertWeChatSuccess(response, "submit publish");
    if (!response.publish_id) {
      throw new Error("WeChat freepublish/submit response missing publish_id");
    }
    return {
      publishId: response.publish_id
    };
  }

  private readCachedToken(): AccessTokenPayload | undefined {
    if (!fs.existsSync(this.config.tokenCacheFile)) {
      return undefined;
    }
    try {
      return JSON.parse(fs.readFileSync(this.config.tokenCacheFile, "utf8")) as AccessTokenPayload;
    } catch (error) {
      this.logger.warn("provider token cache parse failed; cache file ignored", {
        tokenCacheFile: this.config.tokenCacheFile,
        error: String(error)
      });
      return undefined;
    }
  }

  private writeCachedToken(payload: AccessTokenPayload): void {
    fs.mkdirSync(path.dirname(this.config.tokenCacheFile), { recursive: true });
    fs.writeFileSync(this.config.tokenCacheFile, JSON.stringify(payload, null, 2));
  }

  private async postJson<TResponse extends WeChatErrorPayload>(endpoint: string, payload: unknown): Promise<TResponse> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return this.parseJsonResponse<TResponse>(response);
  }

  private async postMultipart<TResponse extends WeChatErrorPayload>(endpoint: string, filePath: string): Promise<TResponse> {
    const multipart = buildMultipartBody(filePath);
    const response = await fetch(this.buildUrl(endpoint), {
      method: "POST",
      headers: {
        "content-type": multipart.contentType,
        "content-length": String(multipart.body.byteLength)
      },
      body: multipart.body as unknown as BodyInit
    });
    return this.parseJsonResponse<TResponse>(response);
  }

  private async parseJsonResponse<TResponse extends WeChatErrorPayload>(response: Response): Promise<TResponse> {
    const text = await response.text();
    let payload: TResponse;
    try {
      payload = JSON.parse(text) as TResponse;
    } catch (error) {
      throw new Error(`WeChat response is not JSON status=${response.status} body=${text.slice(0, 300)} error=${String(error)}`);
    }
    if (!response.ok) {
      throw new Error(`WeChat HTTP error status=${response.status} body=${text.slice(0, 300)}`);
    }
    return payload;
  }

  private assertWeChatSuccess(payload: WeChatErrorPayload, action: string): void {
    if (!payload.errcode || payload.errcode === 0) {
      return;
    }
    const hint = explainWeChatError(payload.errcode);
    throw new Error(`${action} failed errcode=${payload.errcode} errmsg=${payload.errmsg ?? ""}${hint ? ` hint=${hint}` : ""}`);
  }

  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    return `${this.config.apiBaseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  }
}

function buildMultipartBody(filePath: string): MultipartBody {
  const boundary = `----wechat-publisher-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const filename = path.basename(filePath);
  const file = fs.readFileSync(filePath);
  const header = Buffer.from([
    `--${boundary}`,
    `Content-Disposition: form-data; name="media"; filename="${filename}"`,
    `Content-Type: ${mimeType(filePath)}`,
    "",
    ""
  ].join("\r\n"));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    body: Buffer.concat([header, file, footer]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function explainWeChatError(code: number): string {
  switch (code) {
    case 40001:
      return "access_token invalid; check AppID/AppSecret and token cache.";
    case 45004:
      return "draft content, title, digest, or embedded HTML may exceed WeChat limits.";
    case 48001:
      return "API is unauthorized; check official account type, certification, and interface permissions.";
    case 40164:
    case 61004:
      return "IP is not in WeChat API whitelist.";
    default:
      return "";
  }
}
