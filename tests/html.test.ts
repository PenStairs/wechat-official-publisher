import { describe, expect, it } from "vitest";
import { wrapPreviewDocument } from "../src/html.js";

describe("wrapPreviewDocument", () => {
  it("adds utf-8 metadata for standalone local preview files", () => {
    const html = wrapPreviewDocument("<section>你好</section>", "标题");

    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain("<title>标题</title>");
    expect(html).toContain("<section>你好</section>");
  });
});
