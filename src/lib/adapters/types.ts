import { Connection } from "@/types/connection";

export interface DatabaseCapability {
  functions: {
    [key: string]: {
      name: string;
      alternatives: string[];
      description: string;
    };
  };
}

export interface DatabaseAdapter {
  getCapabilities(): DatabaseCapability;
  transformSQL?(sql: string): string;
}

export interface DatabaseAdapterFactory {
  createAdapter(connection: Connection): DatabaseAdapter | null;
}
