import { describe, expect, it } from "vitest";
import { renderMarkdownArticle } from "../src/markdown-renderer.js";
import { defaultTheme, techTheme } from "../src/themes.js";

describe("renderMarkdownArticle", () => {
  it("renders common markdown and preserves image sources for upload rewriting", () => {
    const result = renderMarkdownArticle(`# 标题

正文 **重点**。

![架构图](./assets/arch.png)

:::callout warning
先发草稿箱，再人工确认。
:::
`, defaultTheme);

    expect(result.html).toContain("<h1");
    expect(result.html).toContain("<strong");
    expect(result.html).toContain(">重点</strong>");
    expect(result.html).toContain('src="./assets/arch.png"');
    expect(result.html).not.toContain("<style");
    expect(result.html).not.toContain("class=");
    expect(result.html).not.toContain('id="wemd"');
    expect(result.images).toEqual([
      {
        alt: "架构图",
        source: "./assets/arch.png"
      }
    ]);
  });

  it("renders the technology theme with a white article shell and clear code styles", () => {
    const html = renderMarkdownArticle(`## 代码块预览

这里有一段行内代码：\`theme: "tech"\`。

\`\`\`ts
const theme = "tech";
\`\`\`
`, techTheme).html;

    expect(html).toContain(`background-color:${techTheme.colors.canvas}`);
    expect(html).toContain(`border-left:5px solid ${techTheme.colors.accent}`);
    expect(html).toContain(`background:${techTheme.colors.codeBackground}`);
    expect(html).not.toContain(`background:${techTheme.colors.accent};font-size`);
    expect(html).not.toContain(`background:${techTheme.colors.surface};border:1px solid ${techTheme.colors.border}`);
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("box-shadow");
  });

  it("cleans runtime CSS features after CSS theme inlining", () => {
    const html = renderMarkdownArticle(`## 清洗验证

<section class="raw" id="raw" style="display:flex;position:relative;box-shadow:0 0 4px #000;background:linear-gradient(red, blue);width:calc(100% - 1px);color:#111">保留文本</section>
`, techTheme).html;

    expect(html).toContain("保留文本");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
    expect(html).not.toContain('id="raw"');
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("position:");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("background:linear-gradient");
    expect(html).not.toContain("calc(");
    expect(html).toContain("color:#111");
  });

  it("keeps compact markdown lists without paragraph-like item gaps", () => {
    const html = renderMarkdownArticle(`这些任务通常有三个特征：

- 运行时间长
- 会跨多个会话
- 上下文会被反复压缩
`, defaultTheme).html;

    expect(html).toContain("<ul");
    expect(html).toContain('<li style="margin:0;line-height:1.75">运行时间长</li>');
    expect(html).not.toContain("<li><p");
    expect(html).not.toContain("margin:6px 0");
  });

  it("extracts body content from complete html documents before sending to draft content", () => {
    const html = renderMarkdownArticle(`<!doctype html>
<html>
<head>
  <title>被忽略的网页标题</title>
  <style>p { color: red; }</style>
</head>
<body>

<section><p>第一行正文</p></section>
</body>
</html>
`, defaultTheme).html;

    expect(html).toContain("第一行正文");
    expect(html).not.toContain("<!doctype");
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<head");
    expect(html).not.toContain("<body");
    expect(html).not.toContain("被忽略的网页标题");
    expect(html).not.toMatch(/^<section\b[^>]*>\s/);
  });

  it("does not leave a leading blank text node when top-level style tags are stripped", () => {
    const html = renderMarkdownArticle(`<style>p { color: red; }</style>

<section><p>第一行正文</p></section>
`, defaultTheme).html;

    expect(html).toContain("第一行正文");
    expect(html).not.toContain("<style");
    expect(html).not.toMatch(/^<section\b[^>]*>\s/);
  });
});
