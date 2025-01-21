import { NextApiRequest, NextApiResponse } from 'next';
import { SchemaEnhancer } from '../../middleware/schemaEnhancer';
import { Engine } from '../../types/connection';

// 这是一个常规的 API 路由，不是 Edge Runtime
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[EnhancePrompt] Starting prompt enhancement');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  try {
    const { question, basePrompt, connection: userConnection } = req.body;
    console.log('[EnhancePrompt] Original question:', question);

    const schemaEnhancer = SchemaEnhancer.getInstance();
    const connection = {
      id: userConnection?.id || "default",
      title: userConnection?.title || "MySQL Connection",
      engineType: userConnection?.engineType || Engine.MySQL,
      host: userConnection?.host || process.env.DB_HOST || "localhost",
      port: userConnection?.port || process.env.DB_PORT || "3306",
      username: userConnection?.username || process.env.DB_USER || "root",
      password: userConnection?.password || process.env.DB_PASSWORD || "",
      database: userConnection?.database || "tumo"
    };

    console.log('[EnhancePrompt] Database connection established');

    console.log('[EnhancePrompt] Retrieving schema comments...');
    const schemasWithComments = await schemaEnhancer.enhancePrompt(
      question,
      connection,
      "tumo",
      basePrompt
    );
    console.log('[EnhancePrompt] Schema comments retrieved:', JSON.stringify(schemasWithComments, null, 2));

    console.log('[EnhancePrompt] Finding relevant tables...');
    // 检查是否包含 data_iris 表的信息
    if (!schemasWithComments.includes('data_iris')) {
      console.warn('[EnhancePrompt] Warning: Enhanced prompt does not contain data_iris table information');
    }

    console.log('[EnhancePrompt] Relevant tables found:', JSON.stringify(schemasWithComments, null, 2));

    console.log('[EnhancePrompt] Enhanced prompt generated:', schemasWithComments);

    return res.status(200).json({ enhancedPrompt: schemasWithComments });
  } catch (error: any) {
    console.error('[EnhancePrompt] Error:', error);
    return res.status(500).json({
      error: {
        message: error.message || 'Failed to enhance prompt'
      }
    });
  }
}
