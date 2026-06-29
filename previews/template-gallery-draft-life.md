---
title: 生活分享主题预览稿
theme: life
---

:::hero
eyebrow: TEMPLATE GALLERY
title: 微信公众号文章模板预览
subtitle: 这是一篇专门用于看样式的示例文章，覆盖当前简版 renderer 已经本地实现的 block。
cta_text: 先选整体主题，再选正文模块组合
:::

## 基础正文

普通 Markdown 会被渲染成适合公众号编辑器粘贴的 HTML。这里放一段正文，用来观察段落、标题、加粗、列表和 block 之间的节奏。

- 适合观点文、教程、产品说明和复盘文章
- 支持本地图片上传改写，草稿创建时会自动处理正文图片
- 支持封面上传和草稿箱创建

:::callout info
这是默认提示框，适合放重要前提、阅读提示、使用条件。
:::

:::callout tip
这是 tip 提示框，适合放一个能立刻提升效率的小技巧。
:::

:::callout warning
这是 warning 提示框，适合风险提示、边界条件、不要忽略的限制。
:::

:::callout success
这是 success 提示框，适合发布成功、流程跑通、阶段性结论。
:::

:::callout danger
这是 danger 提示框，适合危险操作、不可逆步骤、强提醒。
:::

## Summary

:::summary
eyebrow: 本文要点
highlight: 先把结构搭稳，再让主题接管气质
body: 这样同一篇内容切到不同主题时，重点和节奏仍然清楚。
points: 先用 hero 建立开篇判断 | 用 summary 收束核心信息 | 用 steps 和 timeline 分别表达流程与演进 | 用 quote 和 cta 做观点强化与收尾行动
:::

## Section

:::section
label: PART 01
title: 精简后的模块只服务文章结构
subtitle: 写作者先判断这一段要表达什么，再选择对应模块。
:::

## Steps

:::steps 典型发布流程
准备 Markdown | 写 frontmatter、正文和需要的 block 模块
本地预览 | 用 render 或 preview 生成 HTML，确认排版
上传素材 | 草稿创建时上传封面和正文图片
创建草稿 | 调用微信公众号 draft/add，进入后台草稿箱人工确认
:::

## Quote

:::quote
eyebrow: 核心观点
quote: 自动化发布的目标不是省掉判断，而是把重复动作稳定地交给工具。
text: 如果不使用 quote 字段，也可以用 text 字段承载同一段引用正文。
source: WeChat Official Publisher
:::

## Timeline

:::timeline
2026 | 稳定草稿箱链路 | 把 Markdown、图片上传、草稿创建和人工预览串成一条可复用流程
2025 | 建立公众号安全排版 | 收敛到单列、纯色、内联样式，优先保证微信编辑器可接受
2024 | 验证自动化发布原型 | 跑通本地渲染和基础配置，为后续主题与 layout 打底
:::

## CTA

:::cta
title: 选择模板时，优先看它是否服务你的文章结构，而不是单纯看装饰感。
subtitle: 对长文来说，清晰的节奏和稳定的可读性比复杂视觉更重要。
note: TEMPLATE GALLERY
:::
