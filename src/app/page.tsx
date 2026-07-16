"use client";

import { useState, useRef, useEffect } from "react";

interface ProductInfo {
  name: string;
  category: string;
  price: string;
  brand: string;
  key_features: string[];
  specifications: string[];
}

interface ProductAnalysis {
  target_users: string[];
  use_scenarios: string[];
  pain_points: string[];
  selling_points: string[];
}

interface VideoScript {
  hook: string;
  body: string;
  full_text: string;
}

interface AIResult {
  product_info: ProductInfo;
  analysis: ProductAnalysis;
  video_script: VideoScript;
}

const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
  FALLBACK: "fallback",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS];
type CopyStatus = "idle" | "success" | "error";
type CopyTarget = "productInfo" | "productAnalysis" | "videoScript";

interface CopyFeedback {
  target: CopyTarget | null;
  status: CopyStatus;
}

/**
 * 前端 Amazon URL 格式校验
 * 支持 /dp/ASIN 和 /gp/product/ASIN 两种格式
 */
function isValidAmazonUrl(url: string): boolean {
  return /amazon\.com\/.*\/?dp\/|amazon\.com\/dp\/|amazon\.com\/gp\/product\//i.test(url);
}

/**
 * 将技术错误信息转换为用户可理解的提示
 */
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("403") || m.includes("forbidden")) {
    return "Amazon 暂时限制了访问，请稍后重试或使用下方手动粘贴";
  }
  if (m.includes("429")) {
    return "访问过于频繁，Amazon 已限流，请稍后再试或手动粘贴商品信息";
  }
  if (m.includes("timeout") || m.includes("timed out") || m.includes("abortsymbol") || m.includes("abort")) {
    return "请求超时，Amazon 页面响应过慢，请重试或使用手动粘贴";
  }
  if (m.includes("404")) {
    return "商品页面不存在或已下架，请检查链接是否正确";
  }
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
    return "网络连接异常，请检查网络后重试";
  }
  if (m.includes("insufficient_balance") || m.includes("402") || m.includes("balance")) {
    return "AI 服务余额不足，请联系管理员充值后重试";
  }
  return msg;
}

