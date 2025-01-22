import { NextApiRequest, NextApiResponse } from 'next';
import { Vulcan } from '../../../../vulcan/core';
import { getConnectionInstance } from '../../../../utils/connection';

// 存储 Vulcan 实例的 Map
declare global {
  var vulcanInstances: Map<string, Vulcan>;
}

if (!global.vulcanInstances) {
  global.vulcanInstances = new Map<string, Vulcan>();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { table, action } = req.query;
  const { connection, sql } = req.body;

  if (!connection) {
    return res.status(400).json({ error: 'Connection configuration is required' });
  }

  try {
    const connectionKey = JSON.stringify(connection);
    let vulcan = global.vulcanInstances.get(connectionKey);

    if (!vulcan) {
      await getConnectionInstance(connection);
      vulcan = new Vulcan({ connection });
      global.vulcanInstances.set(connectionKey, vulcan);
    }

    // 注册新的 SQL API
    if (action === 'register' && sql) {
      const endpoint = vulcan.addSQL(sql);
      return res.status(200).json({
        message: 'SQL API registered successfully',
        endpoint,
        documentation: {
          url: `/api/vulcan/${table}/${endpoint.method.toLowerCase()}`,
          method: endpoint.method,
          parameters: endpoint.params,
          example: {
            curl: `curl -X ${endpoint.method} http://your-domain/api/vulcan/${table}/${endpoint.method.toLowerCase()}${
              endpoint.params.length > 0 
                ? '?' + endpoint.params.map(p => `${p.name}=value`).join('&') 
                : ''
            }`
          }
        }
      });
    }

    // 执行 API
    if (['get', 'post', 'put', 'delete'].includes(action as string)) {
      return vulcan.handleRequest(req, res);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Vulcan API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
