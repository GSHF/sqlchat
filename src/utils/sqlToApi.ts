import { Connection } from "../types/connection";
import { getConnectionInstance } from "./connection";
import { Client as PGClient } from 'pg';

interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  value?: string;
  operator?: string;
  originalName?: string;
  isFixed?: boolean;
}

interface APIEndpoint {
  method: string;
  path: string;
  parameters: APIParameter[];
  sql: string;
}

export async function parseAndGenerateAPI(sql: string): Promise<APIEndpoint> {
  try {
    // 1. 解码并规范化SQL
    const rawSQL = decodeURIComponent(sql)
      .replace(/--.*$/gm, '')         // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .replace(/\n/g, ' ')            // 换行转空格
      .replace(/\s+/g, ' ')           // 多个空格合并
      .trim()
      .replace(/;$/, '');             // 移除末尾分号

    console.log('Normalized SQL:', rawSQL);

    // 2. 使用更严格的正则表达式解析SQL，确保提取正确的表名
    const sqlParser = /\bFROM\s+([a-zA-Z0-9_]+)(?=\s*(?:WHERE|ORDER\s+BY|GROUP\s+BY|LIMIT|$))/i;

    const tableMatch = rawSQL.replace(/\n/g, ' ').trim().match(sqlParser);

    if (!tableMatch) {
      throw new Error('无法从SQL中提取表名');
    }

    // 3. 提取并清理表名
    let tableName = tableMatch[1];
    console.log('Extracted raw table name:', tableName);

    // 如果有schema前缀，只取表名部分
    if (tableName.includes('.')) {
      tableName = tableName.split('.')[1];
    }

    // 移除非字母数字字符，确保不会包含 WHERE 等关键字
    tableName = tableName.replace(/[^a-zA-Z0-9]/g, '');
    console.log('Cleaned table name:', tableName);

    // 4. 确定HTTP方法
    const method = rawSQL.toLowerCase().startsWith('select') ? 'GET'
                 : rawSQL.toLowerCase().startsWith('insert') ? 'POST'
                 : rawSQL.toLowerCase().startsWith('update') ? 'PUT'
                 : rawSQL.toLowerCase().startsWith('delete') ? 'DELETE'
                 : 'GET';

    // 5. 处理WHERE条件
    const parameters: APIParameter[] = [];
    const whereMatch = rawSQL.match(/\bWHERE\s+(.+?)(?:\s+(?:ORDER\s+BY|GROUP\s+BY|LIMIT|$)|\s*$)/i);
    
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      console.log('WHERE clause:', whereClause);

      // 分割AND条件
      const conditions = whereClause
        .split(/\s+AND\s+/i)
        .map(c => c.trim())
        .filter(Boolean);

      console.log('Conditions:', conditions);

      conditions.forEach(condition => {
        const operatorMatch = condition.match(/([^\s]+)\s*(=|!=|>|>=|<|<=|LIKE|IN|NOT\s+IN|BETWEEN)\s*(.+)/i);
        if (operatorMatch) {
          const [, field, operator, value] = operatorMatch;
          const cleanValue = value.trim();
          const isFixedValue = (
            (cleanValue.startsWith("'") && cleanValue.endsWith("'")) || 
            (cleanValue.startsWith('"') && cleanValue.endsWith('"'))
          );

          console.log('Parsed condition:', {
            field: field.trim(),
            operator: operator.trim().toUpperCase(),
            value: cleanValue,
            isFixedValue
          });

          console.log('Raw SQL Input:', sql);
          console.log('Decoded and Normalized SQL:', rawSQL);
          console.log('Table Match:', tableMatch);

          parameters.push({
            name: field.trim().toLowerCase(),
            originalName: field.trim(),
            type: "string",
            required: !isFixedValue,
            operator: operator.trim().toUpperCase(),
            value: isFixedValue ? cleanValue.slice(1, -1) : undefined,
            isFixed: isFixedValue
          });
        }
      });
    }

    // 6. 构建API端点
    const endpoint = {
      method,
      path: `/api/sql/${tableName}`,
      parameters,
      sql: rawSQL
    };

    console.log('Generated endpoint:', {
      path: endpoint.path,
      method: endpoint.method,
      parameterCount: parameters.length,
      parameters: parameters.map(p => ({
        name: p.name,
        required: p.required,
        isFixed: p.isFixed,
        value: p.value
      }))
    });

    return endpoint;
  } catch (error) {
    console.error('Error parsing SQL:', error);
    throw error;
  }
}

export async function executeGeneratedAPI(
  endpoint: APIEndpoint,
  params: Record<string, any>,
  connection: Connection
) {
  try {
    if (!connection.database) {
      throw new Error('Database name is required. Please specify a database in your connection settings.');
    }

    const instance = await getConnectionInstance(connection);
    if (!instance) {
      throw new Error('Failed to get database connection instance');
    }
    
    let finalSQL = endpoint.sql;
    console.log('Initial SQL:', finalSQL);
    
    // 处理所有参数
    if (endpoint.parameters.length > 0) {
      // 首先处理固定值参数
      const fixedParams = endpoint.parameters.filter(p => p.isFixed && p.value !== undefined);
      for (const param of fixedParams) {
        const pattern = new RegExp(
          `${escapeRegExp(param.originalName || param.name)}\\s*${param.operator ? escapeRegExp(param.operator) : '[^\\s AND)]+'}\\s*('[^']*'|"[^"]*"|[^\\s AND)]+)`,
          'i'
        );
        
        if (pattern.test(finalSQL)) {
          finalSQL = finalSQL.replace(
            pattern,
            `${param.originalName || param.name} ${param.operator || '='} '${param.value}'`
          );
          console.log('After fixed param replacement:', finalSQL);
        }
      }

      // 然后处理动态参数
      const dynamicParams = endpoint.parameters.filter(p => !p.isFixed);
      for (const param of dynamicParams) {
        const paramName = param.name.toLowerCase();
        const value = params[paramName] || params[param.originalName || paramName];
        
        if (!value && param.required) {
          throw new Error(`Missing required parameter: ${param.originalName || param.name}`);
        }
        
        if (value) {
          const pattern = new RegExp(
            `${escapeRegExp(param.originalName || param.name)}\\s*${param.operator ? escapeRegExp(param.operator) : '[^\\s AND)]+'}\\s*('[^']*'|"[^"]*"|[^\\s AND)]+)`,
            'i'
          );
          
          if (pattern.test(finalSQL)) {
            finalSQL = finalSQL.replace(
              pattern,
              `${param.originalName || param.name} ${param.operator || '='} ${typeof value === 'string' ? `'${value}'` : value}`
            );
            console.log('After dynamic param replacement:', finalSQL);
          }
        }
      }
    }

    console.log('Final SQL to execute:', finalSQL);

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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
