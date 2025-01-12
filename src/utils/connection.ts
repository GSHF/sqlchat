import { Connection, Engine } from '../types/connection';
import type { Connection as MySQLConnection } from 'mysql2/promise';
import { Client as PGClient } from 'pg';

type DatabaseConnection = MySQLConnection | PGClient;

let connectionInstance: DatabaseConnection | null = null;

export const getConnectionInstance = async (connection: Connection): Promise<DatabaseConnection | null> => {
  // Clear existing connection if connection info changes
  if (connectionInstance) {
    await clearConnectionInstance();
  }

  try {
    // Validate database field
    if (!connection.database) {
      throw new Error('Database name is required');
    }

    switch (connection.engineType) {
      case Engine.MySQL:
        const mysql = await import('mysql2/promise');
        connectionInstance = await mysql.createConnection({
          host: connection.host,
          port: parseInt(connection.port),
          user: connection.username,
          password: connection.password,
          database: connection.database,
          multipleStatements: false // 
        });
        // 
        await connectionInstance.query(`USE \`${connection.database}\``);
        break;
      
      case Engine.PostgreSQL:
        const pgClient = new PGClient({
          host: connection.host,
          port: parseInt(connection.port),
          user: connection.username,
          password: connection.password,
          database: connection.database
        });
        await pgClient.connect();
        connectionInstance = pgClient;
        break;
        
      default:
        throw new Error(`Unsupported database engine: ${connection.engineType}`);
    }
  } catch (error) {
    console.error('Failed to create database connection:', error);
    return null;
  }
  return connectionInstance;
};

export const setConnectionInstance = (connection: DatabaseConnection) => {
  connectionInstance = connection;
};

export const clearConnectionInstance = async () => {
  if (connectionInstance) {
    try {
      if (connectionInstance instanceof PGClient) {
        await connectionInstance.end();
      } else {
        await connectionInstance.end();
      }
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }
  connectionInstance = null;
};
