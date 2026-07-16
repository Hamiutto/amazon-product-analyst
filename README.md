# AI 产品分析助手 🤖

> 输入 Amazon 商品链接，自动生成产品信息整理、深度分析和视频口播文案

## 功能概览

1. **产品信息整理** — 自动提取商品名称、品类、价格、品牌、核心功能、规格
2. **产品分析** — AI 深度分析目标用户、使用场景、用户痛点、核心卖点
3. **视频口播文案** — 生成 150 字以内的中文短视频口播文案，含前 5 秒钩子

## 技术方案

| 层 | 技术选型 | 说明 |
|---|---|---|
| 前端框架 | Next.js 15 + React 19 + TypeScript | 全栈框架，前后端一体 |
| 样式 | Tailwind CSS v4 | 原子化 CSS |
| 商品数据获取 | Cheerio HTML 解析 | 服务端 fetch Amazon 页面 + 结构化提取 |
| AI 模型 | DeepSeek API | 性价比高，中文能力优秀 |
| 部署 | Vercel | Next.js 原生支持 |

### 商品信息获取策略（三层降级）

```
用户输入 Amazon 链接
  ↓
第1层：服务端 fetch 商品页面 HTML → Cheerio 提取关键信息
  ↓ ✅ 成功 → 继续 AI 分析
  ↓ ❌ 反爬失败
第2层：提示用户手动粘贴商品描述文本
  ↓
第3层：AI 从文本提取信息 → 继续分析
```

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 DEEPSEEK_API_KEY

# 3. 启动开发服务器
npm run dev

# 4. 打开 http://localhost:3000
```

## 环境变量

| 变量名 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥，从 [platform.deepseek.com](https://platform.deepseek.com) 获取 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址，默认 `https://api.deepseek.com` |

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts    # API 路由：商品分析
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # 前端页面
└── lib/
    ├── scraper.ts          # Amazon 商品页面爬取
    └── ai.ts              # DeepSeek AI 调用
```
