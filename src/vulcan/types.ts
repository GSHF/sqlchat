import { Connection } from "../types/connection";

export interface VulcanConfig {
  connection: Connection;
  enableSwagger?: boolean;
  prefix?: string;
}

export interface SQLEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  sql: string;
  params: SQLParam[];
}

export interface SQLParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  in: 'query' | 'body' | 'path';
}

export interface VulcanRouter {
  path: string;
  endpoints: SQLEndpoint[];
}
