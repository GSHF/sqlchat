import { NextApiRequest, NextApiResponse } from 'next';
import { decrypt } from '@/utils/encryption';
import { Connection } from '@/types/connection';
import { withAPIStatusCheck } from '@/middleware/apiStatusCheck';

async function processRequest(connection: Connection, req: NextApiRequest) {
  try {
    // Extract SQL query from request body or query parameters
    const sqlQuery = req.body?.query || req.query?.query;
    
    if (!sqlQuery) {
      throw new Error('Missing SQL query');
    }

    // Here you would implement the actual SQL query execution
    // This is a placeholder - implement your actual database connection and query logic
    // Example:
    // const result = await executeQuery(connection, sqlQuery);
    // return result;
    
    return {
      success: true,
      data: [],
      message: 'Query processed successfully'
    };
  } catch (error) {
    throw error;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { connectionInfo } = req.query;
    
    if (!connectionInfo || typeof connectionInfo !== 'string') {
      return res.status(400).json({ error: 'Missing connection info' });
    }

    // 解密连接信息
    const decryptedConnection = JSON.parse(decrypt(connectionInfo)) as Connection;

    // 处理请求
    try {
      const result = await processRequest(decryptedConnection, req);
      return res.json(result);
    } catch (error: any) {
      console.error('Error processing request:', error);
      return res.status(500).json({
        error: 'Request processing failed',
        message: error.message
      });
    }
  } catch (error: any) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// 使用 API 状态检查中间件包装处理程序
export default withAPIStatusCheck(handler);
