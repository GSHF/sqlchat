import { encode } from "@nem035/gpt-3-encoder";
import { Engine, Schema, Table } from "@/types";

// openAIApiKey is the API key for OpenAI API.
export const openAIApiKey = process.env.OPENAI_API_KEY;

// openAIApiEndpoint is the API endpoint for OpenAI API. Defaults to https://api.openai.com.
export const openAIApiEndpoint = process.env.OPENAI_API_ENDPOINT || "https://api.openai.com";

// openAIOrganization a header to specify which organization is used for an API request.
export const openAIOrganization = process.env.OPENAI_ORGANIZATION;

export const countTextTokens = (text: string) => {
  return encode(text).length;
};

export function generateDbPromptFromContext(
  promptGenerator: (engine: Engine | undefined, schema: string | undefined) => string,
  engine: Engine,
  schemaList: Schema[],
  selectedSchemaName: string,
  selectedTableNameList: string[],
  maxToken: number,
  userPrompt?: string
): string {
  // userPrompt is the message that user want to send to bot. When to look prompt in drawer, userPrompt is undefined.
  let tokens = countTextTokens(userPrompt || "");

  const tableList: string[] = [];
  const selectedSchema = schemaList.find((schema: Schema) => schema.name == (selectedSchemaName || ""));
  
  if (selectedTableNameList) {
    selectedTableNameList.forEach((tableName: string) => {
      const table = selectedSchema?.tables.find((table: Table) => table.name == tableName);
      if (table) {
        let tableStructure = table.structure;
        
        // 添加表注释
        if ((table as any).comment) {
          tableStructure = `/*
  Table: ${table.name}
  Description: ${(table as any).comment}
*/\n${tableStructure}`;
        }

        // 添加列注释
        if ((table as any).columns) {
          const columnComments = (table as any).columns
            .filter((col: any) => col.comment)
            .map((col: any) => `  - ${col.name}: ${col.comment}`)
            .join('\n');
          if (columnComments) {
            tableStructure = `${tableStructure}\n\n/*
  Column Descriptions:
${columnComments}
*/`;
          }
        }

        tableList.push(tableStructure);
      }
    });
  } else {
    for (const table of selectedSchema?.tables || []) {
      let tableStructure = table.structure;
      
      // 添加表注释
      if ((table as any).comment) {
        tableStructure = `/*
  Table: ${table.name}
  Description: ${(table as any).comment}
*/\n${tableStructure}`;
      }

      // 添加列注释
      if ((table as any).columns) {
        const columnComments = (table as any).columns
          .filter((col: any) => col.comment)
          .map((col: any) => `  - ${col.name}: ${col.comment}`)
          .join('\n');
        if (columnComments) {
          tableStructure = `${tableStructure}\n\n/*
  Column Descriptions:
${columnComments}
*/`;
        }
      }

      tableList.push(tableStructure);
    }
  }

  let finalTableList = [];
  if (tableList) {
    for (const table of tableList) {
      if (tokens < maxToken / 2) {
        tokens += countTextTokens(table + "\n\n");
        finalTableList.push(table);
      }
    }
  }
  return promptGenerator(engine, finalTableList.join("\n\n"));
}

export function allowSelfOpenAIKey() {
  return process.env.NEXT_PUBLIC_ALLOW_SELF_OPENAI_KEY == "true";
}
