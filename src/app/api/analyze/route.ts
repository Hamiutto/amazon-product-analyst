/**
 * API 路由：分析 Amazon 商品
 * 
 * 接收 Amazon 商品链接 → 爬取商品信息 → AI 生成分析内容
 * 如果爬取失败，支持用户手动粘贴商品描述作为降级输入
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeAmazonProduct, isValidAmazonUrl } from "@/lib/scraper";
import { generateProductContent } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30; // Vercel function 最大执行时间

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, fallbackText } = body;

    let productData: string;
    let images: string[] = [];

    if (fallbackText && fallbackText.trim()) {
      // 降级模式：用户手动粘贴商品信息
      productData = fallbackText.trim();
    } else {
      // 正常模式：从 Amazon 链接爬取
      if (!url || !isValidAmazonUrl(url)) {
        return NextResponse.json(
          { error: "请输入有效的 Amazon 商品链接" },
          { status: 400 }
        );
      }

      const scraped = await scrapeAmazonProduct(url);

      if (scraped.source === "fallback" || !scraped.rawText) {
        // 爬取失败，返回需要降级输入的信号
        return NextResponse.json({
          error: scraped.error || "商品页面抓取失败",
          need_fallback: true,
        });
      }

      productData = scraped.rawText;
      images = scraped.images;
    }

    // 调用 AI 生成内容
    const result = await generateProductContent(productData, images);

    return NextResponse.json({
      success: true,
      data: result,
      images,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    const message =
      error instanceof Error ? error.message : "分析过程中出现未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
