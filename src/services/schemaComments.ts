import { Connection } from '../types/connection';
import { SchemaWithComments } from '../types/schema';
import { createConnection, Connection as MySQLConnection, RowDataPacket } from 'mysql2/promise';

interface TableInfo extends RowDataPacket {
  TABLE_NAME: string;
  TABLE_COMMENT: string;
  TABLE_SCHEMA: string;
  TABLE_TYPE: string;
}

interface ColumnInfo extends RowDataPacket {
  COLUMN_NAME: string;
  COLUMN_COMMENT: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_KEY: string;
}

export class SchemaCommentsService {
  private commentCache: Map<string, SchemaWithComments[]>;
  private cacheDuration: number;

  constructor() {
    this.commentCache = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  private getCacheKey(connection: Connection, database: string): string {
    return `${connection.host}:${connection.port}:${database}`;
  }

  private isCacheValid(key: string): boolean {
    const cached = this.commentCache.get(key);
    return cached !== undefined;
  }

  private getDockerSafeHost(host: string): string {
    if (process.env.DOCKER_CONTAINER === 'true' && host === 'localhost') {
      return 'host.docker.internal';
    }
    return host;
  }

  async getSchemaComments(connection: Connection, database: string): Promise<SchemaWithComments[]> {
    console.log('[SchemaCommentsService] Getting comments for database:', database);
    
    // 确保有数据库名称
    const dbName = connection.database || database;
    if (!dbName) {
      throw new Error('Database name is required');
    }

    console.log('[SchemaCommentsService] Connection details:', {
      host: connection.host,
      port: connection.port,
      user: connection.username,
      database: dbName,
      engineType: connection.engineType
    });

    try {
      const cacheKey = this.getCacheKey(connection, dbName);
      const cachedResult = this.commentCache.get(cacheKey);
      
      if (this.isCacheValid(cacheKey) && cachedResult) {
        console.log('[SchemaCommentsService] Returning cached schema comments');
        return cachedResult;
      }

      console.log('[SchemaCommentsService] Cache miss, fetching fresh schema comments');
      let result: SchemaWithComments[];
      
      if (connection.engineType === 'MYSQL') {
        const mysqlConn = await createConnection({
          host: this.getDockerSafeHost(connection.host),
          port: parseInt(connection.port),
          user: connection.username,
          password: connection.password,
          database: dbName
        });

        try {
          result = await this.getMySQLComments(mysqlConn, dbName);
        } finally {
          await mysqlConn.end();
        }
      } else if (connection.engineType === 'POSTGRESQL') {
        throw new Error('PostgreSQL support is temporarily disabled in Edge Runtime');
      } else {
        throw new Error(`Unsupported database type: ${connection.engineType}`);
      }

      // 缓存结果
      this.commentCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[SchemaCommentsService] Error getting schema comments:', error);
      throw error;
    }
  }

  private async getMySQLComments(connection: MySQLConnection, database: string): Promise<SchemaWithComments[]> {
    console.log('[SchemaCommentsService] Getting MySQL comments');
    console.log('[SchemaCommentsService] Database:', database);

    try {
      // 使用简单查询而不是预处理语句
      const [tablesResult] = await connection.query<TableInfo[]>(`
        SELECT 
          TABLE_NAME,
          TABLE_COMMENT,
          TABLE_SCHEMA,
          TABLE_TYPE
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${database}'
        AND (TABLE_TYPE = 'BASE TABLE' OR TABLE_TYPE = 'VIEW')
        ORDER BY TABLE_NAME
      `);

      const result: SchemaWithComments[] = [];

      for (const table of tablesResult) {
        const [columnsResult] = await connection.query<ColumnInfo[]>(`
          SELECT 
            COLUMN_NAME,
            COLUMN_COMMENT,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_KEY
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = '${database}'
          AND TABLE_NAME = '${table.TABLE_NAME}'
          ORDER BY ORDINAL_POSITION
        `);

        const schema: SchemaWithComments = {
          name: table.TABLE_NAME,
          comment: table.TABLE_COMMENT || '',
          type: table.TABLE_TYPE,
          columns: columnsResult.map(col => ({
            name: col.COLUMN_NAME,
            comment: col.COLUMN_COMMENT || '',
            type: col.DATA_TYPE,
            nullable: col.IS_NULLABLE === 'YES',
            key: col.COLUMN_KEY
          }))
        };

        result.push(schema);
      }

      return result;
    } catch (error) {
      console.error('[SchemaCommentsService] Error executing MySQL comment queries:', error);
      throw error;
    }
  }
}
