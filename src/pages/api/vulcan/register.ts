import { NextApiRequest, NextApiResponse } from 'next';
import { Vulcan } from '../../../vulcan/core';
import { getConnectionInstance } from '../../../utils/connection';
import { encrypt } from '../../../utils/encryption';

// 存储 Vulcan 实例的 Map
const vulcanInstances = new Map<string, Vulcan>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, description, connection, tableName, sqlQuery, database } = req.body;

  if (!connection || !sqlQuery || !tableName || !name) {
    return res.status(400).json({ error: 'Name, connection, SQL query and table name are required' });
  }

  try {
    // 获取或创建 Vulcan 实例
    const connectionKey = JSON.stringify(connection);
    let vulcan = vulcanInstances.get(connectionKey);

    if (!vulcan) {
      // 确保连接对象使用正确的数据库
      if (!connection.database && database) {
        connection.database = database;
      }

      try {
        // 验证连接
        await getConnectionInstance(connection);
        
        vulcan = new Vulcan({ connection });
        vulcanInstances.set(connectionKey, vulcan);
      } catch (error) {
        console.error('Connection validation failed:', error);
        return res.status(400).json({ error: 'Failed to validate database connection' });
      }
    }

    // 生成API endpoint
    const connectionInfo = encodeURIComponent(encrypt(JSON.stringify(connection)));
    const encodedQuery = encodeURIComponent(sqlQuery);
    const endpoint = `/api/sql/${tableName}?connectionInfo=${connectionInfo}&query=${encodedQuery}`;
    
    try {
      // 注册新的 SQL API
      vulcan.addSQL(sqlQuery);

      // 创建新的API记录
      const apiResponse = await fetch(`${req.headers.origin}/api/api-management/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          url: endpoint,
          sqlQuery,
          connectionId: connectionKey,
          tableName,
          database,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to create API record');
      }

      const apiData = await apiResponse.json();
      
      return res.status(200).json({
        message: 'SQL API registered successfully',
        api: apiData.api,
        documentation: {
          url: endpoint,
          method: 'GET',
          description: description || 'No description provided',
          parameters: {
            connectionInfo: 'Connection information (encrypted)',
            query: 'SQL query (URL encoded)',
          },
        },
      });
    } catch (error) {
      console.error('API registration failed:', error);
      return res.status(500).json({ error: 'Failed to register API' });
    }
  } catch (error) {
    console.error('Error in API registration:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
