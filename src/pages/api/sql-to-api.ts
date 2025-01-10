import { NextApiRequest, NextApiResponse } from "next";
import { parseAndGenerateAPI } from "../../utils/sqlToApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: "SQL query is required" });
    }

    const endpoint = await parseAndGenerateAPI(sql);

    // 生成API文档
    const documentation = {
      endpoint: endpoint.path,
      method: endpoint.method,
      parameters: endpoint.parameters,
      example: {
        request: `curl -X ${endpoint.method} ${endpoint.path}${
          endpoint.parameters.length > 0
            ? "?" + endpoint.parameters.map(p => `${p.name}=value`).join("&")
            : ""
        }`,
        response: {
          type: "array",
          items: {
            type: "object",
            properties: {}
          }
        }
      }
    };

    res.status(200).json({
      success: true,
      endpoint,
      documentation
    });
  } catch (error) {
    console.error("Error generating API:", error);
    res.status(500).json({ error: "Failed to generate API endpoint" });
  }
}
