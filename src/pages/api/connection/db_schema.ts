import { NextApiRequest, NextApiResponse } from "next";
import { newConnector } from "@/lib/connectors";
import { Connection, Schema } from "@/types";
import { changeTiDBConnectionToMySQL } from "@/utils";
import { Engine } from "@/types/connection";
import { mergeSchemaWithComments } from "@/utils/schemaMerger";

// POST /api/connection/db_schema
// req body: { connection: Connection, db: string }
// It's mainly used to get the database list.
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      message: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    });
  }

  if (!req.body.connection || !req.body.db) {
    return res.status(400).json({
      message: "Missing required parameters: connection or db",
      code: "INVALID_PARAMETERS"
    });
  }

  let connection = req.body.connection as Connection;
  const db = req.body.db as string;

  try {
    // Convert TiDB connection to MySQL if needed
    if (connection.engineType === Engine.TiDB) {
      connection = changeTiDBConnectionToMySQL(connection);
    }

    // Validate connection parameters
    if (!connection.host || !connection.port || !connection.username) {
      return res.status(400).json({
        message: "Invalid connection parameters: missing host, port, or username",
        code: "INVALID_CONNECTION"
      });
    }

    console.log('Creating connector for database:', db);
    const connector = newConnector(connection);
    
    // First test the connection
    try {
      await connector.testConnection();
    } catch (error: any) {
      console.error('Connection test failed:', error);
      return res.status(400).json({
        message: "Failed to connect to database: " + (error.message || "Unknown error"),
        code: error.code || "CONNECTION_ERROR"
      });
    }

    console.log('Fetching schema for database:', db);
    const schemaList = await connector.getTableSchema(db);
    
    // 合并schema和注释信息
    console.log('Merging schema with comments');
    const enhancedSchema = await mergeSchemaWithComments(schemaList, connection, db);
    console.log('Schema merged successfully');

    return res.status(200).json({
      code: "SUCCESS",
      message: "Schema fetched successfully",
      data: enhancedSchema
    });
  } catch (error: any) {
    console.error('Error fetching schema:', error);
    return res.status(500).json({
      message: "Failed to fetch schema: " + (error.message || "Unknown error"),
      code: error.code || "SCHEMA_ERROR"
    });
  }
};

export default handler;
