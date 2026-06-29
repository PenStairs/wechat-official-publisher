import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NullPublisherLogger } from "../src/logger.js";
import { WeChatClient } from "../src/wechat-client.js";
import type { WeChatPublisherConfig } from "../src/types.js";

describe("WeChatClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("gets a stable token and creates a draft with the official draft endpoint", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-client-test-"));
    const config: WeChatPublisherConfig = {
      appId: "appid",
      appSecret: "secret",
      apiBaseUrl: "https://api.weixin.qq.com",
      tokenCacheFile: path.join(dir, "token.json"),
      logFile: path.join(dir, "publisher.log")
    };
    const calls: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/cgi-bin/stable_token")) {
        return jsonResponse({ access_token: "token", expires_in: 7200 });
      }
      if (url.includes("/cgi-bin/draft/add")) {
        return jsonResponse({ errcode: 0, errmsg: "ok", media_id: "draft-media-id" });
      }
      return jsonResponse({ errcode: 404, errmsg: "unexpected" });
    }) as typeof fetch;

    const client = new WeChatClient(config, new NullPublisherLogger());
    const result = await client.createDraft({
      articles: [
        {
          title: "标题",
          content: "<p>正文</p>",
          thumb_media_id: "cover-id",
          show_cover_pic: 0
        }
      ]
    });

    expect(result.mediaId).toBe("draft-media-id");
    expect(calls).toEqual([
      "https://api.weixin.qq.com/cgi-bin/stable_token",
      "https://api.weixin.qq.com/cgi-bin/draft/add?access_token=token"
    ]);
  });

  it("reuses a valid token cache for publish submit", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-client-test-"));
    const tokenCacheFile = path.join(dir, "token.json");
    fs.writeFileSync(tokenCacheFile, JSON.stringify({
      accessToken: "cached-token",
      expiresAt: Date.now() + 7200_000,
      appId: "appid"
    }));
    const config: WeChatPublisherConfig = {
      appId: "appid",
      appSecret: "secret",
      apiBaseUrl: "https://api.weixin.qq.com",
      tokenCacheFile,
      logFile: path.join(dir, "publisher.log")
    };
    const calls: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return jsonResponse({ errcode: 0, errmsg: "ok", publish_id: "publish-id" });
    }) as typeof fetch;

    const client = new WeChatClient(config, new NullPublisherLogger());
    const result = await client.submitPublish("draft-media-id");

    expect(result.publishId).toBe("publish-id");
    expect(calls).toEqual([
      "https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=cached-token"
    ]);
  });

  it("explains WeChat IP whitelist errors from stable token requests", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-client-test-"));
    const config: WeChatPublisherConfig = {
      appId: "appid",
      appSecret: "secret",
      apiBaseUrl: "https://api.weixin.qq.com",
      tokenCacheFile: path.join(dir, "token.json"),
      logFile: path.join(dir, "publisher.log")
    };

    globalThis.fetch = vi.fn(async () => jsonResponse({
      errcode: 40164,
      errmsg: "invalid ip 183.156.145.198, not in whitelist"
    })) as typeof fetch;

    const client = new WeChatClient(config, new NullPublisherLogger());

    await expect(client.createDraft({
      articles: [
        {
          title: "标题",
          content: "<p>正文</p>",
          thumb_media_id: "cover-id",
          show_cover_pic: 0
        }
      ]
    })).rejects.toThrow("IP is not in WeChat API whitelist.");
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
