import { Schema, Table } from './database';

export interface TableComment {
  name: string;
  comment: string;
}

export interface ColumnComment {
  name: string;
  comment: string;
  dataType: string;
}

export interface TableWithComments {
  name: string;
  comment?: string;
  structure: string;
  columns: ColumnComment[];
  isView?: boolean;  // 标识是否为视图
}

export interface SchemaWithComments {
  name: string;
  tables: TableWithComments[];
}

export interface MatchResult {
  table: TableWithComments;
  tableRelevance: number;
  matchedColumns: Array<{
    column: ColumnComment;
    relevance: number;
  }>;
}
