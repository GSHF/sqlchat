import { SQLEndpoint, SQLParam } from "./types";

export function parseSQL(sql: string): SQLEndpoint {
  const sqlLower = sql.toLowerCase().trim();
  const method = getMethodFromSQL(sqlLower);
  const params = extractParams(sql);
  const path = generatePath(sql);

  return {
    path,
    method,
    sql,
    params
  };
}

function getMethodFromSQL(sql: string): SQLEndpoint['method'] {
  if (sql.startsWith('select')) return 'GET';
  if (sql.startsWith('insert')) return 'POST';
  if (sql.startsWith('update')) return 'PUT';
  if (sql.startsWith('delete')) return 'DELETE';
  return 'GET';
}

function extractParams(sql: string): SQLParam[] {
  const params: SQLParam[] = [];
  const whereMatch = sql.toLowerCase().match(/where\s+(.*?)(?:\s+(?:order|group|limit|$))/i);
  
  if (!whereMatch) {
    return params;  // 如果没有WHERE子句，直接返回空参数数组
  }

  const conditions = whereMatch[1].split(/\s+and\s+/i);
  conditions.forEach(condition => {
    const [field, operator, value] = condition.split(/\s*(=|>|<|>=|<=|!=|like)\s*/i);
    if (field && operator) {
      params.push({
        name: field.trim(),
        type: inferType(value),
        required: true,
        in: 'query'
      });
    }
  });

  return params;
}

function generatePath(sql: string): string {
  const fromMatch = sql.match(/from\s+(\w+)/i);
  if (!fromMatch) return '/api';
  
  const tableName = fromMatch[1];
  return `/api/${tableName}`;
}

function inferType(value: string): SQLParam['type'] {
  if (value.match(/^\d+$/)) return 'number';
  if (value.match(/^(true|false)$/i)) return 'boolean';
  return 'string';
}
