import { DatabaseAdapter, DatabaseCapability } from "./types";
import { Connection } from "@/types/connection";

export class StarRocksAdapter implements DatabaseAdapter {
  private capabilities: DatabaseCapability = {
    functions: {
      "DATE": {
        name: "TO_DATE",
        alternatives: ["TO_DATE"],
        description: "Converts a value to a date"
      },
      "TIME": {
        name: "TIME_EXTRACT",
        alternatives: ["TIME_EXTRACT"],
        description: "Extracts time part from datetime"
      },
      "CURDATE": {
        name: "CURRENT_DATE",
        alternatives: ["CURRENT_DATE"],
        description: "Gets current date"
      }
    }
  };

  getCapabilities(): DatabaseCapability {
    return this.capabilities;
  }
}

export class StarRocksAdapterFactory {
  static createAdapter(connection: Connection): DatabaseAdapter | null {
    // 检查是否是StarRocks连接
    if (this.isStarRocksConnection(connection)) {
      return new StarRocksAdapter();
    }
    return null;
  }

  private static isStarRocksConnection(connection: Connection): boolean {
    const hints = [
      connection.version?.toLowerCase().includes('starrocks'),
      connection.host?.toLowerCase().includes('starrocks'),
      connection.database?.toLowerCase().includes('starrocks'),
      // 可以添加更多的检测逻辑
    ];

    return hints.some(hint => hint === true);
  }
}
