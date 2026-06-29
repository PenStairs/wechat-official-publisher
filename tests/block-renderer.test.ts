import { describe, expect, it } from "vitest";
import { parseLayoutBlocks, renderLayoutBlock, validateLayoutBlocks } from "../src/block-renderer.js";
import { renderMarkdownArticle } from "../src/markdown-renderer.js";
import { defaultTheme, techTheme } from "../src/themes.js";

describe("renderLayoutBlock", () => {
  it("renders a hero block into WeChat-safe inline HTML", () => {
    const html = renderLayoutBlock({
      name: "hero",
      argument: "",
      body: ["eyebrow: 深度观察", "title: 自动发布不是点一下按钮", "subtitle: 稳定链路更重要", "cta_text: 继续看完整链路"]
    }, defaultTheme);

    expect(html).toContain("深度观察");
    expect(html).toContain("自动发布不是点一下按钮");
    expect(html.indexOf("深度观察")).toBeLessThan(html.indexOf("自动发布不是点一下按钮"));
    expect(html.indexOf("自动发布不是点一下按钮")).toBeLessThan(html.indexOf("稳定链路更重要"));
    expect(html).toContain("继续看完整链路");
    const ctaTextIndex = html.indexOf("继续看完整链路");
    const heroContentStartIndex = html.indexOf('data-mpa-action-id="hero-content"');
    const heroCtaStartIndex = html.indexOf('data-mpa-action-id="hero-cta"');
    expect(ctaTextIndex).toBeGreaterThan(html.indexOf("稳定链路更重要"));
    expect(heroContentStartIndex).toBeGreaterThan(-1);
    expect(heroCtaStartIndex).toBeGreaterThan(heroContentStartIndex);
    expect(html).toContain("style=");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("&rarr;");
    expect(html).not.toContain("width:10px");
  });

  it("renders the tech hero as a light article block with technical accents", () => {
    const html = renderLayoutBlock({
      name: "hero",
      argument: "",
      body: ["eyebrow: Demo", "title: 赛博朋克技术主题", "subtitle: 暗色背景也要有清晰首屏层级"]
    }, techTheme);

    expect(html).toContain('data-mpa-action-id="hero"');
    expect(html).toContain(`background:${techTheme.colors.surface}`);
    expect(html).not.toContain("rgba(26,11,46,0.96)");
    expectWechatCompatibleInlineStyle(html);
  });

  it("gives callout tones distinct visual semantics", () => {
    const infoHtml = renderLayoutBlock({ name: "callout", argument: "info", body: ["这是一般提示。"] }, defaultTheme);
    const tipHtml = renderLayoutBlock({ name: "callout", argument: "tip", body: ["这是小技巧。"] }, defaultTheme);
    const warningHtml = renderLayoutBlock({ name: "callout", argument: "warning", body: ["先发草稿箱，再人工确认。"] }, defaultTheme);
    const successHtml = renderLayoutBlock({ name: "callout", argument: "success", body: ["已完成图片上传。"] }, defaultTheme);
    const dangerHtml = renderLayoutBlock({ name: "callout", argument: "danger", body: ["不要直接发布到线上。"] }, defaultTheme);

    expect(infoHtml).toContain(defaultTheme.colors.info);
    expect(tipHtml).toContain(defaultTheme.colors.tip);
    expect(warningHtml).toContain(defaultTheme.colors.warning);
    expect(warningHtml).toContain("注意");
    expect(successHtml).toContain(defaultTheme.colors.success);
    expect(successHtml).toContain("完成");
    expect(dangerHtml).toContain(defaultTheme.colors.danger);
    expect(dangerHtml).toContain("风险");
    expect(new Set([infoHtml, tipHtml, warningHtml, successHtml, dangerHtml]).size).toBe(5);
    expect(defaultTheme.colors.info).not.toBe(defaultTheme.colors.success);
    expect(defaultTheme.colors.tip).not.toBe(defaultTheme.colors.success);
    expect(techTheme.colors.info).not.toBe(techTheme.colors.success);
    expect(techTheme.colors.tip).not.toBe(techTheme.colors.success);
  });

  it("reports missing required fields for structured blocks", () => {
    const report = validateLayoutBlocks(`:::hero
eyebrow: 深度观察
:::
`);

    expect(report.errors).toEqual([
      {
        module: "hero",
        field: "title",
        line: 1,
        message: "required field missing"
      }
    ]);
  });

  it("captures bracket titles used by layout examples", () => {
    const blocks = parseLayoutBlocks(`:::steps[落地步骤]
写作 | 准备 Markdown
:::`);

    expect(blocks[0]).toMatchObject({
      name: "steps",
      argument: "落地步骤"
    });
  });

  it("renders steps with generated numbers beside the content", () => {
    const html = renderLayoutBlock({
      name: "steps",
      argument: "落地步骤",
      body: ["先给结果判断 | 不要先讲背景和过程", "再补数据和案例 | 让读者知道方法成立"]
    }, techTheme);

    expect(html).toContain('data-mpa-action-id="steps-item"');
    expect(html).toContain(">01</span>");
    expect(html).toContain(">02</span>");
    expect(html).toContain("先给结果判断");
    expect(html).toContain("不要先讲背景和过程");
    expect(html).toContain(`background:${techTheme.colors.canvas}`);
    expectWechatCompatibleInlineStyle(html);
    expect(html).not.toContain("<table");
  });

  it("renders the retained field and row layouts", () => {
    const summaryHtml = renderLayoutBlock({
      name: "summary",
      argument: "",
      body: ["eyebrow: 一句话总结", "highlight: 结构先于风格", "body: 同一篇内容切到不同主题时，重点仍然清楚。", "points: 结构先于风格 | 模块服务阅读"]
    }, defaultTheme);
    const timelineHtml = renderLayoutBlock({
      name: "timeline",
      argument: "应用场景",
      body: ["写作 | 准备内容 | 保证结构稳定"]
    }, defaultTheme);

    expect(summaryHtml).toContain("结构先于风格");
    expect(summaryHtml).toContain("同一篇内容切到不同主题时");
    expect(timelineHtml).toContain("应用场景");
    expect(timelineHtml).toContain("准备内容");
    expect(timelineHtml).toContain('data-mpa-action-id="timeline-item"');
    expect(timelineHtml).toContain('data-mpa-action-id="timeline-node"');
    expect(timelineHtml).toContain("border-left:2px solid rgba(");
    expect(timelineHtml).toContain("font-size:13px;line-height:1.7");
    expectWechatCompatibleInlineStyle(timelineHtml);
    expect(timelineHtml).not.toContain("<table");
    expect(timelineHtml).not.toContain("padding-left:12px;border-left:2px");
  });

  it("renders reading-note as a source card instead of a quote block", () => {
    const html = renderLayoutBlock({
      name: "reading-note",
      argument: "",
      body: [
        "eyebrow: 原文",
        "source: 《深度工作》第 4 章",
        "content: 长期任务真正困难的不是开始，而是持续维持同一方向的注意力。"
      ]
    }, defaultTheme);

    expect(html).toContain('data-mpa-action-id="reading-note"');
    expect(html).toContain("来源：");
    expect(html).toContain("《深度工作》第 4 章");
    expect(html).toContain("长期任务真正困难");
    expect(html).not.toContain("原文内容");
    expect(html).not.toContain("我的解读");
    expect(html).not.toContain("带走一句");
    expect(html).not.toContain("<blockquote");
    expectWechatCompatibleInlineStyle(html);
  });

  it("keeps multiline reading-note source content intact", () => {
    const html = renderLayoutBlock({
      name: "reading-note",
      argument: "",
      body: [
        "source: 《乙亥讲演录·启机分·释佛》",
        "content: |",
        "  佛是大觉义，就其德以立尊号，此无具体人，本名佛陀，简称曰佛。",
        "  觉之圆妙者也，又名一切智，觉知一切法之事理。",
        "",
        "  由凡入佛，应依于法，曰佛法。法如车乘而得度者，曰佛乘。"
      ]
    }, defaultTheme);

    expect(html).toContain("佛是大觉义");
    expect(html).toContain("觉之圆妙者也");
    expect(html).toContain("由凡入佛");
    expect(html).not.toContain("<blockquote");
    expectWechatCompatibleInlineStyle(html);
  });

  it("keeps long tech steps and timeline items readable against gradient containers", () => {
    const stepsHtml = renderLayoutBlock({
      name: "steps",
      argument: "长内容步骤",
      body: ["第一步 | 这是一段很长的说明，用来模拟公众号文章里步骤说明较多的场景，避免最后一项和外层渐变底色融在一起。"]
    }, techTheme);
    const timelineHtml = renderLayoutBlock({
      name: "timeline",
      argument: "长内容时间线",
      body: ["阶段一 | 完成结构设计 | 这是一段很长的副文本，用来检查 timeline 内容卡片在黑色主题渐变底部仍然有稳定背景。"]
    }, techTheme);

    expect(stepsHtml).toContain(`background:${techTheme.colors.canvas}`);
    expect(timelineHtml).toContain(`background:${techTheme.colors.canvas}`);
    expectWechatCompatibleInlineStyle(stepsHtml);
    expectWechatCompatibleInlineStyle(timelineHtml);
  });

  it("does not duplicate timeline detail when old two-column rows are rendered", () => {
    const html = renderLayoutBlock({
      name: "timeline",
      argument: "旧格式时间线",
      body: ["写作: 准备文章结构和配图"]
    }, techTheme);

    expect(html.match(/准备文章结构和配图/g)?.length).toBe(1);
  });

  it("renders section as the single supported chapter divider", () => {
    const html = renderLayoutBlock({
      name: "section",
      argument: "",
      body: ["label: PART 01", "title: 为什么要重新整理主题", "subtitle: 先把选择变少，再把表达变清楚。"]
    }, techTheme);

    expect(html).toContain('data-mpa-action-id="section"');
    expect(html).toContain("为什么要重新整理主题");
    expect(html).toContain(techTheme.colors.accent);
    expect(html).toContain(techTheme.colors.surface);
  });

  it("renders quote as a featured pull quote card", () => {
    const html = renderLayoutBlock({
      name: "quote",
      argument: "",
      body: ["eyebrow: 核心观点", "quote: 模块不是为了让页面更满，而是为了让读者更快找到判断。", "source: 内容设计原则"]
    }, techTheme);

    expect(html).toContain('data-mpa-action-id="quote"');
    expect(html).toContain("“");
    expect(html).toContain("核心观点");
    expect(html).toContain('data-mpa-action-id="quote-source"');
    expect(html).toContain("内容设计原则");
    expect(html).toContain("width:32px");
    expect(html).toContain(`border-top:1px solid ${techTheme.colors.muted}`);
    expect(html).toContain("text-align:right");
    expect(html).toContain(`font-size:${techTheme.typography.headingSize}`);
    expect(html).not.toContain(`border-left:5px solid ${techTheme.colors.accent}`);
    expect(html).toContain(`background:${techTheme.colors.surface}`);
    expectWechatCompatibleInlineStyle(html);
  });

  it("renders public layouts with WeChat-compatible inline styles", () => {
    const articleHtml = renderMarkdownArticle("## 技术主题\n\n正文", techTheme).html;
    expect(articleHtml).toContain("background-color:#FFFFFF");
    expectWechatCompatibleInlineStyle(articleHtml);

    const supportedBlocks = [
      { name: "hero", body: ["eyebrow: Demo", "title: 赛博朋克技术主题"] },
      { name: "summary", body: ["highlight: 统一颜色 token", "points: 背景同源 | 文字可读"] },
      { name: "callout", argument: "warning", body: ["先发草稿箱，再人工确认。"] },
      { name: "quote", body: ["text: 组件只消费主题语义色。"] },
      { name: "section", body: ["title: 颜色系统检查"] },
      { name: "steps", body: ["扫描 | 找出硬编码颜色"] },
      { name: "timeline", body: ["检查 | 修正主题 token"] },
      { name: "cta", body: ["title: 使用统一颜色契约"] }
    ];

    for (const block of supportedBlocks) {
      const html = renderLayoutBlock({
        name: block.name,
        argument: "argument" in block ? block.argument ?? "" : "",
        body: block.body
      }, techTheme);

      expect(html).not.toContain("border:1px solid");
      expectWechatCompatibleInlineStyle(html);
    }
  });

  it("renders bracket titles in full markdown articles", () => {
    const html = renderMarkdownArticle(`:::steps[典型发布流程]
准备 Markdown | 写 frontmatter、正文和需要的 block 模块
:::`, defaultTheme).html;

    expect(html).toContain("典型发布流程");
  });

  it("fails explicitly for removed layout modules", () => {
    expect(() => renderLayoutBlock({
      name: "compare",
      argument: "",
      body: ["旧方式 | 新方式"]
    }, defaultTheme)).toThrow("unsupported layout module: compare");

    expect(validateLayoutBlocks(`:::compare
旧方式 | 新方式
:::
`).errors).toContainEqual({
      module: "compare",
      line: 1,
      message: "unknown layout module"
    });
  });
});

function expectWechatCompatibleInlineStyle(html: string): void {
  const unsupportedFragments = [
    "<style",
    "display:flex",
    "display:grid",
    "position:absolute",
    "position:relative",
    "position:fixed",
    "linear-gradient",
    "repeating-linear-gradient",
    "box-shadow",
    "calc(",
    "vw",
    "vh"
  ];

  for (const fragment of unsupportedFragments) {
    expect(html).not.toContain(fragment);
  }
}
