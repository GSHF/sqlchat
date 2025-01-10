import axios from "axios";
import { uniqBy } from "lodash-es";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Connection, Database, Engine, ResponseObject, Schema } from "@/types";
import { countTextTokens, generateUUID } from "@/utils";

interface ConnectionContext {
  connection: Connection;
  database?: Database;
  selectedDatabase?: string;  // 添加当前选择的数据库名
}

const sampleConnection: Connection = {
  id: "sample",
  title: "Sample Connection",
  engineType: Engine.MySQL,
  host: "",
  port: "",
  username: "",
  password: "",
  database: ""
};

interface ConnectionState {
  connectionList: Connection[];
  databaseList: Database[];
  currentConnectionCtx?: ConnectionContext;
  isRequestingDatabase: boolean;
  createConnection: (connection: Connection) => Connection;
  setCurrentConnectionCtx: (connectionCtx: ConnectionContext | undefined) => void;
  getOrFetchDatabaseList: (connection: Connection, skipCache?: boolean) => Promise<Database[]>;
  getOrFetchDatabaseSchema: (database: Database, skipCache?: boolean) => Promise<Schema[]>;
  getConnectionById: (connectionId: string) => Connection | undefined;
  updateConnection: (connectionId: string, connection: Partial<Connection>) => void;
  clearConnection: (filter: (connection: Connection) => boolean) => void;
  updateSelectedDatabase: (databaseName: string) => void;  // 添加新方法
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connectionList: [],
      databaseList: [],
      currentConnectionCtx: undefined,
      isRequestingDatabase: false,
      createConnection: (connection: Connection) => {
        const createdConnection = {
          ...connection,
          id: generateUUID(),
        };
        set((state) => ({
          ...state,
          connectionList: [...state.connectionList, createdConnection],
        }));
        return createdConnection;
      },
      setCurrentConnectionCtx: (connectionCtx: ConnectionContext | undefined) => {
        // 如果提供了新的上下文，确保selectedDatabase字段有值
        if (connectionCtx) {
          connectionCtx.selectedDatabase = connectionCtx.database?.name || connectionCtx.connection.database;
        }
        set((state) => ({
          ...state,
          currentConnectionCtx: connectionCtx,
        }));
      },
      getOrFetchDatabaseList: async (connection: Connection, skipCache = false) => {
        const state = get();
        set((state) => ({ ...state, isRequestingDatabase: true }));
        console.log('Fetching database list for connection:', connection);

        try {
          if (!skipCache) {
            const cachedDatabases = state.databaseList.filter(
              (database) => database.connectionId === connection.id
            );
            if (cachedDatabases.length > 0) {
              console.log('Using cached databases:', cachedDatabases);
              set((state) => ({ ...state, isRequestingDatabase: false }));
              return cachedDatabases;
            }
          }

          const { data } = await axios.post<string[]>("/api/connection/db", {
            connection,
          });
          console.log('Received databases from API:', data);

          const fetchedDatabaseList = data.map(
            (dbName) =>
              ({
                connectionId: connection.id,
                name: dbName,
                schemaList: [],
              } as Database)
          );

          // Remove old databases for this connection
          const otherDatabases = state.databaseList.filter(
            (database) => database.connectionId !== connection.id
          );

          const newDatabaseList = [...fetchedDatabaseList, ...otherDatabases];
          console.log('Setting new database list:', newDatabaseList);

          set((state) => ({
            ...state,
            databaseList: newDatabaseList,
            isRequestingDatabase: false,
          }));

          return fetchedDatabaseList;
        } catch (error) {
          console.error('Error fetching databases:', error);
          set((state) => ({ ...state, isRequestingDatabase: false }));
          throw error;
        }
      },
      getOrFetchDatabaseSchema: async (database: Database, skipCache = false) => {
        const state = get();
        console.log('Getting schema for database:', database.name);

        if (!skipCache) {
          const db = state.databaseList.find((db) => db.connectionId === database.connectionId && db.name === database.name);
          if (db?.schemaList && db.schemaList.length > 0) {
            console.log('Using cached schema:', db.schemaList);
            return db.schemaList;
          }
        }

        const connection = state.connectionList.find((connection) => connection.id === database.connectionId);
        if (!connection) {
          console.error('Connection not found for database:', database);
          return [];
        }

        try {
          console.log('Fetching schema from API for database:', database.name);
          const { data: result } = await axios.post<ResponseObject<Schema[]>>("/api/connection/db_schema", {
            connection: {
              ...connection,
              database: database.name // Make sure to pass the database name
            },
            db: database.name,
          });

          console.log('API response:', result);
          if (!result.data) {
            console.error('No schema data in API response');
            return [];
          }

          const fetchedTableList: Schema[] = result.data;
          console.log('Fetched table list:', fetchedTableList);

          // Update database list with schema
          const updatedDatabaseList = state.databaseList.map((db) => {
            if (db.connectionId === database.connectionId && db.name === database.name) {
              return {
                ...db,
                schemaList: fetchedTableList,
              };
            }
            return db;
          });

          console.log('Updating database list with schema');
          set((state) => ({
            ...state,
            databaseList: updatedDatabaseList,
          }));

          return fetchedTableList;
        } catch (error) {
          console.error('Error fetching schema:', error);
          return [];
        }
      },
      getConnectionById: (connectionId: string) => {
        return get().connectionList.find((connection) => connection.id === connectionId);
      },
      updateConnection: (connectionId: string, connection: Partial<Connection>) => {
        set((state) => ({
          ...state,
          connectionList: state.connectionList.map((item) => {
            if (item.id === connectionId) {
              const updatedConnection = { ...item, ...connection };
              // If this is the current connection, update currentConnectionCtx as well
              if (state.currentConnectionCtx?.connection.id === connectionId) {
                state.currentConnectionCtx.connection = updatedConnection;
              }
              return updatedConnection;
            }
            return item;
          }),
        }));
      },
      clearConnection: (filter: (connection: Connection) => boolean) => {
        set((state) => ({
          ...state,
          connectionList: state.connectionList.filter(filter),
        }));
      },
      updateSelectedDatabase: (databaseName: string) => {
        set((state) => {
          if (!state.currentConnectionCtx) {
            return state;
          }
          return {
            ...state,
            currentConnectionCtx: {
              ...state.currentConnectionCtx,
              selectedDatabase: databaseName,
            },
          };
        });
      },
    }),
    {
      name: "connection-storage",
      version: 1,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState as ConnectionState;
        if (version === 0) {
          console.info(`migrate from ${version} to 1`);
          // to clear old data. it will make refetch new schema List
          state.databaseList = [];
        }
        return state;
      },
    }
  )
);