function formatListSection(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return `${title}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function formatProductInfoCopyText(productInfo: ProductInfo): string {
  const content = [
    productInfo.name ? `产品名称: ${productInfo.name}` : "",
    productInfo.category ? `品类: ${productInfo.category}` : "",
    productInfo.price ? `价格: ${productInfo.price}` : "",
    productInfo.brand ? `品牌: ${productInfo.brand}` : "",
    formatListSection("核心功能", productInfo.key_features),
    formatListSection("规格", productInfo.specifications),
  ]
    .filter(Boolean);

  return content.length > 0 ? ["产品信息整理", ...content].join("\n\n") : "";
}

function formatProductAnalysisCopyText(analysis: ProductAnalysis): string {
  const content = [
    formatListSection("目标用户", analysis.target_users),
    formatListSection("使用场景", analysis.use_scenarios),
    formatListSection("用户痛点", analysis.pain_points),
    formatListSection("核心卖点", analysis.selling_points),
  ]
    .filter(Boolean);

  return content.length > 0 ? ["产品分析", ...content].join("\n\n") : "";
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [status, setStatus] = useState<Status>(STATUS.IDLE);
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>({ target: null, status: "idle" });

  // 输入框 ref，用于自动聚焦
  const urlInputRef = useRef<HTMLInputElement>(null);

  // 重置或分析完成后自动聚焦输入框
  useEffect(() => {
    if (status === STATUS.IDLE || status === STATUS.ERROR || status === STATUS.FALLBACK) {
      // 延迟聚焦，等待 DOM 更新
      const timer = setTimeout(() => {
        if (status === STATUS.FALLBACK) {
          // 降级模式聚焦 textarea
          const textarea = document.querySelector("textarea");
          if (textarea) textarea.focus();
        } else {
          urlInputRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    if (copyFeedback.status === "idle") return;

    const timer = setTimeout(() => {
      setCopyFeedback({ target: null, status: "idle" });
    }, 2000);

    return () => clearTimeout(timer);
  }, [copyFeedback]);

  const handleAnalyze = async () => {
    // 降级模式：直接用 fallbackText
    if (status === STATUS.FALLBACK) {
      if (!fallbackText.trim()) return;
    } else {
      // 正常模式：前端校验 URL
      if (!url.trim()) return;
      if (!isValidAmazonUrl(url.trim())) {
        setStatus(STATUS.ERROR);
        setError("请输入有效的 Amazon 商品链接（需包含 /dp/ 或 /gp/product/）");
        return;
      }
    }

    setStatus(STATUS.LOADING);
    setError("");
    setResult(null);
    setImages([]);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          fallbackText: fallbackText.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.need_fallback) {
        setStatus(STATUS.FALLBACK);
        setError(friendlyError(data.error || "自动抓取失败，请手动粘贴商品信息"));
        return;
      }

      if (!response.ok || data.error) {
        setStatus(STATUS.ERROR);
        setError(friendlyError(data.error || "分析失败，请重试"));
        return;
      }

      setResult(data.data);
      setImages(data.images || []);
      setStatus(STATUS.SUCCESS);
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(friendlyError(err instanceof Error ? err.message : "网络请求失败"));
    }
  };

  /**
   * 重置：保留 URL，只清空错误状态和分析结果
   * 这样用户不会因为错误丢失已输入的链接
   */
  const handleReset = () => {
    setFallbackText("");
    setStatus(STATUS.IDLE);
    setResult(null);
    setError("");
    setImages([]);
    setCopyFeedback({ target: null, status: "idle" });
    setTimeout(() => {
      urlInputRef.current?.focus();
    }, 0);
  };

  /**
   * 分析下一个商品：清空所有，回到初始状态
   */
  const handleNewAnalysis = () => {
    setUrl("");
    setFallbackText("");
    setStatus(STATUS.IDLE);
    setResult(null);
    setError("");
    setImages([]);
  };

  /**
   * 复制当前结果卡片文本到剪贴板
   */
  const handleCopy = async (target: CopyTarget, copyText: string) => {
    if (!copyText) return;

    const updateCopyStatus = (nextStatus: CopyStatus) => {
      setCopyFeedback({ target, status: nextStatus });
    };

    try {
      await navigator.clipboard.writeText(copyText);
      updateCopyStatus("success");
    } catch {
      // 降级方案：用 execCommand
      const textarea = document.createElement("textarea");
      textarea.value = copyText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      let didFallbackCopy = false;
      try {
        didFallbackCopy = document.execCommand("copy");
      } catch {
        // 放弃
      }
      updateCopyStatus(didFallbackCopy ? "success" : "error");
      document.body.removeChild(textarea);
    }
  };

  const getCopyStatus = (target: CopyTarget): CopyStatus => {
    return copyFeedback.target === target ? copyFeedback.status : "idle";
  };

  const renderCopyButton = (target: CopyTarget, copyText: string) => {
    if (!copyText.trim()) return null;

    return (
      <CopyButton
        status={getCopyStatus(target)}
        onClick={() => handleCopy(target, copyText)}
      />
    );
  };

  /**
   * 键盘事件：输入框内按 Enter 直接提交
   */
  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && status !== STATUS.LOADING) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const handleFallbackKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && status !== STATUS.LOADING) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  // 判断 URL 输入框是否应该禁用
  const urlInputDisabled = status === STATUS.LOADING || status === STATUS.FALLBACK;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <h1 className="text-lg font-bold text-slate-900">AI 产品分析助手</h1>
          </div>
          <span className="text-sm text-slate-500 hidden sm:block">
            Amazon 商品智能分析工具
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* 输入区 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          {/* 降级模式时显示模式提示 */}
          {status === STATUS.FALLBACK && (
            <div className="mb-3 px-3 py-2 bg-amber-100 rounded-lg text-sm text-amber-800 font-medium">
              📝 自动解析未完成，请补充商品信息继续分析
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700 mb-2">
            📦 Amazon 商品链接
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={urlInputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="https://www.amazon.com/dp/B0XXXXXXXX"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              disabled={urlInputDisabled}
            />
            <button
              onClick={handleAnalyze}
              disabled={status === STATUS.LOADING || (status !== STATUS.FALLBACK && !url.trim()) || (status === STATUS.FALLBACK && !fallbackText.trim())}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition whitespace-nowrap"
            >
              {status === STATUS.LOADING ? "分析中..." : status === STATUS.FALLBACK ? "继续 AI 分析" : "开始分析"}
            </button>
          </div>

          {/* 降级输入区 */}
          {status === STATUS.FALLBACK && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
              <p className="text-sm text-amber-800 mb-3">
                Amazon 部分商品可能因网站限制无法自动获取完整内容。你仍可以粘贴商品信息，AI 将继续完成分析。
              </p>
              <div className="text-sm text-amber-700 mb-2 space-y-1">
                <p className="font-medium">请复制以下任意内容，粘贴到下面输入框即可：</p>
                <ul className="list-disc list-inside ml-2 text-amber-600">
                  <li>✓ 商品标题（Title）</li>
                  <li>✓ Bullet Points（商品卖点）</li>
                  <li>✓ 商品描述（Description）</li>
                </ul>
              </div>
              <textarea
                value={fallbackText}
                onChange={(e) => setFallbackText(e.target.value)}
                onKeyDown={handleFallbackKeyDown}
                placeholder="请粘贴 Amazon 商品标题、Bullet Points 或商品描述。支持粘贴全部内容，信息越完整，分析结果越准确。"
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400 resize-none"
              />
            </div>
          )}

          {/* 错误提示 */}
          {status === STATUS.ERROR && (
            <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-xl">
              <p className="text-sm text-red-700">❌ {error}</p>
              <div className="mt-2 flex gap-3 text-sm">
                <button
                  onClick={() => {
                    setStatus(STATUS.IDLE);
                    setError("");
                  }}
                  className="text-blue-600 hover:underline"
                >
                  重试
                </button>
                <button
                  onClick={handleReset}
                  className="text-slate-500 hover:underline"
                >
                  清空重来
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 加载状态 */}
        {status === STATUS.LOADING && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500">正在抓取商品信息并生成分析...</p>
            <p className="mt-1 text-xs text-slate-400">通常需要 10-20 秒，请稍候</p>
          </div>
        )}

        {/* 结果展示 */}
        {status === STATUS.SUCCESS && result && (
          <div className="space-y-6">
            {/* 商品图片 */}
            {images.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">📸 商品图片</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {images.slice(0, 5).map((img, i) => (
                    <div key={i} className="w-40 flex-shrink-0">
                      <a
                        href={img}
                        target="_blank"
                        rel="noreferrer"
                        title="Open original image"
                      >
                        <img
                          src={img}
                          alt={`商品图片 ${i + 1}`}
                          className="w-40 h-40 object-contain rounded-lg border border-slate-200 bg-slate-50"
                        />
                      </a>
                      <a
                        href={img}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-center text-xs font-medium text-blue-600 hover:underline"
                      >
                        Download Image
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1. 产品信息整理 */}
            <ResultCard
              icon="📋"
              title="产品信息整理"
              color="blue"
              action={renderCopyButton("productInfo", formatProductInfoCopyText(result.product_info))}
            >
              <div className="space-y-3">
                <InfoRow label="产品名称" value={result.product_info.name} />
                <InfoRow label="品类" value={result.product_info.category} />
                <InfoRow label="价格" value={result.product_info.price} />
                <InfoRow label="品牌" value={result.product_info.brand} />
                <div>
                  <p className="text-sm text-slate-500 mb-1">核心功能</p>
                  <ul className="space-y-1">
                    {result.product_info.key_features.map((f, i) => (
                      <li key={i} className="text-slate-700 flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">▸</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                {result.product_info.specifications.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">规格</p>
                    <ul className="space-y-1">
                      {result.product_info.specifications.map((s, i) => (
                        <li key={i} className="text-slate-700 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">▸</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ResultCard>

            {/* 2. 产品分析 */}
            <ResultCard
              icon="💡"
              title="产品分析"
              color="purple"
              action={renderCopyButton("productAnalysis", formatProductAnalysisCopyText(result.analysis))}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnalysisSection
                  title="🎯 目标用户"
                  items={result.analysis.target_users}
                  color="bg-blue-50 text-blue-700 border-blue-200"
                />
                <AnalysisSection
                  title="📍 使用场景"
                  items={result.analysis.use_scenarios}
                  color="bg-green-50 text-green-700 border-green-200"
                />
                <AnalysisSection
                  title="😣 用户痛点"
                  items={result.analysis.pain_points}
                  color="bg-red-50 text-red-700 border-red-200"
                />
                <AnalysisSection
                  title="✨ 核心卖点"
                  items={result.analysis.selling_points}
                  color="bg-amber-50 text-amber-700 border-amber-200"
                />
              </div>
            </ResultCard>

            {/* 3. 视频口播文案 */}
            <ResultCard
              icon="🎬"
              title="视频口播文案"
              color="green"
              action={renderCopyButton("videoScript", result.video_script.full_text)}
            >
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">⚡ 前5秒钩子 (Hook)</p>
                  <p className="text-slate-900 font-medium">{result.video_script.hook}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium mb-1">📝 正文</p>
                  <p className="text-slate-700">{result.video_script.body}</p>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500 font-medium">完整文案</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {result.video_script.full_text.length} 字
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                    {result.video_script.full_text}
                  </p>
                </div>
              </div>
            </ResultCard>

            {/* 重新分析按钮 */}
            <div className="flex justify-center pb-8">
              <button
                onClick={handleNewAnalysis}
                className="px-6 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-xl transition"
              >
                分析其他商品
              </button>
            </div>
          </div>
        )}

        {/* 空状态引导 */}
        {status === STATUS.IDLE && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🛍️</div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">
              输入 Amazon 商品链接，一键生成产品分析
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              支持 Amazon 商品页面自动抓取，AI 生成产品信息整理、深度分析和视频口播文案
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// 子组件：结果卡片
function ResultCard({
  icon,
  title,
  color,
  action,
  children,
}: {
  icon: string;
  title: string;
  color: "blue" | "purple" | "green";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const colorMap = {
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    green: "border-l-green-500",
  };
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 border-l-4 ${colorMap[color]} p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// 子组件：信息行
function CopyButton({
  status,
  onClick,
}: {
  status: CopyStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-24 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        status === "error"
          ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
      aria-live="polite"
    >
      {status === "success" ? "已复制" : status === "error" ? "复制失败" : "复制"}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-sm text-slate-500 min-w-20">{label}:</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

// 子组件：分析板块
function AnalysisSection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <p className="font-medium mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed">• {item}</li>
        ))}
      </ul>
    </div>
  );
}
