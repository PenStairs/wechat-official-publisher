import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expectedThemes = [
  "tech",
  "aurora-glass",
  "knowledge-base",
  "luxury-gold",
  "sunset-film"
];

describe("content gallery preview", () => {
  it("links every registered theme to a generated article preview", () => {
    const html = fs.readFileSync(path.resolve("previews/template-gallery-index.html"), "utf8");

    for (const theme of expectedThemes) {
      const fileName = `template-gallery-${theme}.html`;
      expect(html).toContain(`value="${fileName}"`);
      expect(fs.existsSync(path.resolve("previews", fileName))).toBe(true);
    }
    expect(html.match(/value="template-gallery-/g)).toHaveLength(5);
    expect(html).not.toContain("最常用的三类主题");
  });

  it("renders migrated theme article previews through the inline WeChat-safe pipeline", () => {
    const html = fs.readFileSync(path.resolve("previews/template-gallery-knowledge-base.html"), "utf8");

    expect(html).toContain("微信公众号模板预览 · knowledge-base");
    expect(html).toContain("background:#F1F1EF");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
    expect(html).not.toContain('id="wemd"');
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("background:linear-gradient");
    expect(html).not.toContain("repeating-linear-gradient");
    expect(html).not.toContain("box-shadow");
  });
});
