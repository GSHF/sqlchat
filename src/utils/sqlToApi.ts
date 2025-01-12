import { Connection } from "../types/connection";
import { getConnectionInstance } from "./connection";
import { Client as PGClient } from 'pg';

interface APIEndpoint {
  method: string;
  path: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
  }[];
  sql: string;
}

export async function parseAndGenerateAPI(sql: string): Promise<APIEndpoint> {
  // 解析SQL语句
  const sqlParts = sql.toLowerCase().split(" ");
  const method = sqlParts[0] === "select" ? "GET" : 
                 sqlParts[0] === "insert" ? "POST" :
                 sqlParts[0] === "update" ? "PUT" :
                 sqlParts[0] === "delete" ? "DELETE" : "GET";

  // 提取表名
  const fromIndex = sqlParts.indexOf("from");
  const tableName = sqlParts[fromIndex + 1].replace(/[^a-zA-Z0-9]/g, "");
  
  // 提取参数
  const parameters: APIEndpoint['parameters'] = [];
  const whereIndex = sqlParts.indexOf("where");
  if (whereIndex !== -1) {
    const conditions = sql.slice(whereIndex + 5).split("and");
    conditions.forEach(condition => {
      const [field] = condition.trim().split(/[=<>]/);
      parameters.push({
        name: field.trim(),
        type: "string",
        required: true
      });
    });
  }

  return {
    method,
    path: `/api/sql/${tableName}`,
    parameters,
    sql
  };
}

export async function executeGeneratedAPI(
  endpoint: APIEndpoint,
  params: Record<string, any>,
  connection: Connection
) {
  try {
    // Validate connection info
    if (!connection.database) {
      throw new Error('Database name is required. Please specify a database in your connection settings.');
    }

    const instance = await getConnectionInstance(connection);
    if (!instance) {
      throw new Error('Failed to get database connection instance');
    }
    
    // 如果有参数且WHERE子句存在，则替换参数
    let finalSQL = endpoint.sql;
    if (endpoint.parameters.length > 0) {
      endpoint.parameters.forEach(param => {
        const value = params[param.name];
        if (!value && param.required) {
          throw new Error(`Missing required parameter: ${param.name}`);
        }
        if (value) {
          finalSQL = finalSQL.replace(
            new RegExp(`${param.name}\\s*=\\s*[^\\s]+`),
            `${param.name}=${typeof value === 'string' ? `'${value}'` : value}`
          );
        }
      });
    }

    // 根据数据库类型执行SQL
    let result;
    if (instance instanceof PGClient) {
      const { rows } = await instance.query(finalSQL);
      result = rows;
    } else {
      const [rows] = await instance.query(finalSQL);
      result = rows;
    }

    return result;
  } catch (error) {
    console.error('Error executing API:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute SQL: ${errorMessage}`);
  }
}
