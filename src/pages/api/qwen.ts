import { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

const handler = async (req: NextRequest) => {
  try {
    const reqBody = await req.json();
    const qwenEndpoint = req.headers.get("x-qwen-endpoint");
    const appId = req.headers.get("x-qwen-app-id");
    const secretKey = req.headers.get("x-qwen-secret-key");

    if (!qwenEndpoint || !appId || !secretKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: "请配置通义千问服务的 APP ID、Secret Key 和 Endpoint",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 400,
        }
      );
    }
    
    // 构建请求体
    const requestBody = {
      model: "rsv-8h619k0x",
      version: "default",
      messages: reqBody.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
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
      frequency_penalty: 0.1
    };

    // 使用自定义配置
    const headers = {
      "Content-Type": "application/json",
      "APP_ID": appId,
      "SECRET_KEY": secretKey,
    };

    const response = await fetch(qwenEndpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = "调用内网通义千问服务时发生错误";
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        console.error("解析错误响应时出错:", e);
      }

      return new Response(
        JSON.stringify({
          error: {
            message: errorMessage,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: response.status,
        }
      );
    }

    // 创建转换流来处理响应
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const jsonData = JSON.parse(line);
            if (jsonData.message?.content) {
              controller.enqueue(new TextEncoder().encode(jsonData.message.content));
            }
          } catch (e) {
            console.error("解析数据时出错:", e, "行:", line);
            continue;
          }
        }
      },
    });

    // 返回流式响应
    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("内网通义千问处理器错误:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || "发生了意外错误",
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
};

export default handler;
