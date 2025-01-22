import { Connection } from '../types/connection';
import { SchemaCommentsService } from '../services/schemaComments';

export class SchemaEnhancer {
  private schemaCommentsService: SchemaCommentsService;

  constructor() {
    this.schemaCommentsService = new SchemaCommentsService();
  }

  async enhancePrompt(question: string, connection: Connection): Promise<string> {
    console.log('[SchemaEnhancer] Enhancing prompt for question:', question);
    
    // 确保数据库名称存在
    if (!connection.database) {
      throw new Error('Database name is required');
    }
    
    console.log('[SchemaEnhancer] Using database:', connection.database);
    
    // 创建一个新对象来记录连接信息，避免直接展开 Connection 类型
    const connectionInfo = {
      host: connection.host || 'localhost',
      port: connection.port || '3306',
      username: connection.username || 'root',
      database: connection.database,
      engineType: connection.engineType,
      password: '***'
    };
    console.log('[SchemaEnhancer] Connection:', connectionInfo);

    try {
      // 获取数据库表和字段的注释信息
      console.log('[SchemaEnhancer] Getting schema comments...');
      const schemaComments = await this.schemaCommentsService.getSchemaComments(connection, connection.database);

      // 构建表和字段的映射信息
      let tableInfo = '';
      
      // 首先添加可能与问题相关的表
      const questionLower = question.toLowerCase();
      const relevantTables = schemaComments.filter(table => {
        const isRelevant = 
          (table.comment && questionLower.includes(table.comment)) ||
          questionLower.includes(table.name.toLowerCase());
        return isRelevant;
      });

      if (relevantTables.length > 0) {
        tableInfo += '\n相关的数据库表：';
        for (const table of relevantTables) {
          tableInfo += `\n- ${table.name}${table.comment ? ` (${table.comment})` : ''}`;
          // 添加相关字段信息
          if (table.columns && table.columns.length > 0) {
            tableInfo += '\n  字段列表：';
            for (const column of table.columns) {
              tableInfo += `\n    - ${column.name}${column.comment ? ` (${column.comment})` : ''}: ${column.type}${column.key === 'PRI' ? ' [主键]' : ''}`;
            }
          }
        }
        tableInfo += '\n';
      }

      // 然后添加其他表的基本信息
      tableInfo += '\n所有可用的数据库表：';
      for (const table of schemaComments) {
        if (!relevantTables.includes(table)) {
          tableInfo += `\n- ${table.name}${table.comment ? ` (${table.comment})` : ''}`;
        }
      }

      // 返回增强后的提示
      return `数据库表结构信息：${tableInfo}

注意：
1. 请优先使用"相关的数据库表"中的表进行查询
2. 如果相关表不符合需求，可以使用"所有可用的数据库表"中的其他表
3. 请根据表的中文注释选择最合适的表
4. 返回的 SQL 不要包含分号`;

    } catch (error) {
      console.error('[SchemaEnhancer] Error enhancing prompt:', error);
      // 如果获取注释信息失败，返回基本提示
      return `注意：
1. 请告诉我你想查询的具体信息，我会帮你找到正确的表
2. 返回的 SQL 不要包含分号
3. 如果不确定表名，我会根据你的需求推荐合适的表`;
    }
  }
}
