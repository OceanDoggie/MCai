import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PoseStructure } from "../types";

// 🔴 1. Securely load API Key from .env.local
// With the fix in vite.config.ts, we check both sources.
const API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  (globalThis as any).process?.env?.VITE_GEMINI_API_KEY ||
  (globalThis as any).process?.env?.GEMINI_API_KEY ||
  "";

// Debug Log (Masked)
const keyStatus = API_KEY ? `Present (${API_KEY.substring(0, 4)}***)` : "Missing";
console.log(`[Gemini Config] API Key Status: ${keyStatus}`);

if (!API_KEY) {
  console.error("❌ Critical: Missing VITE_GEMINI_API_KEY. Please check .env.local");
}

// Initialize safely
const ai = new GoogleGenAI({ apiKey: API_KEY });

// 🔴 2. Unified Model Name
const MODEL_NAME = 'gemini-2.0-flash-exp';

// 🔴 3. Safety Settings
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export interface AnalyzedPoseData {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;  // 摄影师指导词
  tips: string[];
  tags: string[];
  structure: PoseStructure;
}

/**
 * 分析上传的图片，生成固定指导词
 */
export const analyzePoseImage = async (base64Image: string, sourceName: string = "unknown"): Promise<AnalyzedPoseData> => {
  if (!API_KEY) {
    throw new Error("API key is missing. Please check .env.local");
  }

  // 清理 Base64 前缀
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  console.log(`[Gemini] Starting analysis for image: ${sourceName} (length: ${base64Data.length})`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, // ✅ 使用统一配置的模型
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: `Analyze this pose for a photography app. Return JSON only.
            Fields:
            1. title (string) - 姿势名称
            2. difficulty (Easy/Medium/Hard)
            3. description (string) - 摄影师机位指导词，格式必须是：
               "[站距] arms ([距离]m) | [倍数]x | [高度] Level | [角度] [度数]°"
               根据姿势类型选择：
               - 站姿全身: "2 arms (1.8m) | 1x | Chest Level | Inward 15°"
               - 站姿半身: "2 arms (1.8m) | 1.5x | Chest Level | Inward 15°"
               - 坐姿半身: "2 arms (1.8m) | 1.5x | Chest Level | Inward 15°"
               - 蹲姿: "1 arm (1.2m) | 2x | Neck Level | Outward 10°"
               - 躺姿: "2.5 arms (2m) | 2x | Eye Level | Outward 35°"
               - 脸部特写: "2 arms (1.8m) | 3x | Neck Level | Inward 15°"
               - 仰拍站姿: "4 arms (2.5m) | 1x | Knee Level | Inward 15°"
               - 俯拍坐/蹲姿: "2 arms (1.5m) | 2x | Eye Level | Outward 35°"
            4. tags (array of strings)
            5. structure (object with head, hands, feet instructions for model)
            6. tips (array of strings)`
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        // ✅ 添加安全设置，防止报错
        safetySettings: SAFETY_SETTINGS,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
            description: { type: Type.STRING },  // 摄影师指导词
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            structure: {
              type: Type.OBJECT,
              properties: {
                head: { type: Type.STRING },
                hands: { type: Type.STRING },
                feet: { type: Type.STRING },
              },
              required: ["head", "hands", "feet"]
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            }
          },
          required: ["title", "difficulty", "description", "tips", "tags", "structure"],
        },
      },
    });

    let text = response.text;
    if (!text) throw new Error("No response from AI");

    // ✅ 清理可能存在的 Markdown 标记，防止 JSON.parse 失败
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    console.log("[Gemini] Received analysis results:", text);

    return JSON.parse(text) as AnalyzedPoseData;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    // 🚩 RETHROW so the UI knows it failed. Do NOT return fallback data here.
    throw error;
  }
};

/**
 * 实时纠错反馈（Live Coaching）
 */
export const getLiveCoachingFeedback = async (
  referenceImageSrc: string,
  userFrameBase64: string,
  structure: PoseStructure
): Promise<string> => {
  // 处理参考图 Base64
  let referenceData = "";
  if (referenceImageSrc.includes("base64")) {
    referenceData = referenceImageSrc.split(',')[1];
  } else {
    // 如果是 URL，简单跳过或需要 fetch 转 base64（此处简化处理）
    return "Hold steady...";
  }

  const userFrameData = userFrameBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, // ✅ 确保这里也用了 1.5 Flash
      config: {
        safetySettings: SAFETY_SETTINGS, // ✅ 同样关闭安全拦截
      },
      contents: {
        parts: [
          { text: "Reference:" },
          { inlineData: { mimeType: 'image/jpeg', data: referenceData } },
          { text: "User Live:" },
          { inlineData: { mimeType: 'image/jpeg', data: userFrameData } },
          {
            text: `Compare User to Reference. Target: ${structure.head}, ${structure.hands}, ${structure.feet}.
            If match > 85%, say "Perfect!". Else, give 1 short correction (max 6 words). Output TEXT only.`
          },
        ],
      },
    });

    return response.text?.trim() || "Hold steady...";
  } catch (error: any) {
    // 静默处理 Quota 错误
    const msg = error?.message || '';
    if (msg.includes('429')) {
      console.warn("Quota exceeded. Pausing AI.");
      throw { status: 429 };
    }
    console.error("Live Coaching Error:", error);
    return "Great energy!";
  }
};