export const config = {
  runtime: "edge",
};

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { openAIApiEndpoint, openAIApiKey, openAIOrganization, hasFeature, getModel } from "@/utils";

const getApiEndpoint = (apiEndpoint: string) => {
  const url = new URL(apiEndpoint);
  url.pathname = "/v1/chat/completions";
  return url;
};

// Helper function: Clean SSE data line
const cleanSSELine = (line: string): string => {
  // Remove leading "data:" and any whitespace
  let cleaned = line.replace(/^data:\s*/, "");
  // If it's an event line, extract the JSON part
  if (cleaned.includes("event:")) {
    const match = cleaned.match(/{.*}/);
    if (match) {
      cleaned = match[0];
    }
  }
  return cleaned;
};

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

  const reqBody = await req.json();
  const provider = req.headers.get("x-provider") || "openai";

  // 内网通义千问
  if (provider === "qwen") {
    const qwenEndpoint = req.headers.get("x-qwen-endpoint");
    const appId = req.headers.get("x-qwen-app-id");
    const secretKey = req.headers.get("x-qwen-secret-key");

    if (!appId || !secretKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Missing required headers: APP_ID or SECRET_KEY",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      console.log("Qwen Request:", {
        endpoint: qwenEndpoint,
        hasAppId: !!appId,
        hasSecretKey: !!secretKey,
      });

      const qwenResponse = await fetch(new URL("/api/qwen", req.headers.get("origin") || "").toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-qwen-endpoint": qwenEndpoint || "",
          "x-qwen-app-id": appId,
          "x-qwen-secret-key": secretKey,
        },
        body: JSON.stringify(reqBody),
      });

      // Forward the response
      return qwenResponse;
    } catch (error: any) {
      console.error("Error in chat handler:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error.message || "An error occurred during your request.",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 外网通义千问
  if (provider === "dashscope") {
    const apiKey = req.headers.get("x-dashscope-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: "DashScope API Key is missing. You can supply your key via [Setting](/setting).",
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const model = req.headers.get("x-dashscope-model") || "qwen-turbo";

      const requestBody = {
        model,
        input: {
          messages: reqBody.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
          })),
        },
        parameters: {
          top_p: 0.8,
          temperature: 0.7,
          enable_search: false,
          result_format: "message",
          incremental_output: true,
        },
      };

      console.log("DashScope Request Body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/event-stream",
          "X-DashScope-SSE": "enable",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = "An error occurred while calling DashScope API";
        let errorCode = "";
        let requestId = "";

        try {
          const errorData = await response.json();
          console.error("DashScope Error Response:", errorData);

          if (errorData.code && errorData.message) {
            errorMessage = `${errorData.code}: ${errorData.message}`;
            errorCode = errorData.code;
            requestId = errorData.request_id;
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }

        return new Response(
          JSON.stringify({
            error: {
              message: errorMessage,
              code: errorCode,
              request_id: requestId,
            },
          }),
          {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          console.log("Received chunk:", text);

          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;

            console.log("Processing line:", line);

            if (line.startsWith("data:")) {
              const data = cleanSSELine(line);

              try {
                const jsonData = JSON.parse(data);
                console.log("Parsed JSON data:", jsonData);

                // Format the data as a proper SSE message
                if (jsonData.output) {
                  const content = jsonData.output.choices?.[0]?.message?.content;
                  if (content) {
                    const sseMessage = `data: ${JSON.stringify({
                      output: {
                        choices: [
                          {
                            message: {
                              content,
                              role: "assistant",
                            },
                            finish_reason: jsonData.output.choices[0].finish_reason || "null",
                          },
                        ],
                      },
                    })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(sseMessage));
                  } else {
                    console.warn("Unexpected response format:", jsonData);
                  }
                } else {
                  console.warn("Missing output field in response:", jsonData);
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e, "Line:", line);
                continue;
              }
            }
          }
        },
      });

      return new Response(response.body?.pipeThrough(transformStream), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error: any) {
      console.error("DashScope Handler Error:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error.message || "An unexpected error occurred",
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // OpenAI logic
  const apiKey = req.headers.get("x-openai-key") || openAIApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: {
          message: "OpenAI API Key is missing. You can supply your own key via [Setting](/setting).",
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const useServerKey = !req.headers.get("x-openai-key");
  const sessionToken = req.cookies.get("next-auth.session-token")?.value;
  if (!req.url) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Request URL is missing",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  const currentUrl = new URL(req.url);
  const usageUrl = new URL(currentUrl.protocol + "//" + currentUrl.host + "/api/usage");
  const requestHeaders: any = {
    Authorization: `Bearer ${sessionToken}`,
  };
  const modelHeader = req.headers.get("x-openai-model");
  const modelValue = modelHeader;
  const model = getModel(modelValue || "");

  if (req.headers.get("x-openai-model")) {
    requestHeaders["x-openai-model"] = modelValue;
  }

  if (useServerKey) {
    if (hasFeature("account") && !sessionToken) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Please sign in first.",
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (hasFeature("quota")) {
      const usageResponse = await fetch(usageUrl, {
        headers: requestHeaders,
      });
      const usageData = await usageResponse.json();
      if (!usageResponse.ok) {
        return new Response(JSON.stringify(usageData), {
          status: usageResponse.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (usageData.usage + model.cost_per_call > usageData.quota) {
        return new Response(
          JSON.stringify({
            error: {
              message: "You have exceeded your quota.",
            },
          }),
          {
            status: 402,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
  }

  try {
    const apiEndpoint = req.headers.get("x-openai-endpoint") || openAIApiEndpoint;
    const endpoint = getApiEndpoint(apiEndpoint);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(openAIOrganization
          ? {
              "OpenAI-Organization": openAIOrganization,
            }
          : {}),
      },
      body: JSON.stringify({
        ...reqBody,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify(error), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error in chat handler:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || "An error occurred during your request.",
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
