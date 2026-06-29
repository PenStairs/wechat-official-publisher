# wechat-official-publisher Agent 规范

本项目的核心目标是把 Markdown 稳定渲染为微信公众号草稿箱可接受的富文本 HTML。后续任何主题、layout、renderer、预览或草稿推送相关改动，都必须优先遵循“公众号受限富文本排版”约束，并以 WeMD 已验证的“语义 HTML + CSS 主题 + 样式内联 + 微信复制/草稿兼容处理”方案为主题实现基准，而不是网页应用设计习惯。

## 公众号兼容性原则

1. 公众号文章不是网页页面，而是受限富文本排版。
   - 本地 HTML 好看不代表草稿箱可用。
   - 草稿箱和微信客户端预览结果才是最终验收标准。
   - 主题设计优先追求结构稳定、对比明确、可读性强，不追求网页式复杂视觉。

2. 所有最终进入草稿箱的样式必须使用内联 `style=""`。
   - 禁止依赖 `<style>` 标签。
   - 禁止依赖 `class` 选择器。
   - 禁止外链 CSS。
   - 禁止 CSS 变量。
   - 禁止复杂选择器、媒体查询、动画关键帧。

3. layout 必须按单列文档流设计。
   - 标题、正文、引用、图片、提示块、步骤、时间线、CTA 都应顺着文档流向下排。
   - 避免把公众号文章当成响应式网页组件来写。
   - 多列、悬浮、覆盖、背景图叠文字等网页式结构默认不允许。

4. 公开渲染输出中禁止使用不稳定 CSS。
   - 禁止 `display:flex`。
   - 禁止 `display:grid`。
   - 禁止 `position:absolute` / `position:relative` / `position:fixed`。
   - 禁止负 margin。
   - 禁止 `transform`。
   - 禁止 `calc()`。
   - 禁止 `vw` / `vh`。
   - 禁止把 `linear-gradient` / `repeating-linear-gradient` 用作块背景、装饰背景或布局背景。
   - 允许 WeMD 已验证的文字渐变写法：`background-image: linear-gradient(...)` + `background-clip: text` / `-webkit-background-clip: text` + `color: transparent`，仅用于标题、加粗重点、提示标题等文字本身。
   - 禁止 `box-shadow`。

5. 背景、文字、边框必须显式且保守。
   - 正文背景优先白色或明确纯色。
   - 卡片块必须显式设置背景色和文字色。
   - 重要文字不能使用过浅灰色。
   - 深色模式下仍要保证正文、Quote、Callout、Step、Timeline 可读。
   - 块背景渐变、半透明背景、浅灰文字叠浅底都要避免。
   - 文字渐变必须来自主题层并经过内联与草稿箱预览验证，不能在 layout 内容里临时拼写。

6. 移动端优先。
   - 内容宽度使用 `width:100%` / `max-width` 思路，不写死大宽度。
   - 图片使用微信可访问资源，并保持 `display:block;width:100%;height:auto;` 或等价保守写法。
   - 正文字号优先 `15px` 或 `16px`。
   - 行高建议 `1.75` 到 `2`。
   - 段落间距建议 `12px` 到 `20px`。
   - 标题字号不要过大，避免微信窄屏挤压。

7. layout 数量和职责要克制。
   - 只保留公众号文章高频使用、稳定可读的组件。
   - 新增 layout 前必须先确认它不能由现有正文、标题、引用、提示、列表、步骤、时间线、CTA 组合表达。
   - 效果不稳定或容易被微信过滤的 layout 应删除，而不是继续做复杂兼容。

## 当前公开 Layout 约束

当前公开支持的 layout 应保持在精简集合中：

- `hero`
- `summary`
- `callout`
- `quote`
- `reading-note`
- `section`
- `steps`
- `timeline`
- `cta`

`compare` 已因草稿箱效果不稳定而删除。后续不要恢复对照/多组对比类 layout，除非先设计出单列、纯色、无复杂布局、草稿箱可验证稳定的表达方式。

## 组件设计要求

1. `hero`
   - 用作文章开头的轻量封面块。
   - 不使用背景图叠文字、复杂渐变、阴影或 CTA 箭头。
   - `eyebrow -> title -> subtitle` 的阅读顺序必须清晰。

2. `callout`
   - 不同 tone 必须有明确语义区分。
   - `info`、`tip`、`warning`、`success`、`danger` 的颜色不能过于接近。
   - 背景和正文颜色必须在浅色、深色模式下都可读。

3. `quote`
   - Quote 必须比普通正文更突出，但不能依赖复杂装饰。
   - 文字颜色必须清晰，不能使用浅灰。
   - source 使用类似 `—— 来源` 的右对齐表达，不使用容易断裂的长横线拼接效果。

4. `reading-note`
   - 用作资料卡 / 原文内容，不使用 `<blockquote>`。
   - content 承载原始文章或书摘内容，不走微信引用组件。
   - 用户提供了完整原文时必须完整保留，不截断、不摘取、不概括、不改写。
   - 大段原文必须使用 `content: |` 多行块，避免只保留第一行。
   - source 必须明确标注书名、章节、作者或材料出处。
   - 作者解读、总结和 takeaway 应写在 layout 外面的普通正文里，不放进 layout。

5. `steps`
   - 序号由数组顺序自动生成。
   - 不要求用户在 Markdown 中手写序号。
   - 序号和标题必须在同一文档流中稳定显示，不能依赖 flex。

6. `timeline`
   - 时间线必须有明显的时间线语义。
   - 小点和连线不能依赖绝对定位。
   - 多行内容和长说明不能导致最后一项背景消失或文字不可读。

7. `cta`
   - CTA 是文章结尾行动提示，不是网页按钮区。
   - 没有真实链接时不能做成看起来可点击的按钮或箭头。

## 开发与验证流程

1. 修改 renderer / theme / layout 前，先判断是否会进入微信公众号草稿箱。
2. 会进入草稿箱的 HTML 必须通过兼容性扫描，至少检查：
   - `<style`
   - `display:flex`
   - `display:grid`
   - `position:absolute`
   - `position:relative`
   - `position:fixed`
   - 块背景或装饰背景中的 `linear-gradient`
   - `repeating-linear-gradient`
   - `box-shadow`
   - `calc(`
   - `vw`
   - `vh`
3. 修改有分支的渲染逻辑时必须补测试，测试要锁行为，不要只断言静态文案或类名。
4. 任务结束前必须运行：
   - `npm run typecheck`
   - `npm test`
   - 需要生成预览时运行 `npm run build` 和对应 preview 命令。
5. 视觉改动必须至少用移动端宽度截图检查一次。
6. 推送草稿箱前必须先运行 `wechat-publisher inspect <article.md> --json`。
7. `draft` 只在用户明确要求推草稿箱时执行；不得擅自执行正式发布。

## 草稿箱验收标准

一次主题或 layout 调整只有在以下条件满足后才算完成：

- 本地测试通过。
- 文章 HTML 无上述不稳定样式命中。
- 移动端截图可读。
- 草稿箱预览可接受。
- 若微信后台或手机预览出现走样，应把原因沉淀回主题/layout 约束，而不是只修单篇文章。
