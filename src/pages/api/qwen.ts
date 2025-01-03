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
    const appId = process.env.QWEN_APP_ID || "";
    const secretKey = process.env.QWEN_SECRET_KEY || "";

    if (!appId || !secretKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Missing required environment variables",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const reqBody: QwenRequestBody = await req.json();
    const messages = reqBody.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestBody: QwenRequestBody = {
      model: "rsv-8h619k0x",
      version: "default",
      messages: messages,
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
      frequency_penalty: 0.1,
    };

    const headers = {
      "Content-Type": "application/json",
      APP_ID: process.env.QWEN_APP_ID || "",
      SECRET_KEY: process.env.QWEN_SECRET_KEY || "",
    };

    try {
      const isInternalQwen = process.env.QWEN_INTERNAL === "true";

      if (isInternalQwen) {
        console.log("Internal Qwen Request Body:", requestBody);
        const response = await fetch(QWEN_API_URL, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          console.error("Internal Qwen API Error:", response.status, response.statusText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        console.log("Internal Qwen Raw Response:", responseText);

        let responseData;
        try {
          responseData = JSON.parse(responseText);
          console.log("Parsed Response Data:", responseData);
        } catch (error) {
          console.error("Failed to parse response as JSON:", error);
          throw new Error("Invalid response format from Qwen API");
        }

        // 确保响应中包含必要的字段
        if (!responseData.message?.content) {
          console.error("Missing required fields in response:", responseData);
          throw new Error("Invalid response structure from Qwen API");
        }

        // 构造标准响应格式
        const standardResponse: StandardResponse = {
          message: {
            content: responseData.message.content,
            role: responseData.message.role || "assistant",
          },
        };

        // 如果存在 token 使用信息，添加到响应中
        if (responseData.total_tokens) {
          standardResponse.usage = {
            prompt_tokens: responseData.prompt_tokens || 0,
            completion_tokens: responseData.completion_tokens || 0,
            total_tokens: responseData.total_tokens || 0,
          };
        }

        console.log("Final Response:", standardResponse);
        return new Response(JSON.stringify(standardResponse), {
          headers: { "Content-Type": "application/json" },
        });
      } else {
        const response = await fetch(req.headers.get("x-qwen-endpoint") || "", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let buffer = "";

        const transformStream = new TransformStream({
          async transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim() === "") continue;
              const jsonStr = line.replace(/^data: /, "").trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const json = JSON.parse(jsonStr);
                if (json.message?.content) {
                  const formattedChunk = {
                    id: "chatcmpl-" + Date.now(),
                    object: "chat.completion.chunk",
                    created: Date.now(),
                    model: "qwen-turbo",
                    choices: [
                      {
                        delta: {
                          content: json.message.content,
                        },
                        index: 0,
                        finish_reason: null,
                      },
                    ],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(formattedChunk)}\n\n`));
                }
              } catch (error) {
                console.error("Error parsing JSON:", error);
              }
            }
          },
          flush(controller) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          },
        });

        return new Response(response.body?.pipeThrough(transformStream), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error.message || "An error occurred while processing your request",
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
          message: error.message || "An error occurred while processing your request",
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
