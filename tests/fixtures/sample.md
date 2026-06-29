---
title: 微信自动发布简版
author: 石头记
summary: 用简版 CLI 把 Markdown 转成公众号草稿。
cover: ./cover.jpg
theme: knowledge-base
---

:::hero
eyebrow: 工具说明
title: 先进入草稿箱，再决定是否发布
subtitle: 自动化要稳定，也要保留最后的内容判断。
:::

## 为什么这样做

正文图片会在草稿流程里上传到微信图文图片接口。

:::callout warning
第一版不建议默认正式发布，先把草稿箱链路跑稳。
:::

:::summary
- Markdown 转微信兼容 HTML
- 正文图片自动上传并替换
- 封面图上传为永久素材
:::

:::cta
title: 确认预览效果后，再调用 publish 提交正式发布。
note: WECHAT PUBLISHER
:::
