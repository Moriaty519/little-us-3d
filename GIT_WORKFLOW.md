# Git 使用规则

这是一个单人维护的项目，默认直接在 `main` 上提交。目标不是复杂的团队流程，而是：**每次修改都可回退，GitHub 上始终有一份可下载、可运行的版本。**

## 当前仓库状态

- 远端：`https://github.com/Moriaty519/little-us-3d.git`
- 分支：`main`
- 可见性：**Public（公开）**
- `dist/`、`little-us.html` 和 `preview/` 都纳入 Git
- 浏览器里的回忆、照片和备份不会自动进入 Git

因为仓库是公开的，**不要提交**：个人照片源文件、导出的回忆备份 JSON、`.env`、访问令牌、密码、身份信息。应用内的数据保存在浏览器 IndexedDB，GitHub 只备份代码。

## 每天的工作流程

1. 打开项目，先看状态：
   ```bash
   git status -sb
   ```
2. 如果换过电脑或在 GitHub 网页改过文件，先拉取：
   ```bash
   git pull --ff-only
   ```
   本地有未提交改动时先提交，不要直接 pull。
3. 修改代码。
4. 重新构建并检查：
   ```bash
   python3 tools/build.py
   ```
   再运行对应的 `tools/check-*.mjs`。
5. 看一遍改动范围：
   ```bash
   git diff --stat
   ```
6. 提交：
   ```bash
   git add -A
   git commit -m "feat: 一句话说明这次改了什么"
   ```
7. 推送（在 GitHub Desktop 里点 **Push origin** 也可以）：
   ```bash
   git push
   ```

## 提交信息格式

保持一行主题，必要时加两行说明“为什么改”：

```text
feat: 青岛地图改为城市聚焦立卡
fix: 跳过导览后 Lumi 从当前位置飞回小鸟屋
docs: 更新花瓶入口和录音台对齐截图
chore: 重新构建离线单文件
```

- `feat`：新功能或明显改版
- `fix`：修 bug
- `docs`：README、截图、说明
- `chore`：构建产物、工具、清理

一次提交只做一件能说清楚的事。像这次同时包含地图改版、房间入口和导览修复，可以作为一次“检查点提交”，但之后尽量拆小。

## 构建产物规则

- `dist/` 和 `little-us.html` 是给直接下载/打开用的，继续跟踪。
- 它们必须由 `python3 tools/build.py` 生成，**不要手改**。
- 提交前如果改了 `src/`，一定重新构建，否则网页和源码不一致。
- `preview/` 只保留最终采用的截图和动图，不要提交临时调试截图。

## 预览图和大文件

当前 `preview/` 是仓库体积的主要来源，约 79 MB。现在可以接受，但要注意：

- 新增预览图前先确认是否真的需要。
- 不要提交录屏原文件、导出视频、几十 MB 的素材压缩包。
- 单个文件不要超过 GitHub 的 100 MB 限制。
- 以后如果预览图继续膨胀，再考虑清理旧图、Git LFS 或新建更干净的仓库；不要在没有备份时改写 Git 历史。

## 分支和版本

单人开发不需要长期开分支；实验性大改可以临时建分支：

```bash
git switch -c experiment/xxx
# 改完验证后再合并回 main
```

稳定版本可以打标签：

```bash
git tag -a v1.0 -m "稳定版本 1.0"
git push origin v1.0
```

标签是可选的，但发布给朋友前打一个会更安心。

## 不要做的事

- 不要 `git push --force`，除非你明确知道自己在覆盖远端历史。
- 不要在冲突时随便选“接受全部”，先停下来检查。
- 不要把 `node_modules`、`.preview-tools`、`.npm-cache`、`.env` 或备份 JSON 提交进去。
- 不要把浏览器里的回忆当成 GitHub 已备份；请在应用里使用“导出备份”。
- 不要同时在这台电脑和 GitHub 网页上改同一个文件。

## GitHub Desktop 的最短路径

1. **Fetch origin** → 有更新就 **Pull origin**。
2. 改完代码、构建、检查。
3. 左下角写 Summary，点 **Commit to main**。
4. 点 **Push origin**。
5. 出现冲突或看不懂的提示时，先不要点强推，把提示发给我。
