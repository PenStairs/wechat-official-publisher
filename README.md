# WeChat Official Publisher

把 Markdown 渲染成微信公众号草稿箱可接受的富文本 HTML，并提供图片上传、草稿创建和正式发布的 CLI 流程。

这个项目的目标不是生成网页，而是生成微信公众号受限富文本：最终输出会尽量使用语义 HTML、CSS 主题、样式内联和微信兼容处理，避免依赖微信公众号可能过滤或表现不稳定的网页式 CSS。

## 功能

- Markdown 文章解析，支持 frontmatter 元数据。
- 微信公众号兼容 HTML 渲染，最终样式以内联 `style` 为主。
- 多套写作场景主题：`tech`、`aurora-glass`、`knowledge-base`、`luxury-gold`、`sunset-film`。
- 公众号文章 layout 块：`hero`、`summary`、`callout`、`quote`、`reading-note`、`section`、`steps`、`timeline`、`cta`。
- 正文图片上传并替换为微信可访问图片 URL。
- 封面图上传为永久素材，并创建公众号草稿。
- 支持先进入草稿箱预览，再手动决定是否正式发布。

## 环境要求

- Node.js 20+
- npm
- 已开通并配置微信公众号接口权限

## 快速开始

Agent 或普通用户可以直接从 GitHub 全局安装：

```bash
npm install -g github:PenStairs/wechat-official-publisher
wechat-publisher help
wechat-publisher themes --json
wechat-publisher blocks --json
```

也可以安装到某个项目里，再通过 `npx` 调用：

```bash
npm install github:PenStairs/wechat-official-publisher
npx wechat-publisher help
```

GitHub 安装会自动运行构建脚本，不需要提交 `dist/`。

## 本地开发

```bash
npm install
npm run build
npm run typecheck
npm test
```

构建完成后可以直接用本地 CLI：

```bash
node dist/cli.js help
node dist/cli.js themes --json
node dist/cli.js blocks --json
```

也可以在本机开发时链接命令：

```bash
npm link
wechat-publisher help
```

## 配置

推荐使用环境变量：

```bash
cp .env.example .env
```

然后填写：

```bash
WECHAT_APPID=your_app_id
WECHAT_SECRET=your_app_secret
```

也可以写入配置文件：

```json
{
  "appId": "your_app_id",
  "appSecret": "your_app_secret",
  "apiBaseUrl": "https://api.weixin.qq.com",
  "tokenCacheFile": "~/.cache/wechat-official-publisher/token.json",
  "logFile": "~/.config/wechat-official-publisher/publisher.log"
}
```

默认配置文件路径：

```text
~/.config/wechat-official-publisher/config.json
```

检查配置是否就绪：

```bash
wechat-publisher doctor --json
```

## 渲染预览

先用本地渲染确认文章结构和主题效果：

```bash
wechat-publisher render tests/fixtures/sample.md \
  --theme knowledge-base \
  --out previews/sample.html
```

检查文章是否具备渲染和草稿条件：

```bash
wechat-publisher inspect tests/fixtures/sample.md --json
```

生成主题预览和 layout 预览：

```bash
npm run build
npm run preview:content-gallery
npm run preview:block-gallery
```

生成的 HTML 和截图属于本地验收产物，默认不会提交到 Git。

## 创建草稿

创建公众号草稿前，先运行 inspect：

```bash
wechat-publisher inspect article.md --json
```

使用本地封面图创建草稿：

```bash
wechat-publisher draft article.md \
  --cover cover.jpg \
  --theme knowledge-base \
  --out previews/final.html \
  --json
```

如果已经有微信永久素材 `media_id`，也可以直接复用：

```bash
wechat-publisher draft article.md \
  --cover-media-id MEDIA_ID \
  --theme knowledge-base \
  --json
```

正式发布需要显式提交草稿 `media_id`：

```bash
wechat-publisher publish DRAFT_MEDIA_ID --json
```

建议流程是：本地渲染预览 -> inspect -> 创建草稿 -> 微信后台/手机预览 -> 确认后再 publish。

## Markdown 示例

```markdown
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
```

查看 layout 元数据和写法：

```bash
wechat-publisher blocks --agent-md
wechat-publisher blocks callout --agent-md
wechat-publisher assets layouts --json
```

## 公众号兼容约束

进入草稿箱的 HTML 应按单列文档流设计，并避免使用微信公众号里容易失效或表现不稳定的 CSS：

- 不依赖 `<style>`、外链 CSS、`class` 选择器或 CSS 变量。
- 不使用 `display:flex`、`display:grid`。
- 不使用 `position:absolute`、`position:relative`、`position:fixed`。
- 不使用负 margin、`transform`、`calc()`、`vw`、`vh`。
- 不使用块背景渐变、动画和 `box-shadow`。
- 正文、引用、提示块、步骤、时间线等必须显式设置可读的背景、文字和边框颜色。

## 开发命令

```bash
npm run typecheck
npm test
npm run build
npm run preview:content-gallery
npm run preview:block-gallery
```

`npm test` 会先构建并重新生成测试依赖的预览 HTML，保证新 clone 的仓库不需要提交 `dist/` 和本地预览产物也能正常验证。

`npm install -g github:PenStairs/wechat-official-publisher` 依赖 `prepare` 脚本在安装时构建 `dist/`，因此 build 脚本必须保持跨平台，不依赖 `rm`、`chmod` 等 Unix-only 命令。

## 仓库内容建议

建议提交：

- `src/`
- `tests/`
- `resources/`
- `scripts/`
- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `README.md`
- `.gitignore`
- `.env.example`

不建议提交：

- `node_modules/`
- `dist/`
- `.env`
- 本地日志、缓存、token 文件
- `previews/` 下生成的 HTML、截图和主题审计产物
