import { describe, expect, it } from "vitest";
import { buildAgentLayoutGuide, getSupportedBlockMetadata, listSupportedBlockMetadata } from "../src/layout-assets.js";

describe("supported block metadata", () => {
  it("loads metadata only for the streamlined WeChat article layouts", () => {
    const blocks = listSupportedBlockMetadata();

    expect(blocks.map((block) => block.name)).toEqual([
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
    expect(blocks.every((block) => block.renderingSupport === "local")).toBe(true);
  });

  it("exposes field metadata and examples from layout YAML", () => {
    const hero = getSupportedBlockMetadata("hero");

    expect(hero?.bodyFormat).toBe("fields");
    expect(hero?.category).toBe("opening");
    expect(hero?.fields.required.map((field) => field.name)).toEqual(["eyebrow", "title"]);
    expect(hero?.example).toContain(":::hero");
    expect(hero?.whenToUse).toContain("3 秒内判断");
  });

  it("exposes row metadata for row-based blocks", () => {
    const steps = getSupportedBlockMetadata("steps");
    const callout = getSupportedBlockMetadata("callout");
    const timeline = getSupportedBlockMetadata("timeline");

    expect(steps?.rows?.delimiter).toBe("|");
    expect(steps?.rows?.minColumns).toBe(2);
    expect(steps?.rows?.columns.map((field) => field.name)).toEqual(["title", "description"]);
    expect(callout?.rows?.columns.map((field) => field.name)).toEqual(["content"]);
    expect(timeline?.example).toContain("2026 |");
    expect(timeline?.example).toContain("2025 |");
    expect(timeline?.example).not.toContain("品牌稿 |");
  });

  it("defines local metadata for section because it replaces multiple old heading layouts", () => {
    const section = getSupportedBlockMetadata("section");

    expect(section?.category).toBe("opening");
    expect(section?.fields.required.map((field) => field.name)).toEqual(["title"]);
    expect(section?.fields.optional.map((field) => field.name)).toEqual(["label", "subtitle"]);
  });

  it("defines reading-note as a source-aware alternative to Markdown quote blocks", () => {
    const readingNote = getSupportedBlockMetadata("reading-note");

    expect(readingNote?.bodyFormat).toBe("fields");
    expect(readingNote?.category).toBe("evidence");
    expect(readingNote?.fields.required.map((field) => field.name)).toEqual(["source", "content"]);
    expect(readingNote?.fields.optional.map((field) => field.name)).toEqual(["eyebrow"]);
    expect(readingNote?.whenToUse).toContain("替代 Markdown 引用格式");
    expect(readingNote?.antiPattern).toContain("把作者解读、总结或 takeaway 写进 layout");
  });


  it("keeps field-based layout examples complete enough to preview every documented field", () => {
    const fieldBlocks = listSupportedBlockMetadata().filter((block) => block.bodyFormat === "fields");

    for (const block of fieldBlocks) {
      const fieldNames = [...block.fields.required, ...block.fields.optional].map((field) => field.name);

      for (const fieldName of fieldNames) {
        expect(block.example, `${block.name} example should include ${fieldName}`).toContain(`${fieldName}:`);
      }
    }
  });

  it("keeps compatibility aliases out of the public summary and cta contracts", () => {
    const summary = getSupportedBlockMetadata("summary");
    const cta = getSupportedBlockMetadata("cta");

    expect(summary?.fields.optional.map((field) => field.name)).toEqual(["eyebrow", "body", "points"]);
    expect(summary?.example).not.toContain("title:");
    expect(summary?.example).not.toContain("content:");
    expect(cta?.fields.optional.map((field) => field.name)).toEqual(["note", "subtitle"]);
    expect(cta?.example).not.toContain("link:");
    expect(cta?.example).not.toContain("qrcode:");
    expect(cta?.example).not.toContain("action:");
  });

  it("builds a compact authoring guide for CUI agent context", () => {
    const guide = buildAgentLayoutGuide();

    expect(guide).toContain("# WeChat Article Layout Guide");
    expect(guide).toContain("Use only the layouts listed below");
    expect(guide).toContain("The publisher renders these :::layout blocks during inspect/render/draft");
    expect(guide).toContain("## hero");
    expect(guide).toContain("## reading-note");
    expect(guide).toContain("## timeline");
    expect(guide).toContain("Required fields:");
    expect(guide).toContain("```md\n:::hero");
    expect(guide).not.toContain("compare");
  });
});
