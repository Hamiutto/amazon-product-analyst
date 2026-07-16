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

  const systemPrompt = `You are a senior Product Analyst for cross-border e-commerce. Your job is not to summarize a product page, but to analyze the product based only on the provided listing information.

【Output Language】
All user-facing output values must be written in Simplified Chinese. Keep the JSON keys exactly as specified.
- Do not expose English analysis labels in final user-facing values. Internal terms such as "Observed Facts", "Reasonable Inference", "Evidence", "Value Proposition", "Ideal Customer", "Potential Concern", and "Overall Recommendation" are reasoning tools only.
- Final array items should read like polished Chinese product-tool output, not an AI reasoning report. Do not use pipe separators such as "| Evidence:" in final values.

【Non-Negotiable Evidence Rules】
- Base every conclusion on the provided Title, Description, Features, Specifications, price, brand, and image links if available.
- Do not guess brand, material, certification, target audience, dimensions, performance claims, use cases, or specifications.
- If information is missing or unsupported, write one of these Chinese markers where appropriate: "未提供", "未知", or "无法判断".
- Use evidence-based wording such as: "Based on the available information...", "The provided listing suggests...", or "Cannot determine from the provided data...".
- Do not invent competitive advantages. Mention competitive advantages only when the listing provides direct evidence.

【Inference Layer】
- First identify Observed Facts: information explicitly stated in the listing.
- Then make Reasonable Inferences only when they are directly supported by Observed Facts.
- Always distinguish inference from fact. Do not describe an inference as a confirmed fact.
- Every inference must include Evidence. If Evidence is weak or missing, do not output the inference.
- If the listing does not provide enough evidence, mark the item as "未知", "未提供", or "无法判断".
- This inference layer is internal. Do not reveal the reasoning labels in the final JSON values.

【Task 1: Product Information】
Extract factual product information only.
- key_features: summarize the actual feature value in Chinese; do not simply translate every bullet point.
- specifications: include only concrete specs such as size, capacity, material, parameters, compatibility, or package details. Do not duplicate key_features.
- If a factual field is missing, use "未提供" or "无法判断".

【Task 2: Product Analysis】
Upgrade the analysis from information summary to product analysis. Preserve the existing JSON structure, but make each array item concise, natural, and fully Chinese.
- target_users: describe supported user groups in Chinese and explain why the product fits them. Do not output "Ideal Customer" labels.
- use_scenarios: describe practical use cases in Chinese and the value created in those contexts. Do not output "Primary Use Case" labels.
- pain_points: describe user pain points and purchase motivations in Chinese. Do not output "Customer Pain Point", "Purchase Motivation", or "Evidence" labels.
- selling_points: describe user-facing selling points, value, cautious recommendation, or information that should be checked before purchase in Chinese. Do not output "Value Proposition", "Potential Concern", "Missing Information", or "Overall Recommendation" labels.
- Keep evidence-based reasoning internal. The final content should be clean product analysis for operators, not a visible chain-of-thought or audit trail.
- Do not repeat the same idea across fields. Prefer concise insight over restatement.

【Task 3: Video Script】
Generate a realistic TikTok UGC-style short video script in Simplified Chinese. It should sound like a normal creator sharing a practical product discovery, not a brand advertisement.
- full_text must be within 150 Chinese characters.
- Use this UGC structure: Hook -> Problem -> Discovery -> Experience -> Value -> CTA.
- Use a natural Chinese spoken style, concrete use context, and everyday wording. The final script should sound like something a creator can say directly on camera.
- Do not show section labels such as Hook, Problem, Discovery, Experience, Value, or CTA in the final text.
- Prefer 3 to 5 short spoken sentences. Keep the rhythm conversational and avoid stiff product-introduction wording.
- Avoid exaggerated marketing language such as "amazing product", "best product ever", "life-changing", or unsupported performance promises.
- Base the script only on the provided product name, functions, features, and use scenarios.
- Do not invent unprovided functions, unverifiable effects, fake personal experience, or fictional user stories.
- If product information is limited, use cautious phrasing such as "如果你正在寻找...", "根据提供的信息...", or "这款产品可能适合...".
- Do not say "我用了之后发现..." unless the provided data explicitly contains real usage experience.

【AI Quality Check Layer】
Before returning the final JSON, silently review and revise the output:
- Evidence Validation: confirm every analysis conclusion is supported by the provided Title, Description, Features, Specifications, price, brand, or image links. If no evidence exists, replace the claim with "未提供", "未知", or "无法判断".
- Hallucination Detection: remove any unprovided brand, material, specification, certification, user persona, usage experience, or effect promise.
- Marketing Claim Review: remove absolute or unverifiable claims such as "Best", "Number one", "Perfect", "Guaranteed", "Life-changing", "100% effective", or similar exaggerated wording.
- Confidence Calibration: when evidence is limited, use cautious wording such as "May", "Could", "Based on available information", or "Cannot determine" instead of overconfident conclusions.
- Final Output Review: ensure the final JSON contains no unsupported facts, no fictional experience, no exaggerated marketing language, and still respects Simplified Chinese output plus the 150-character full_text limit.

Return strict JSON only. Do not include markdown, comments, or any text outside JSON. Keep this exact JSON shape:
{
  "product_info": {
    "name": "产品名称或未提供",
    "category": "品类或无法判断",
    "price": "价格或未提供",
    "brand": "品牌或未提供",
    "key_features": ["基于证据的功能价值1", "基于证据的功能价值2"],
    "specifications": ["规格1", "规格2"]
  },
  "analysis": {
    "target_users": ["适合的人群与原因，使用自然中文表达"],
    "use_scenarios": ["具体使用场景与场景价值，使用自然中文表达"],
    "pain_points": ["用户痛点与购买动机，使用自然中文表达"],
    "selling_points": ["核心卖点、购买价值或需确认的信息，使用自然中文表达"]
  },
  "video_script": {
    "hook": "前5秒的钩子文案",
    "body": "自然中文口播正文，不显示结构标签",
    "full_text": "完整文案（150个中文字符以内）"
  }
}`;

  const userPrompt = `Please analyze the product based on the information below and generate the required JSON result. All output values must be in Simplified Chinese, while preserving the existing JSON keys.

Product data:
${productData}

${images.length > 0 ? `Product image links for reference:
${images.slice(0, 3).join("\n")}` : ""}

Important instructions:
- Use only the provided product data. Do not add unsupported facts.
- Analyze product value, ideal customer, customer pain points, purchase motivation, primary use cases, key selling points, potential concerns, missing information, and overall recommendation within the existing analysis fields.
- Separate Observed Facts from Reasonable Inferences. Every inference must cite Evidence internally; if Evidence is insufficient, output "未知", "未提供", or "无法判断" instead.
- Keep Observed Facts, Reasonable Inferences, and Evidence checks internal. Do not expose these labels, English analysis headings, or pipe-separated reasoning in the final JSON values.
- If the data does not support a conclusion, write "未提供", "未知", or "无法判断".
- Generate video_script in realistic TikTok UGC style: natural creator voice, concrete scenario, no brand-ad tone, no fake personal experience, and no unsupported effects.
- Before returning JSON, run an internal quality check for unsupported facts, hallucinated details, exaggerated marketing claims, overconfident wording, and the 150-character full_text limit.
- Keep full_text within 150 Chinese characters.
- Return strict JSON only, matching the required structure exactly.`;

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
