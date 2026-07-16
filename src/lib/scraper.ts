/**
 * 商品数据获取服务
 * 
 * 三层策略：
 * 1. 服务端 fetch Amazon 页面 HTML → 用 Cheerio 提取关键信息
 *    1a. 优先尝试直接 fetch
 *    1b. 如果被反爬，尝试从页面 meta 标签和 JSON-LD 提取（Amazon 页面包含结构化数据）
 * 2. 提取到的原始文本交给 AI 进一步结构化
 * 3. 降级方案：如果反爬失败，让用户手动粘贴商品描述
 */

import * as cheerio from "cheerio";

export interface RawProductData {
  title: string | null;
  price: string | null;
  brand: string | null;
  features: string[];
  images: string[];
  description: string | null;
  rawText: string;
  source: "scraped" | "fallback";
  error?: string;
}

/**
 * 验证 Amazon 链接是否合法
 */
export function isValidAmazonUrl(url: string): boolean {
  const patterns = [
    /amazon\.com\/dp\//i,
    /amazon\.com\/.*\/dp\//i,
    /amazon\.com\/gp\/product\//i,
  ];
  return patterns.some((p) => p.test(url));
}

/**
 * 多组 User-Agent 轮换，降低被识别为爬虫的概率
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * 从 Amazon 商品页面提取商品信息
 * 策略：先用 Cheerio 提取 HTML，再从 JSON-LD 结构化数据补充
 */
export async function scrapeAmazonProduct(url: string): Promise<RawProductData> {
  try {
    const ua = getRandomUserAgent();
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return createFallback(`HTTP ${response.status}: 无法访问商品页面`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // === 策略 1: 从 HTML 元素直接提取 ===
    const title =
      $("#productTitle").text().trim() ||
      $("#title #productTitle").text().trim() ||
      $('h1[data-testid="title"]').text().trim() ||
      $('span[data-testid="product-title"]').text().trim() ||
      null;

    const price =
      $(".a-price .a-offscreen").first().text().trim() ||
      $("#priceblock_dealprice").text().trim() ||
      $("#priceblock_ourprice").text().trim() ||
      $("#priceblock_saleprice").text().trim() ||
      $("#corePrice_feature_div .a-offscreen").first().text().trim() ||
      $(".apexPriceToPay .a-offscreen").first().text().trim() ||
      $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text().trim() ||
      null;

    const brand =
      $("#bylineInfo").text().trim() ||
      $("a#bylineInfo").text().trim() ||
      $("#bylineInfo_featurediv a").text().trim() ||
      null;

    const features: string[] = [];
    $("#feature-bullets .a-list-item, #feature-bullets li span.a-list-item").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes("See more") && !features.includes(text)) {
        features.push(text);
      }
    });

    const images: string[] = [];
    $("#altImages img, #imgBlkFront, #landingImage, #main-image").each((_, el) => {
      const src =
        $(el).attr("data-old-hires") ||
        $(el).attr("src") ||
        $(el).attr("data-src");
      if (src && src.startsWith("http") && !images.includes(src)) {
        if (!src.includes("transpare") && !src.includes("32x32") && !src.includes("icon")) {
          images.push(src);
        }
      }
    });

    const description =
      $("#productDescription").text().trim() ||
      $("#feature-bullets").text().trim() ||
      null;

    const specText: string[] = [];
    $("#productDetails_techSpec_section_1 tr, .a-normal tr, #detailBulletsWrapper .a-list-item").each((_, el) => {
      const label = $(el).find("th, .a-text-bold").text().trim();
      const value = $(el).find("td, span:not(.a-text-bold)").text().trim();
      if (label && value && label !== value) {
        specText.push(`${label}: ${value}`);
      }
    });

    // === 策略 2: 从 JSON-LD 结构化数据提取 ===
    let jsonLdTitle: string | null = null;
    let jsonLdPrice: string | null = null;
    let jsonLdBrand: string | null = null;
    let jsonLdImage: string | null = null;
    let jsonLdDescription: string | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).text();
        const data = JSON.parse(jsonText);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const itemType = item["@type"];
          const isProduct = itemType === "Product" || (Array.isArray(itemType) && itemType.includes("Product"));
          if (isProduct) {
            jsonLdTitle = jsonLdTitle || item.name || null;
            const offerPrice = item.offers?.price || item.offers?.[0]?.price;
            if (offerPrice) {
              const currency = item.offers?.priceCurrency || item.offers?.[0]?.priceCurrency || "$";
              jsonLdPrice = `${currency}${offerPrice}`;
            }
            jsonLdBrand = jsonLdBrand || item.brand?.name || null;
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            jsonLdImage = jsonLdImage || img || null;
            jsonLdDescription = jsonLdDescription || item.description || null;
          }
        }
      } catch {
        // JSON-LD 解析失败，忽略
      }
    });

    // === 策略 3: 从 meta 标签提取（兜底）===
    const metaTitle = $('meta[property="og:title"]').attr("content") || null;
    const metaDescription = $('meta[property="og:description"]').attr("content") || null;
    const metaImage = $('meta[property="og:image"]').attr("content") || null;

    // 合并所有策略的结果
    const finalTitle = title || jsonLdTitle || metaTitle;
    const finalPrice = price || jsonLdPrice;
    const finalBrand = brand || jsonLdBrand;
    const finalDescription = description || jsonLdDescription || metaDescription;
    const finalImages = [...images];
    if (jsonLdImage && !finalImages.includes(jsonLdImage)) finalImages.push(jsonLdImage);
    if (metaImage && !finalImages.includes(metaImage)) finalImages.push(metaImage);

    // 组装原始文本
    const rawText = [
      finalTitle ? `Title: ${finalTitle}` : "",
      finalBrand ? `Brand: ${finalBrand}` : "",
      finalPrice ? `Price: ${finalPrice}` : "",
      features.length > 0 ? `Features:\n${features.join("\n")}` : "",
      finalDescription ? `Description: ${finalDescription}` : "",
      specText.length > 0 ? `Specifications:\n${specText.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // 如果关键信息都提取不到，大概率是被反爬了
    if (!finalTitle && !finalPrice && features.length === 0 && !finalDescription) {
      return createFallback("页面内容提取失败，可能遇到反爬验证或页面结构变化");
    }

    return {
      title: finalTitle,
      price: finalPrice,
      brand: finalBrand,
      features,
      images: finalImages.slice(0, 5),
      description: finalDescription,
      rawText,
      source: "scraped",
    };
  } catch (error) {
    return createFallback(
      error instanceof Error ? `抓取失败: ${error.message}` : "抓取失败: 未知错误"
    );
  }
}

function createFallback(error: string): RawProductData {
  return {
    title: null,
    price: null,
    brand: null,
    features: [],
    images: [],
    description: null,
    rawText: "",
    source: "fallback",
    error,
  };
}
