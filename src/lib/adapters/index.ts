import { Connection } from "@/types/connection";
import { DatabaseAdapter, DatabaseAdapterFactory } from "./types";
import { StarRocksAdapterFactory } from "./starRocks";

class DatabaseAdapterManager {
  private static instance: DatabaseAdapterManager;
  private adapterFactories: DatabaseAdapterFactory[] = [];

  private constructor() {
    // 注册适配器工厂
    this.registerAdapterFactory(StarRocksAdapterFactory);
  }

  static getInstance(): DatabaseAdapterManager {
    if (!DatabaseAdapterManager.instance) {
      DatabaseAdapterManager.instance = new DatabaseAdapterManager();
    }
    return DatabaseAdapterManager.instance;
  }

  registerAdapterFactory(factory: any) {
    this.adapterFactories.push(factory);
  }

  getAdapter(connection: Connection): DatabaseAdapter | null {
    for (const factory of this.adapterFactories) {
      const adapter = factory.createAdapter(connection);
      if (adapter) {
        return adapter;
      }
    }
    return null;
  }
}

export const databaseAdapterManager = DatabaseAdapterManager.getInstance();
