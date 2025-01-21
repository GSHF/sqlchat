export const config = {
  runtime: "edge",
};

import type { NextRequest } from "next/server";
import { SchemaEnhancer } from "../../middleware/schemaEnhancer";
import { Engine } from "../../types/connection";

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

// 内网通义千问配置
const INTERNAL_QWEN_CONFIG = {
  model: "rsv-8h619k0x",
  version: "default",
  appId: "8fb1bd5df3b24265bcfff855652e3c9a",
  secretKey: "41514d28b825409468b0241dc4a672ab",
  endpoint: "http://25.41.34.249:8008/api/ai/qwen/72b/chat",
};

// 外网通义千问配置
const EXTERNAL_QWEN_CONFIG = {
  endpoint: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
  appId: "",
  secretKey: "",
  model: "qwen-turbo"
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
      },
    );
  }

  try {
    const reqBody = await req.json();
    
    // 从请求头中获取配置信息
    const qwenEndpoint = req.headers.get("x-qwen-endpoint") || INTERNAL_QWEN_CONFIG.endpoint;
    const qwenAppId = req.headers.get("x-qwen-app-id") || INTERNAL_QWEN_CONFIG.appId;
    const qwenSecretKey = req.headers.get("x-qwen-secret-key") || INTERNAL_QWEN_CONFIG.secretKey;

    // 判断是否为内网环境
    const isInternalNetwork = qwenEndpoint?.includes("25.41.") || 
                            qwenEndpoint?.includes("192.168.") || 
                            qwenEndpoint?.includes("10.") ||
                            qwenEndpoint?.includes("localhost") ||
                            qwenEndpoint?.includes("127.0.0.1");

    // 根据环境选择配置
    const config = isInternalNetwork ? INTERNAL_QWEN_CONFIG : EXTERNAL_QWEN_CONFIG;

    // 直接使用传入的消息，不再进行额外的提示增强
    const messages: QwenMessage[] = reqBody.messages;
    console.log('[Qwen] Using messages:', JSON.stringify(messages, null, 2));

    // 构建请求体
    const requestBody: QwenRequestBody = {
      model: isInternalNetwork ? "rsv-8h619k0x" : "qwen-72b-v2.5",
      version: isInternalNetwork ? "default" : "v2.5",
      messages,
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

    // 构建请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isInternalNetwork) {
      headers["APP_ID"] = qwenAppId;
      headers["SECRET_KEY"] = qwenSecretKey;
    } else {
      headers["Authorization"] = `Bearer ${qwenSecretKey}`;
    }

    console.log("Qwen Request:", {
      endpoint: qwenEndpoint,
      hasAppId: !!qwenAppId,
      hasSecretKey: !!qwenSecretKey,
      messageCount: messages.length,
      model: requestBody.model,
      version: requestBody.version,
    });

    try {
      // 添加详细的请求日志
      console.log("Request Details:", {
        isInternalNetwork,
        endpoint: qwenEndpoint,
        messages,
        requestBody: JSON.stringify(requestBody, null, 2)
      });

      const response = await fetch(qwenEndpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
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
              code: response.status,
              details: errorText,
            },
          }),
          { status: response.status },
        );
      }

      const responseText = await response.text();
      console.log("Raw Response Text:", responseText);

      const responseData = JSON.parse(responseText);
      console.log("Parsed Response:", responseData);

      // 检查响应状态
      if (responseData.status_code && responseData.status_code !== "SUCCESS") {
        return new Response(
          JSON.stringify({
            error: {
              message: responseData.message?.content || "API返回错误状态",
              type: "api_error",
              status_code: responseData.status_code,
            },
          }),
          { status: 400 },
        );
      }

      // 处理响应中的SQL语句，添加必要的限制
      let processedContent = responseData.message.content;
      
      // 只在内网环境下处理 SQL
      if (isInternalNetwork) {
        // 提取SQL语句
        const sqlMatch = processedContent.match(/```sql\n([\s\S]*?)\n```/);
        if (sqlMatch) {
          const originalSql = sqlMatch[1].trim();
          let optimizedSql = originalSql;

          // 检查是否是SELECT查询
          if (optimizedSql.toLowerCase().startsWith('select')) {
            // 检查是否已经有LIMIT子句
            if (!optimizedSql.toLowerCase().includes('limit')) {
              // 添加LIMIT子句
              optimizedSql += ' LIMIT 1000';
              
              // 添加优化建议
              processedContent += '\n\n注意：为了保护数据库资源，已自动添加LIMIT 1000限制。如果需要查看更多数据，建议：\n';
              processedContent += '1. 添加更多的WHERE条件缩小结果集\n';
              processedContent += '2. 使用分页查询（LIMIT offset, count）\n';
              processedContent += '3. 考虑使用汇总查询替代全量查询';
            }
          }

          // 替换原始SQL为优化后的SQL
          processedContent = processedContent.replace(sqlMatch[0], '```sql\n' + optimizedSql + '\n```');
        }
      }

      // 构造标准响应格式
      const standardResponse: StandardResponse = {
        message: {
          content: processedContent,
          role: "assistant",
        },
        usage: {
          prompt_tokens: responseData.prompt_tokens || 0,
          completion_tokens: responseData.completion_tokens || 0,
          total_tokens: responseData.total_tokens || 0,
        },
      };

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
            details: fetchError.message,
          },
        }),
        { status: 503 },
      );
    }
  } catch (error: any) {
    console.error("General error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "处理请求时发生错误",
          type: "general_error",
          details: error.message,
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export default handler;
