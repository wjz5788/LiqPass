## 准备
- GitHub 账号可用、邮箱已验证。
- 生成并添加 SSH Key 到 GitHub：
  - 生成：`ssh-keygen -t ed25519 -C "you@example.com"`
  - 查看公钥：`cat ~/.ssh/id_ed25519.pub`
  - 在 GitHub → Settings → SSH and GPG keys → New SSH key。

## 检查本地仓库状态（macOS，当前目录是项目根）
- `cd /Users/zhaomosheng/Desktop/LiqPass-clean`
- `git status`（若提示不是仓库，执行 `git init`）
- 若已有仓库：`git remote -v` 查看远程；无远程则后续添加。

## 设置 .gitignore（避免把密钥/私有数据推上去）
- 关键建议：添加以下条目（如 `.gitignore` 不存在需新建一次）：
  - 环境与密钥：
    - `.env`
    - `**/*.env`
    - `**/secrets/**`
  - 运行与安装产物：
    - `node_modules/`
    - `dist/`
    - `.data/`
    - `.venv/`
    - `*.log`
  - 平台与编辑器：
    - `.DS_Store`
    - `.vscode/`
- 添加后：`git add .gitignore && git commit -m "chore: add safe .gitignore"`

## 创建 GitHub 远程仓库
- 方式 A（网页）：
  - GitHub → New repository → Name：`LiqPass-clean`（或你希望的名字）→ 可选 Private/Public → 勾选不初始化 README（避免产生默认 commit）。
  - 获得远程地址（SSH）：`git@github.com:<your_user>/<repo>.git`
- 方式 B（gh CLI）：
  - 安装：`brew install gh && gh auth login`
  - 创建并绑定：`gh repo create <your_user>/<repo> --private --source . --remote origin --push`

## 推送到远程（首推）
- 配置用户名邮箱（若未设置）：
  - `git config --global user.name "Your Name"`
  - `git config --global user.email "you@example.com"`
- 添加远程：
  - `git remote add origin git@github.com:<your_user>/<repo>.git`
- 选择默认分支名：
  - 如未设置：`git branch -M main`
- 提交现有代码：
  - 查看变更：`git status`
  - 执行：`git add -A && git commit -m "chore: initial import"`
- 推送：
  - `git push -u origin main`

## 后续规范（符合项目规则）
- 每次改动：
  - `git add -A`
  - `git commit -m "fix: <简介>"`（如修理 500；或 `feat: <功能>`；或 `docs: <文档>`）
  - `git push`
- 文档更新：根据项目规则“每次的修改，利用 git 提交记录，更新文档”，在现有文档处更新改动说明（注意不主动创建新的 README/MD，除非你明确需要）。

## 注意事项
- 切勿提交任何私钥或生产 `.env`。生产环境变量仅保存在服务器（如 `/etc/liqpass/*.env`）。
- 若已有敏感文件被加入暂存：`git reset HEAD <file> && echo <file> >> .gitignore`，并从历史删除可用 `git filter-repo`（必要时我可提供命令）。
- 大文件（>100MB）请使用 Git LFS（`brew install git-lfs && git lfs install`）。

## 我这边的执行配合
- 你确认后，我将按以上步骤检查现状（是否已有远程、是否有需要补充的 `.gitignore`），并在不泄露秘密的前提下完成首推，随后把命令输出与 GitHub 仓库链接回传。