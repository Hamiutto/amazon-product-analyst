/**
 * DeepSeek API 调用服务
 * 
 * DeepSeek API 兼容 OpenAI 格式，使用 chat/completions 接口
 * 文档: https://api-docs.deepseek.com/
 */

export interface ProductInfo {
  name: string;
  category: string;
  price: string;
  brand: string;
  key_features: string[];
  specifications: string[];
}

export interface ProductAnalysis {
  target_users: string[];
  use_scenarios: string[];
  pain_points: string[];
  selling_points: string[];
}

export interface VideoScript {
  hook: string;      // 前5秒钩子
  body: string;      // 正文
  full_text: string; // 完整文案（150字以内）
}

export interface AIResult {
  product_info: ProductInfo;
  analysis: ProductAnalysis;
  video_script: VideoScript;
}

/**
 * 调用 DeepSeek API 生成商品分析内容
 */
export async function generateProductContent(
  productData: string,
  images: string[] = []
): Promise<AIResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  if (!apiKey || apiKey === "your_api_key_here") {
    throw new Error("DEEPSEEK_API_KEY 未配置，请在 .env.local 中设置");
  }

  const systemPrompt = `你是一名跨境电商运营专家，负责 Amazon 商品分析和 TikTok Shop 内容策划。你需要基于商品信息完成三个任务。

【输出语言】
无论输入商品信息使用什么语言，你的所有输出（Product Information、Analysis、Video Script）必须使用简体中文。

【分析原则】
- 提炼用户价值和购买驱动力，不要简单复述商品 Bullet Points。
- 每条分析都要指向"为什么用户会买"和"怎么打动用户"。
- 信息不足时不得编造，对应字段填 "无法确认"。

【三个任务】
1. 产品信息整理：提取产品名称、品类、价格、品牌、核心功能、规格。
   - key_features：用中文概括产品核心功能，不要逐条翻译英文 Bullet Points。
   - specifications：尺寸、容量、材质、参数等规格信息，与 key_features 不得重复。
2. 产品分析：分析目标用户、使用场景、用户痛点、核心卖点。要有洞察力，每条需指出对应的购买驱动力。
3. 视频口播文案：简体中文，full_text 须在 150 个中文字符以内。按以下固定结构生成：
   - Hook（前5秒）：用提问或反差制造悬念，留住观众。
   - 痛点：一句话点出用户的问题。
   - 解决方案：引出产品如何解决。
   - 核心价值：只突出一个最重要的卖点，不要罗列多个。
   - CTA（必选，不可省略）：一句话引导行动，如"点击购买""去看看""赶紧入手"。

请以严格的 JSON 格式返回，不要包含任何其他文本。JSON 格式如下：
{
  "product_info": {
    "name": "产品名称",
    "category": "品类",
    "price": "价格",
    "brand": "品牌",
    "key_features": ["功能1", "功能2", ...],
    "specifications": ["规格1", "规格2", ...]
  },
  "analysis": {
    "target_users": ["目标用户群1", ...],
    "use_scenarios": ["使用场景1", ...],
    "pain_points": ["用户痛点1", ...],
    "selling_points": ["核心卖点1", ...]
  },
  "video_script": {
    "hook": "前5秒的钩子文案",
    "body": "正文文案（含痛点→解决方案→核心价值→CTA）",
    "full_text": "完整文案（150个中文字符以内）"
  }
}`;

  const userPrompt = `请基于以下商品信息进行分析并生成内容。所有输出必须使用简体中文。

商品数据：
${productData}

${images.length > 0 ? `商品图片链接（供参考）：
${images.slice(0, 3).join("\n")}` : ""}

注意：仅基于以上信息分析，缺失的字段填"无法确认"。full_text 须在 150 个中文字符以内。请严格按照 JSON 格式返回结果。`;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI 返回内容为空");
  }

  try {
    const result = JSON.parse(content) as AIResult;
    return result;
  } catch {
    throw new Error("AI 返回的内容无法解析为 JSON");
  }
}
