import { Connection, Engine } from '../types/connection';
import { SchemaWithComments } from '../types/schemaComments';
import { Client as PGClient } from 'pg';
import { Connection as MySQLConnection } from 'mysql2/promise';

export class SchemaCommentsService {
  private static instance: SchemaCommentsService;
  private commentCache: Map<string, SchemaWithComments[]>;
  private cacheTimestamps: Map<string, number>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.commentCache = new Map();
    this.cacheTimestamps = new Map();
  }

  static getInstance(): SchemaCommentsService {
    if (!this.instance) {
      this.instance = new SchemaCommentsService();
    }
    return this.instance;
  }

  private getCacheKey(connection: Connection, database: string): string {
    return `${connection.host}:${connection.port}:${database}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  private getDockerSafeHost(host: string): string {
    // 检查是否在 Docker 环境中运行
    const isInDocker = process.env.DOCKER_CONTAINER === 'true';
    
    // 如果在 Docker 中运行，且连接地址是 localhost，则使用 host.docker.internal
    if (isInDocker && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
      return 'host.docker.internal';
    }
    
    return host;
  }

  async getSchemaComments(connection: Connection, database: string): Promise<SchemaWithComments[]> {
    console.log('[SchemaCommentsService] Getting comments for database:', database);
    console.log('[SchemaCommentsService] Connection details:', {
      host: connection.host,
      port: connection.port,
      user: connection.username,
      database: database,
      engineType: connection.engineType
    });

    try {
      const cacheKey = this.getCacheKey(connection, database);
      const cachedResult = this.commentCache.get(cacheKey);
      
      if (this.isCacheValid(cacheKey) && cachedResult) {
        console.log('[SchemaCommentsService] Returning cached schema comments');
        return cachedResult;
      }

      console.log('[SchemaCommentsService] Cache miss, fetching fresh schema comments');
      let result: SchemaWithComments[];
      
      if (connection.engineType === Engine.MySQL) {
        const mysql = await import('mysql2/promise');
        const mysqlConn = await mysql.createConnection({
          host: this.getDockerSafeHost(connection.host),
          port: parseInt(connection.port),
          user: connection.username,
          password: connection.password,
          database: database
        });
        try {
          result = await this.getMySQLComments(mysqlConn, database);
        } finally {
          await mysqlConn.end();
        }
      } else if (connection.engineType === Engine.PostgreSQL) {
        const pgClient = new PGClient({
          host: this.getDockerSafeHost(connection.host),
          port: parseInt(connection.port),
          user: connection.username,
          password: connection.password,
          database: database
        });
        await pgClient.connect();
        try {
          result = await this.getPostgreSQLComments(pgClient, database);
        } finally {
          await pgClient.end();
        }
      } else {
        throw new Error(`Unsupported engine type: ${connection.engineType}`);
      }

      console.log('[SchemaCommentsService] Schema comments result:', JSON.stringify(result, null, 2));
      
      this.commentCache.set(cacheKey, result);
      this.cacheTimestamps.set(cacheKey, Date.now());
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
      // 获取表注释
      const [tables] = await connection.execute<any[]>(`
        SELECT 
          TABLE_NAME,
          TABLE_COMMENT,
          TABLE_SCHEMA,
          TABLE_TYPE
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ?
          AND (TABLE_TYPE = 'BASE TABLE' OR TABLE_TYPE = 'VIEW')
        ORDER BY TABLE_NAME
      `, [database]);

      console.log('[SchemaCommentsService] Tables and views found:', tables.length);
      console.log('[SchemaCommentsService] Tables and views:', JSON.stringify(tables, null, 2));

      const result: SchemaWithComments[] = [];

      for (const table of tables) {
        console.log(`[SchemaCommentsService] Processing ${table.TABLE_TYPE === 'VIEW' ? 'view' : 'table'}: ${table.TABLE_NAME}`);
        // 获取列信息
        console.log(`[SchemaCommentsService] Executing column query for ${table.TABLE_NAME}...`);
        const [columns] = await connection.execute<any[]>(`
          SELECT 
            COLUMN_NAME,
            COLUMN_TYPE,
            COLUMN_COMMENT,
            IS_NULLABLE,
            COLUMN_KEY,
            COLUMN_DEFAULT,
            EXTRA
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [database, table.TABLE_NAME]);

        console.log(`[SchemaCommentsService] Columns found for ${table.TABLE_NAME}:`, columns.length);
        
        // 构建表/视图结构字符串
        let objectStructure = '';
        if (table.TABLE_TYPE === 'VIEW') {
          // 获取视图定义
          const [viewDef] = await connection.execute<any[]>(`
            SELECT VIEW_DEFINITION
            FROM information_schema.VIEWS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
          `, [database, table.TABLE_NAME]);

          if (viewDef && viewDef[0]) {
            objectStructure = `CREATE VIEW ${table.TABLE_NAME} AS\n${viewDef[0].VIEW_DEFINITION}`;
          } else {
            objectStructure = `CREATE VIEW ${table.TABLE_NAME} (\n  ${
              columns.map(col => `${col.COLUMN_NAME} ${col.COLUMN_TYPE}`).join(',\n  ')
            }\n)`;
          }
        } else {
          // 构建表结构
          const columnDefinitions = columns.map(col => {
            let def = `${col.COLUMN_NAME} ${col.COLUMN_TYPE}`;
            if (col.IS_NULLABLE === 'NO') def += ' NOT NULL';
            if (col.COLUMN_DEFAULT !== null) def += ` DEFAULT ${col.COLUMN_DEFAULT}`;
            if (col.EXTRA) def += ` ${col.EXTRA}`;
            if (col.COLUMN_COMMENT) def += ` COMMENT '${col.COLUMN_COMMENT}'`;
            return def;
          }).join(',\n  ');

          objectStructure = `CREATE TABLE ${table.TABLE_NAME} (\n  ${columnDefinitions}\n)`;
        }

        console.log(`[SchemaCommentsService] Generated structure for ${table.TABLE_NAME}:`, objectStructure);

        const schemaWithComments: SchemaWithComments = {
          name: database,
          tables: [{
            name: table.TABLE_NAME,
            comment: table.TABLE_COMMENT || '',
            structure: objectStructure,
            isView: table.TABLE_TYPE === 'VIEW',
            columns: columns.map(col => ({
              name: col.COLUMN_NAME,
              comment: col.COLUMN_COMMENT || '',
              dataType: col.COLUMN_TYPE,
              isNullable: col.IS_NULLABLE === 'YES',
              isPrimaryKey: col.COLUMN_KEY === 'PRI'
            }))
          }]
        };

        console.log(`[SchemaCommentsService] Generated schema for ${table.TABLE_NAME}:`, JSON.stringify(schemaWithComments, null, 2));
        result.push(schemaWithComments);
      }

      console.log('[SchemaCommentsService] All objects processed successfully');
      return result;
    } catch (error) {
      console.error('[SchemaCommentsService] Error executing MySQL comment queries:', error);
      throw error;
    }
  }

  private async getPostgreSQLComments(client: PGClient, database: string): Promise<SchemaWithComments[]> {
    console.log('[SchemaCommentsService] Getting PostgreSQL comments');
    
    try {
      const query = `
        SELECT 
          c.table_name,
          pg_catalog.obj_description(pgc.oid, 'pg_class') as table_comment,
          c.column_name,
          pg_catalog.col_description(pgc.oid, c.ordinal_position) as column_comment,
          c.data_type
        FROM 
          information_schema.columns c
          JOIN pg_catalog.pg_class pgc ON c.table_name = pgc.relname
        WHERE 
          c.table_schema = 'public'
      `;

      const { rows } = await client.query(query);

      console.log('[SchemaCommentsService] Rows found:', rows.length);
      console.log('[SchemaCommentsService] Rows:', JSON.stringify(rows, null, 2));

      // Group results by table
      const tableMap = new Map<string, any>();
      rows.forEach((row: any) => {
        if (!tableMap.has(row.table_name)) {
          tableMap.set(row.table_name, {
            name: row.table_name,
            comment: row.table_comment,
            columns: []
          });
        }
        tableMap.get(row.table_name).columns.push({
          name: row.column_name,
          comment: row.column_comment,
          dataType: row.data_type
        });
      });

      const schemaWithComments: SchemaWithComments[] = [{
        name: database,
        tables: Array.from(tableMap.values()).map(table => ({
          ...table,
          structure: `CREATE TABLE ${table.name} (\n${table.columns.map((col: any) => 
            `  ${col.name} ${col.dataType}${col.comment ? ` -- ${col.comment}` : ''}`
          ).join(',\n')}\n)`
        }))
      }];

      return schemaWithComments;
    } catch (error) {
      console.error('[SchemaCommentsService] Error executing PostgreSQL comment queries:', error);
      throw error;
    }
  }
}
