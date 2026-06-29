import { describe, expect, it } from "vitest";
import { parseArticleDocument } from "../src/article-parser.js";

describe("parseArticleDocument", () => {
  it("uses business metadata order from frontmatter and removes it from body", () => {
    const article = parseArticleDocument(`---
title: 自动发布方案
author: 金峻
summary: 摘要来自 summary
cover: ./cover.jpg
theme: life
show_cover_pic: true
---

# 正文标题

内容`);

    expect(article.metadata).toMatchObject({
      title: "自动发布方案",
      author: "石头记",
      digest: "摘要来自 summary",
      cover: "./cover.jpg",
      theme: "life",
      showCoverPic: true
    });
    expect(article.body.trim()).toBe("# 正文标题\n\n内容");
  });

  it("falls back to the first h1 when title is missing", () => {
    const article = parseArticleDocument("# 从标题推断\n\n正文");

    expect(article.metadata.title).toBe("从标题推断");
  });

  it("uses the fixed publisher author regardless of frontmatter author", () => {
    const article = parseArticleDocument(`---
title: 标题
author: 其他作者
---

正文`);

    expect(article.metadata.author).toBe("石头记");
  });
});
