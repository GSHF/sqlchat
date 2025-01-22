import { NextApiRequest, NextApiResponse } from "next";
import { executeGeneratedAPI, parseAndGenerateAPI } from "@/utils/sqlToApi";
import { Connection, Engine } from "@/types/connection";
import { decrypt } from "@/utils/encryption";
import { withAPIStatusCheck } from "@/middleware/apiStatusCheck";

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
    // 移除URL中的分号
    const tableName = (req.query.table as string).replace(/;/g, '');
    console.log('Processing request for table:', tableName);
    
    if (req.method === 'GET') {
      const customQuery = req.query.query as string;
      console.log('Custom query:', customQuery);
      
      let connection: Connection;

      // 如果提供了加密的连接信息，使用它
      if (req.query.connectionInfo) {
        try {
          const encryptedInfo = req.query.connectionInfo as string;
          console.log('Encrypted connection info:', encryptedInfo);
          
          console.log('Decrypting connection info...');
          const decryptedData = decrypt(encryptedInfo);
          console.log('Raw decrypted data:', decryptedData);
          
          const decryptedInfo = JSON.parse(decryptedData);
          
          // 打印解密后的连接信息（不包含敏感数据）
          console.log('Decrypted connection info:', {
            ...decryptedInfo,
            password: '[REDACTED]',
            database: decryptedInfo.database  // 记录使用的数据库名
          });

          connection = decryptedInfo;

          // 验证数据库名
          if (!connection.database) {
            throw new Error('数据库名称是必需的。请在连接设置中指定数据库。');
          }

          // 验证必要的字段
          const missingFields = [];
          if (!connection.engineType) missingFields.push('engineType');
          if (!connection.host) missingFields.push('host');
          if (!connection.username) missingFields.push('username');
          if (!connection.port) missingFields.push('port');  

          if (missingFields.length > 0) {
            console.error('Missing required connection parameters:', missingFields);
            res.status(400).json({ 
              error: "Invalid connection information",
              details: `Missing required parameters: ${missingFields.join(', ')}`
            });
            return;
          }

          // 验证engineType是否有效
          if (!Object.values(Engine).includes(connection.engineType)) {
            res.status(400).json({
              error: "Invalid connection information",
              details: `Invalid engine type: ${connection.engineType}`
            });
            return;
          }

          connection = {
            id: 'dynamic',
            title: 'Dynamic Connection',
            engineType: connection.engineType,
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.password,
            database: connection.database
          };
        } catch (error) {
          console.error('Error decrypting connection info:', error);
          res.status(400).json({
            error: "Invalid connection information",
            details: "Failed to decrypt or parse connection information"
          });
          return;
        }
      } else {
        res.status(400).json({
          error: "Missing connection information"
        });
        return;
      }

      try {
        // 首先解析SQL查询生成API端点
        const endpoint = await parseAndGenerateAPI(customQuery);
        
        // 然后使用正确的参数顺序调用executeGeneratedAPI
        const result = await executeGeneratedAPI(endpoint, req.query, connection);
        res.json(result);
        return;
      } catch (error: any) {
        console.error('Error executing query:', error);
        res.status(500).json({
          error: "Query execution failed",
          details: error.message
        });
        return;
      }
    } else {
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
      return;
    }
  } catch (error: any) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
    return;
  }
};

// 使用 API 状态检查中间件包装处理程序
export default withAPIStatusCheck(handler);
