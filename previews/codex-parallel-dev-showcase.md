---
title: Codex 并行研发工作流
author: 金峻
summary: 用一个 PM 主会话编排多个 Worker，把需求拆分、开发、验收和合并做成可追踪的并行研发流程。
theme: tech
---

:::hero
eyebrow: 工作流设计
title: 让一个 PM 编排多个 Codex Worker 并行研发
subtitle: 把需求入口、Story 拆分、开发验收和合并清理拆成清晰职责，让并行开发不失控。
cta_text: 先跑通半自动，再逐步把 QA 和合并自动化
:::

## 核心判断

这套流程解决的是：**你只和一个 PM 主会话沟通，PM 负责拆需求、派工、验收编排、合并清理，多个 Worker 并行开发不同 Story。**

:::callout warning
真正的关键不是“多开几个 Worker”，而是保证状态、分支、验收和合并都有唯一责任人。否则并行越多，冲突越多。
:::

## 最小可跑通目标

:::summary
- 需求只从 PM 主会话进入
- 每个 Story 独立 branch + worktree
- docs/stories/index.md 作为唯一故事看板
- 开发、验收、合并三段职责分离
- 验收通过前不允许合并
:::

## 角色分工

:::steps
01 | PM 主会话 | 唯一对外入口，拆 Story、维护 index.md、派发 Worker、合并已验收 Story
02 | Dev Worker | 只负责一个 Story 的代码实现、测试和开发报告
03 | QA Worker | 对照验收标准检查代码和测试，产出验收报告
:::

:::quote
text: Worker 只产出结果文件，PM 负责回写看板。
source: Codex 并行研发工作流
:::

## 状态流转

:::timeline
需求输入: 用户向 PM 输入需求
Story 拆分: PM 创建 STORY-xxx.md 并更新 index.md
开发执行: PM 创建 branch + worktree 并启动 Dev Worker
验收检查: QA Worker 对照验收标准产出报告
主干合并: qa_passed 后由 PM 顺序合并到 main
清理收口: PM 更新状态并删除 worktree 和分支
:::

## 核心原则

:::callout success
单写原则、单 Story 原则、单状态源原则，是这套流程能并行但不失控的地基。
:::

- **单写原则**：只有 PM 可以修改 `docs/stories/index.md`
- **单 Story 原则**：一个 Story 只对应一个 `branch + worktree`
- **单状态源原则**：进度状态只认 `index.md`
- **默认 TDD**：Dev Worker 默认先补测试，再写实现
- **先验收后合并**：只有 `qa_passed` 状态允许进入合并
- **默认 squash merge**：保持主干历史干净

## 落地节奏

:::steps
阶段一 | 先跑通半自动 | PM 手动拆 Story、手动启动 Worker、手动触发 QA
阶段二 | 自动触发 QA | Dev Worker 完成后由 PM 自动启动 QA Worker
阶段三 | 定时合并 | qa_passed 的 Story 在固定窗口统一合并
:::

:::cta
title: 这套流程适合先在一个小项目里试跑，确认 Story 粒度和验收标准稳定后再扩大规模。
subtitle: 先让并行开发变得可控，再追求自动化程度。
note: CODEX PARALLEL DEV
:::
