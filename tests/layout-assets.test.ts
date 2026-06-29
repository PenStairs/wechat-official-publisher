import { describe, expect, it } from "vitest";
import { getSupportedBlockMetadata, listArticleAssets, listSupportedBlockMetadata, summarizeArticleAssets } from "../src/layout-assets.js";

describe("wechat article asset catalog", () => {
  it("summarizes the local publishing catalog without unrelated reference assets", () => {
    const summary = summarizeArticleAssets();

    expect(summary.source).toBe("wechat-official-publisher");
    expect(summary.counts.layout).toBe(9);
    expect(summary.note).toContain("current WeChat article renderer");
  });

  it("exposes only the layout modules that match common WeChat article writing", () => {
    const layouts = listArticleAssets("layout");

    expect(layouts.map((asset) => asset.name)).toEqual([
      "hero",
      "summary",
      "callout",
      "quote",
      "reading-note",
      "section",
      "steps",
      "timeline",
      "cta"
    ]);
    expect(layouts.every((asset) => asset.renderingSupport === "local")).toBe(true);
  });

  it("provides local metadata for the new section layout", () => {
    const section = getSupportedBlockMetadata("section");

    expect(section?.bodyFormat).toBe("fields");
    expect(section?.fields.required.map((field) => field.name)).toEqual(["title"]);
    expect(section?.example).toContain(":::section");
  });

  it("does not keep removed layout modules as supported blocks", () => {
    expect(listSupportedBlockMetadata().map((metadata) => metadata.name)).not.toEqual(expect.arrayContaining([
      "pricing",
      "tweet",
      "author-card",
      "compare",
      "image-compare"
    ]));
  });
});
