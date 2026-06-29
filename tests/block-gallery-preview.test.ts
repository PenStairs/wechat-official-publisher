import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("block gallery preview", () => {
  it("renders an interactive layout browser with theme switching data", () => {
    const html = fs.readFileSync(path.resolve("previews/block-gallery.html"), "utf8");
    const data = extractGalleryData(html);

    expect(html).toContain('id="themeSelect"');
    expect(html).toContain('id="layoutList"');
    expect(html).toContain('id="blockDetail"');
    expect(html).toContain("renderSelectedBlock");
    expect(data.blocks).toHaveLength(9);
    expect(data.themes.map((theme) => theme.name)).toEqual([
      "tech",
      "aurora-glass",
      "knowledge-base",
      "luxury-gold",
      "sunset-film"
    ]);
    expect(data.blocks.map((block) => block.name)).toEqual([
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
    expect(data.blocks.every((block) => Object.keys(block.previews).length === data.themes.length)).toBe(true);
    expect(data.blocks.every((block) => block.details.fields.required && block.details.fields.optional)).toBe(true);
    expect(html).not.toContain('<section id="hero" class="block-card"');
  });
});

interface GalleryData {
  themes: Array<{ name: string }>;
  blocks: GalleryBlock[];
}

interface GalleryBlock {
  name: string;
  previews: Record<string, string>;
  details: {
    fields: {
      required: unknown[];
      optional: unknown[];
    };
  };
}

function extractGalleryData(html: string): GalleryData {
  const match = html.match(/<script type="application\/json" id="galleryData">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("gallery data script was not found");
  }

  return JSON.parse(match[1]) as GalleryData;
}
