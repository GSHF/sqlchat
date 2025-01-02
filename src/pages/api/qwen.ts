import { NextRequest } from "next/server";

interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface QwenRequestBody {
  messages: QwenMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
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

export const config = {
  runtime: "edge",
};

const DEFAULT_TIMEOUT = 60000;

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
    const requestHeaders = req.headers;
    const qwenEndpoint = requestHeaders.get("x-qwen-endpoint");
    const appId = requestHeaders.get("x-qwen-app-id");
    const secretKey = requestHeaders.get("x-qwen-secret-key");

    if (!qwenEndpoint || !appId || !secretKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Missing required headers",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const reqBody: QwenRequestBody = await req.json();

    const requestBody = {
      model: "rsv-8h619k0x",
      version: "default",
      messages: reqBody.messages,
      stream: true,
      max_tokens: 2048,
      enableDoc: false,
      enableBI: false,
      enablePlugin: false,
      enableHotQA: false,
      temperature: 0.6,
      top_k: 5,
      top_p: 0.3,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    };

    const headers = {
      "Content-Type": "application/json",
      APP_ID: appId,
      SECRET_KEY: secretKey,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(qwenEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error?.message || "调用内网通义千问服务时发生错误";
        if (errorData.status_code === "OVER-MAX-TOKENS") {
          errorMessage = "对话历史过长，已超出模型最大token限制。已自动保留最近的对话。";
        }
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error: any) {
      console.error("Error:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error.message || "An error occurred during the request",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || "An error occurred while processing the request",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export default handler;
