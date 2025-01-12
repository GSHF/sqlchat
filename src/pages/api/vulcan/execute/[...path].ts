import { NextApiRequest, NextApiResponse } from 'next';
import { Vulcan } from '../../../../vulcan/core';
import { getConnectionInstance } from '../../../../utils/connection';

// 存储 Vulcan 实例的 Map（从 register.ts 共享）
declare global {
  var vulcanInstances: Map<string, Vulcan>;
}

if (!global.vulcanInstances) {
  global.vulcanInstances = new Map<string, Vulcan>();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { connection } = req.body;
  if (!connection) {
    return res.status(400).json({ error: 'Connection configuration is required' });
  }

  try {
    const connectionKey = JSON.stringify(connection);
    const vulcan = global.vulcanInstances.get(connectionKey);

    if (!vulcan) {
      return res.status(404).json({ error: 'No API found for this connection' });
    }

    // 处理 API 请求
    return vulcan.handleRequest(req, res);
  } catch (error) {
    console.error('API execution error:', error);
    return res.status(500).json({ error: 'Failed to execute API' });
  }
}
