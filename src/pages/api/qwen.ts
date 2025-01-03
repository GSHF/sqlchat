export const config = {
  runtime: "edge",
};

import type { NextRequest } from "next/server";

interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface QwenRequestBody {
  model?: string;
  version?: string;
  messages: QwenMessage[];
  stream?: boolean;
  max_tokens?: number;
  enableDoc?: boolean;
  enableBI?: boolean;
  enablePlugin?: boolean;
  enableHotQA?: boolean;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
}

interface QwenResponse {
  id: string;
  created_time: number;
  model: string;
  version: string;
  message: {
    role: string;
    content: string;
    type: null;
    features: null;
  };
  index: number;
  prompt_tokens: number;
  finish: boolean;
  status_code: string;
  completion_tokens: number;
  total_tokens: number;
  DebugInfoMap: Record<string, any>;
  debug_infos: null;
  references: Record<string, any>;
}

interface StandardResponse {
  message: {
    content: string;
    role: string;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface QwenConfig {
  model: string;
  version: string;
  messages: QwenMessage[];
  stream: boolean;
  max_tokens: number;
  enableDoc: boolean;
  enableBI: boolean;
  enablePlugin: boolean;
  enableHotQA: boolean;
  temperature: number;
  top_k: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
}

const DEFAULT_TIMEOUT = 60000;

const QWEN_API_URL = "http://25.41.34.249:8008/api/ai/qwen/72b/chat";

const handler = async (req: NextRequest) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: {
          message: "Method not allowed",
        },
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const reqBody = await req.json();
    const messages = reqBody.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 构建请求体，完全匹配Python示例的结构
    const requestBody: QwenRequestBody = {
      model: "rsv-8h619k0x",
      version: "default",
      messages: [
        {
          role: "system",
          content: '你是由山东电力开发的人工智能智能助手，如果别人询问你的身份或名字，请务必说自己叫\'文心一言\'，你可以帮助用户回答各类问题。'
        },
        ...messages
      ],
      stream: false,
      max_tokens: 2048,
      enableDoc: false,
      enableBI: false,
      enablePlugin: false,
      enableHotQA: false,
      temperature: 0.6,
      top_k: 5,
      top_p: 0.3,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    };

    // 设置请求头，使用固定的凭证
    const headers = {
      "Content-Type": "application/json",
      "APP_ID": "8fb1bd5df3b24265bcfff855652e3c9a",
      "SECRET_KEY": "41514d28b825409468b0241dc4a672ab"
    };

    console.log("Qwen Request:", {
      url: QWEN_API_URL,
      headers: headers,
      body: requestBody
    });

    try {
      const response = await fetch(QWEN_API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000)  // 10 seconds timeout
      });

      if (!response.ok) {
        console.error("Qwen API Error:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error details:", errorText);
        return new Response(
          JSON.stringify({
            error: {
              message: `API服务器返回错误: ${response.status} ${response.statusText}`,
              type: "api_error",
              code: response.status
            }
          }),
          { status: response.status }
        );
      }

      const responseText = await response.text();
      console.log("Raw Response Text:", responseText);

      const responseData = JSON.parse(responseText);
      console.log("Parsed Response:", responseData);

      // 构造标准响应格式
      const standardResponse = {
        message: {
          content: responseData.message?.content || "",
          role: responseData.message?.role || "assistant",
        },
        usage: {
          prompt_tokens: responseData.prompt_tokens || 0,
          completion_tokens: responseData.completion_tokens || 0,
          total_tokens: responseData.total_tokens || 0,
        },
      };

      console.log("Final Response:", standardResponse);
      return new Response(JSON.stringify(standardResponse), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({
          error: {
            message: "无法连接到API服务器，请检查网络连接或联系管理员",
            type: "connection_error",
            details: fetchError.message
          }
        }),
        { 
          status: 503,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  } catch (error: any) {
    console.error("General error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "处理请求时发生错误",
          type: "general_error",
          details: error.message
        }
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

export default handler;
