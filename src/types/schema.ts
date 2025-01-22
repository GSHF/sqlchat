export interface ColumnWithComments {
  name: string;
  comment: string;
  type: string;
  nullable: boolean;
  key: string;
}

export interface SchemaWithComments {
  name: string;
  comment: string;
  type: string;
  columns: ColumnWithComments[];
}
