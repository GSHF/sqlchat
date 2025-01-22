import { Schema, Table } from '@/types';
import { SchemaWithComments, TableWithComments } from '@/types/schemaComments';
import { SchemaCommentsService } from '@/services/schemaComments';
import { Connection } from '@/types/connection';

export async function mergeSchemaWithComments(
  schema: Schema[],
  connection: Connection,
  database: string
): Promise<Schema[]> {
  try {
    // 获取schema注释
    const schemaCommentsService = SchemaCommentsService.getInstance();
    const schemasWithComments = await schemaCommentsService.getSchemaComments(
      connection,
      database
    );

    // 如果没有注释信息，直接返回原始schema
    if (!schemasWithComments || schemasWithComments.length === 0) {
      return schema;
    }

    // 合并schema和注释信息
    return schema.map(originalSchema => {
      const schemaWithComments = schemasWithComments.find(
        s => s.name === originalSchema.name
      );

      if (!schemaWithComments) {
        return originalSchema;
      }

      return {
        ...originalSchema,
        tables: originalSchema.tables.map(table => {
          const tableWithComments = schemaWithComments.tables.find(
            t => t.name === table.name
          );

          if (!tableWithComments) {
            return table;
          }

          return {
            ...table,
            comment: tableWithComments.comment,
            columns: tableWithComments.columns
          } as TableWithComments;
        })
      };
    });
  } catch (error) {
    console.error('Error merging schema with comments:', error);
    // 如果合并失败，返回原始schema
    return schema;
  }
}
