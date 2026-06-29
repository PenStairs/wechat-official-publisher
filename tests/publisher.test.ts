import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NullPublisherLogger } from "../src/logger.js";
import { ArticlePublisher, buildDraftPayload } from "../src/publisher.js";
import type { DraftPayload } from "../src/types.js";
import type { WeChatClient } from "../src/wechat-client.js";

describe("buildDraftPayload", () => {
  it("maps article metadata to the WeChat draft contract with the fixed publisher author", () => {
    const payload = buildDraftPayload({
      metadata: {
        title: "标题",
        author: "作者",
        digest: "摘要",
        showCoverPic: true
      },
      html: "<p>正文</p>",
      coverMediaId: "cover-media-id"
    });

    expect(payload).toEqual({
      articles: [
        {
          title: "标题",
          author: "石头记",
          digest: "摘要",
          content: "<p>正文</p>",
          thumb_media_id: "cover-media-id",
          show_cover_pic: 1
        }
      ]
    });
  });
});

describe("ArticlePublisher.inspectArticleFile", () => {
  it("blocks draft readiness when the frontmatter cover file is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-publisher-test-"));
    const articlePath = path.join(dir, "article.md");
    fs.writeFileSync(articlePath, `---
title: 标题
cover: ./missing-cover.jpg
---

正文`);

    const publisher = new ArticlePublisher({} as WeChatClient, new NullPublisherLogger());
    const result = publisher.inspectArticleFile({ articlePath });

    expect(result.readyForDraft).toBe(false);
    expect(result.blockers).toContain(`missing cover image: ${path.join(dir, "missing-cover.jpg")}`);
  });
});

describe("ArticlePublisher.publishDraft", () => {
  it("rewrites escaped image src attributes after uploading article images", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-publisher-test-"));
    const articlePath = path.join(dir, "article.md");
    const imagePath = path.join(dir, "chart&version.png");
    const coverPath = path.join(dir, "cover.png");
    fs.writeFileSync(imagePath, "image");
    fs.writeFileSync(coverPath, "cover");
    fs.writeFileSync(articlePath, `---
title: 标题
---

![图表](./chart&version.png)
`);
    const wechat = new FakeWeChatClient();
    const publisher = new ArticlePublisher(wechat as unknown as WeChatClient, new NullPublisherLogger());

    const result = await publisher.publishDraft({
      articlePath,
      coverPath
    });

    expect(wechat.articleImageUploads).toEqual([imagePath]);
    expect(result.html).toContain('src="http://mmbiz.qpic.cn/article-image.png"');
    expect(result.html).not.toContain("chart&amp;version.png");
    expect(wechat.createdDraftPayload?.articles[0].content).toContain("http://mmbiz.qpic.cn/article-image.png");
  });
});

class FakeWeChatClient {
  articleImageUploads: string[] = [];
  createdDraftPayload?: DraftPayload;

  async uploadArticleImage(filePath: string): Promise<{ url: string }> {
    this.articleImageUploads.push(filePath);
    return { url: "http://mmbiz.qpic.cn/article-image.png" };
  }

  async uploadPermanentImage(): Promise<{ mediaId: string }> {
    return { mediaId: "cover-media-id" };
  }

  async createDraft(payload: DraftPayload): Promise<{ mediaId: string }> {
    this.createdDraftPayload = payload;
    return { mediaId: "draft-media-id" };
  }
}
