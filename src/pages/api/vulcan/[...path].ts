import { NextApiRequest, NextApiResponse } from 'next';
import { Vulcan } from '../../../vulcan/core';
import { getConnectionInstance } from '../../../utils/connection';

// 存储 Vulcan 实例的 Map
const vulcanInstances = new Map<string, Vulcan>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { connection, sql } = req.body;

  if (!connection) {
    return res.status(400).json({ error: 'Connection configuration is required' });
  }

  try {
    // 获取或创建 Vulcan 实例
    const connectionKey = JSON.stringify(connection);
    let vulcan = vulcanInstances.get(connectionKey);

    if (!vulcan) {
      // 验证连接
      getConnectionInstance(connection);
      
      vulcan = new Vulcan({ connection });
      vulcanInstances.set(connectionKey, vulcan);
    }

    // 如果是注册新的 SQL
    if (req.method === 'POST' && sql) {
      const endpoint = vulcan.addSQL(sql);
      return res.status(200).json({
        message: 'SQL API registered successfully',
        endpoint
      });
    }

    // 处理 API 请求
    return vulcan.handleRequest(req, res);
  } catch (error) {
    console.error('Vulcan API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
