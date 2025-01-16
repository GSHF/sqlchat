import { ConnectionOptions } from "mysql2";
import mysql, { RowDataPacket } from "mysql2/promise";
import { Connection, ExecutionResult, Table, Schema } from "@/types";
import { Connector } from "..";

const systemDatabases = ["information_schema", "mysql", "performance_schema", "sys"];

const getMySQLConnection = async (connection: Connection): Promise<mysql.Connection> => {
  console.log("Creating MySQL connection for:", connection.host);
  const conn = await mysql.createConnection({
    host: connection.host,  // 优先使用环境变量中的主机名
    port: Number(connection.port),
    user: connection.username,
    password: connection.password,
    database: connection.database,
  });
  console.log("MySQL connection created successfully");
  return conn;
};

const testConnection = async (connection: Connection): Promise<boolean> => {
  let conn: mysql.Connection | null = null;
  try {
    conn = await getMySQLConnection(connection);
    await conn.query("SELECT 1");
    return true;
  } catch (error: any) {
    throw new Error(`Connection test failed: ${error.message}`);
  } finally {
    if (conn) {
      await conn.end().catch(() => {});
    }
  }
};

const getTableSchema = async (connection: Connection, databaseName: string): Promise<Schema[]> => {
  let conn: mysql.Connection | null = null;
  try {
    console.log("Getting table schema for database:", databaseName);
    conn = await getMySQLConnection({
      ...connection,
      database: databaseName // Ensure we connect with the correct database
    });
    
    // Get all tables
    console.log("Getting tables list...");
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_TYPE = 'BASE TABLE'`,
      [databaseName]
    );

    console.log("Raw table list:", rows);
    const tableList = rows.map(row => row.TABLE_NAME).filter(Boolean);
    console.log("Filtered table list:", tableList);
    
    if (tableList.length === 0) {
      console.log("No tables found in database");
      return [{ name: "", tables: [] }];
    }

    const SchemaList: Schema[] = [{ name: "", tables: [] }];

    // Get structure for each table
    for (const tableName of tableList) {
      try {
        console.log("Getting structure for table:", tableName);
        const [createTableResult] = await conn.query<RowDataPacket[]>(
          `SHOW CREATE TABLE \`${tableName}\``,
          []
        );

        if (createTableResult && createTableResult[0]) {
          const createTable = createTableResult[0]["Create Table"];
          if (createTable) {
            SchemaList[0].tables.push({
              name: tableName,
              structure: createTable
            });
            console.log("Successfully got structure for table:", tableName);
          } else {
            console.log("Empty create table statement for:", tableName);
          }
        } else {
          console.log("No create table result for:", tableName);
        }
      } catch (error: any) {
        console.error(`Error getting structure for table ${tableName}:`, error);
        // Don't add tables with errors to the list
        continue;
      }
    }

    console.log("Final schema list:", JSON.stringify(SchemaList, null, 2));
    return SchemaList;
  } catch (error: any) {
    console.error("Failed to get table schema:", error);
    throw error;
  } finally {
    if (conn) {
      console.log("Closing MySQL connection");
      await conn.end().catch((err) => {
        console.error("Error closing connection:", err);
      });
    }
  }
};

const execute = async (connection: Connection, databaseName: string, statement: string): Promise<ExecutionResult> => {
  let conn: mysql.Connection | null = null;
  try {
    conn = await getMySQLConnection(connection);
    
    // 确保使用正确的数据库
    await conn.query(`USE ??`, [databaseName]);
    
    const [rows] = await conn.query(statement);
    const executionResult: ExecutionResult = {
      rawResult: [],
      affectedRows: 0,
    };

    if (Array.isArray(rows)) {
      executionResult.rawResult = rows;
    } else if (rows && typeof rows === 'object') {
      executionResult.affectedRows = (rows as any).affectedRows || 0;
    }

    return executionResult;
  } catch (error: any) {
    return {
      error: error.message,
      rawResult: [],
      affectedRows: 0
    };
  } finally {
    if (conn) {
      await conn.end().catch(() => {});
    }
  }
};

const getDatabases = async (connection: Connection): Promise<string[]> => {
  let conn: mysql.Connection | null = null;
  try {
    console.log("Getting databases for connection:", connection.host);
    conn = await getMySQLConnection(connection);
    
    // First try to get all databases
    const [rows] = await conn.query<RowDataPacket[]>(
      "SHOW DATABASES"
    );
    
    const databases = rows.map(row => Object.values(row)[0] as string)
      .filter(dbName => !systemDatabases.includes(dbName));
    
    console.log("Found databases:", databases);
    return databases;
  } catch (error: any) {
    console.error("Failed to get databases:", error);
    throw new Error(`Failed to get databases: ${error.message}`);
  } finally {
    if (conn) {
      await conn.end().catch(() => {});
    }
  }
};

const newConnector = (connection: Connection): Connector => {
  return {
    testConnection: () => testConnection(connection),
    execute: (databaseName: string, statement: string) => execute(connection, databaseName, statement),
    getDatabases: () => getDatabases(connection),
    getTableSchema: (databaseName: string) => getTableSchema(connection, databaseName),
  };
};

export default newConnector;
