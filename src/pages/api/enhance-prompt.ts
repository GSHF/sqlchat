// 禁用 Edge Runtime，因为需要使用 Node.js 的 net 模块来获取数据库表注释
export const config = {
  runtime: 'nodejs'
};

import { NextApiRequest, NextApiResponse } from 'next';
import { SchemaEnhancer } from '../../middleware/schemaEnhancer';
import { Connection, Engine } from '../../types/connection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  try {
    const { question, basePrompt, connection: userConnection } = req.body;
    console.log('[EnhancePrompt] Starting prompt enhancement');
    console.log('[EnhancePrompt] Original question:', question);

    const connection: Connection = {
      id: userConnection?.id || "default",
      title: userConnection?.title || "MySQL Connection",
      engineType: userConnection?.engineType || Engine.MySQL,
      host: userConnection?.host || "localhost",
      port: userConnection?.port || "3306",
      username: userConnection?.username || "root",
      password: userConnection?.password || "",
      database: userConnection?.database || "",
      version: userConnection?.version
    };

    console.log('[EnhancePrompt] Database connection established');
    console.log('[EnhancePrompt] Using database:', connection.database);
    console.log('[EnhancePrompt] Connection:', {
      ...connection,
      password: '***'
    });

    // 获取数据库表和字段的注释信息
    console.log('[EnhancePrompt] Retrieving schema comments...');
    const schemaEnhancer = new SchemaEnhancer();
    const enhancedPrompt = await schemaEnhancer.enhancePrompt(question, connection);

    // 构建最终的提示
    const finalPrompt = `你是由山东电力开发的人工智能智能助手，如果别人询问你的身份或名字，请务必说自己叫"文心一言"。

你是一个专注于text2sql的AI助手。

当前数据库环境：
- 类型: ${connection.engineType}
- 名称: ${connection.database}
${connection.version ? `- 版本: ${connection.version}` : ''}

${enhancedPrompt}

请严格遵循以下规则：

1. 表名规则：
   - 必须使用上述"相关的数据库表"中列出的完整表名，如 power_outage_failure_cust_info
   - 根据中文注释选择正确的表名，如 (配网线路故障停电-低压客户)
   - 不允许使用表名缩写或假设表名
   - 不允许省略表名前缀

2. 数据库特定性：
   - 只提供 MYSQL 数据库的SQL语句
   - 使用 MYSQL 版本的特定语法

3. 查询要求：
   - 默认返回所有字段，除非特别指定
   - 使用标准的 MYSQL 语法格式
   - 返回的 SQL 不要包含分号

4. 响应要求：
   - 提供可直接执行的 SQL 语句
   - 给出简洁的中文解释
   - 说明预期的查询结果
   - 如果遇到语法错误，提供修正建议

${question}`;

    return res.status(200).json({ enhancedPrompt: finalPrompt });
  } catch (error: any) {
    console.error('[EnhancePrompt] Error:', error);
    return res.status(500).json({
      error: {
        message: error.message,
        type: 'enhancement_error',
      }
    });
  }
}
