import { Connection, Engine } from "../types/connection";
import { encrypt } from "./encryption";

export function generateSqlApiUrl(
  connection: Connection,
  sqlQuery: string,
  tableName: string = "query",
  apiId?: string
): string {
  // 确保tableName不包含分号
  tableName = tableName.replace(/;/g, '');
  
  // 验证connection对象
  if (!connection || typeof connection !== 'object') {
    console.error('Invalid connection object:', connection);
    throw new Error('Invalid connection object');
  }

  // 验证必要的连接信息
  const missingFields = [];
  if (!connection.host) missingFields.push('主机地址(host)');
  if (!connection.username) missingFields.push('用户名(username)');
  if (!connection.engineType) missingFields.push('数据库类型(engineType)');
  if (!connection.database) missingFields.push('数据库名称(database)');

  if (missingFields.length > 0) {
    console.error('缺少必要的连接信息:', missingFields);
    throw new Error(`缺少必要的连接信息：${missingFields.join('、')}\n请先配置数据源信息`);
  }

  // 验证数据库类型是否支持
  const supportedEngines = Object.values(Engine);
  if (!supportedEngines.includes(connection.engineType)) {
    throw new Error(`不支持的数据库类型：${connection.engineType}\n支持的类型：${supportedEngines.join(', ')}`);
  }

  // 提取并验证连接信息
  const connectionInfo = {
    engineType: connection.engineType,
    host: connection.host,
    port: connection.port || '3306',
    username: connection.username,
    password: connection.password || '',
    database: connection.database,  // 确保使用当前选择的数据库
    encrypt: connection.encrypt
  };

  // 记录加密前的连接信息（不包含敏感信息）
  console.log('Connection info before encryption:', {
    ...connectionInfo,
    password: connectionInfo.password ? '[REDACTED]' : undefined,
    database: connectionInfo.database  // 记录当前使用的数据库名
  });
  console.log('Has database:', !!connectionInfo.database);

  // 加密连接信息
  const encryptedConnectionInfo = encrypt(JSON.stringify(connectionInfo));
  console.log('Encrypted connection info:', encryptedConnectionInfo);
  
  // 构建URL
  const encodedQuery = encodeURIComponent(sqlQuery || '');
  const url = `/api/sql/${tableName}?connectionInfo=${encodeURIComponent(encryptedConnectionInfo)}${sqlQuery ? `&query=${encodedQuery}` : ''}${apiId ? `&apiId=${apiId}` : ''}`;
  
  return url;
}

export function generateCurlCommand(
  connection: Connection,
  sqlQuery: string,
  tableName: string = "query"
): string {
  const apiUrl = generateSqlApiUrl(connection, sqlQuery, tableName);
  return `curl -X GET "${apiUrl}"`;
}
