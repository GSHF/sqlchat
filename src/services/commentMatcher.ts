import { SchemaWithComments, MatchResult, TableWithComments } from '../types/schemaComments';

export class CommentMatcher {
  private static instance: CommentMatcher;
  private readonly RELEVANCE_THRESHOLD = 0.1; 
  private keywordMap: { [key: string]: string[] } = {};

  private constructor() {}

  static getInstance(): CommentMatcher {
    if (!this.instance) {
      this.instance = new CommentMatcher();
    }
    return this.instance;
  }

  private generateKeywords(table: TableWithComments): string[] {
    const keywords: string[] = [];
    
    keywords.push(table.name.toLowerCase());
    
    if (table.comment) {
      keywords.push(table.comment);
      
      if (table.comment.includes('表')) {
        keywords.push(table.comment.replace(/表.*$/, ''));
      }
    }
    
    return Array.from(new Set(keywords)); 
  }

  matchSchemaToQuestion(
    question: string,
    schemas: SchemaWithComments[]
  ): MatchResult[] {
    console.log('[CommentMatcher] Matching question:', question);
    console.log('[CommentMatcher] Available schemas:', JSON.stringify(schemas, null, 2));

    this.keywordMap = {};
    for (const schema of schemas) {
      for (const table of schema.tables) {
        this.keywordMap[table.name] = this.generateKeywords(table);
      }
    }
    console.log('[CommentMatcher] Generated keyword map:', this.keywordMap);

    const results: MatchResult[] = [];
    const normalizedQuestion = this.normalizeText(question);
    console.log('[CommentMatcher] Normalized question:', normalizedQuestion);

    const relevantTables = this.findRelevantTables(question, schemas);

    for (const table of relevantTables) {
      console.log(`[CommentMatcher] Processing table: ${table.name}`);
      
      const matchedColumns = table.columns
        .map(column => {
          const nameRelevance = this.calculateRelevance(
            normalizedQuestion,
            this.normalizeText(column.name)
          );
          const commentRelevance = this.calculateRelevance(
            normalizedQuestion,
            this.normalizeText(column.comment || '')
          );
          const relevance = Math.max(nameRelevance, commentRelevance);
          
          console.log(`[CommentMatcher] Column relevance scores for ${column.name}:`);
          console.log(`  Name relevance: ${nameRelevance}`);
          console.log(`  Comment relevance: ${commentRelevance}`);
          console.log(`  Final relevance: ${relevance}`);
          
          return {
            column,
            relevance
          };
        })
        .filter(({ relevance }) => relevance >= this.RELEVANCE_THRESHOLD)
        .sort((a, b) => b.relevance - a.relevance);

      console.log(`[CommentMatcher] Matched columns for ${table.name}:`, matchedColumns);

      results.push({
        table,
        tableRelevance: 1, 
        matchedColumns
      });
    }

    results.sort((a, b) => b.tableRelevance - a.tableRelevance);
    
    console.log('[CommentMatcher] Final match results:', JSON.stringify(results, null, 2));
    return results;
  }

  private normalizeText(text: string): string {
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '') 
      .trim();
    console.log(`[CommentMatcher] Normalizing text: "${text}" -> "${normalized}"`);
    return normalized;
  }

  private calculateRelevance(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set(Array.from(words1).concat(Array.from(words2)));
    
    return intersection.size / union.size;
  }

  private findRelevantTables(question: string, schemas: SchemaWithComments[]): TableWithComments[] {
    console.log('[CommentMatcher] Finding relevant tables for question:', question);
    
    const relevantTables: TableWithComments[] = [];
    const questionLower = question.toLowerCase();

    for (const [tableName, keywords] of Object.entries(this.keywordMap)) {
      if (keywords.some(keyword => questionLower.includes(keyword.toLowerCase()))) {
        console.log(`[CommentMatcher] Found keyword match for table: ${tableName}`);
        const schema = schemas.find(s => s.tables.some(t => t.name === tableName));
        if (schema) {
          const table = schema.tables.find(t => t.name === tableName);
          if (table) {
            relevantTables.push(table);
            console.log(`[CommentMatcher] Added table from keyword match: ${tableName}`);
          }
        }
      }
    }

    if (relevantTables.length === 0) {
      console.log('[CommentMatcher] No keyword matches found, calculating relevance...');
      
      for (const schema of schemas) {
        for (const table of schema.tables) {
          const relevance = this.calculateRelevance(question, table.comment || '');  
          console.log(`[CommentMatcher] Table ${table.name} relevance: ${relevance}`);
          
          if (relevance > 0.1) {  
            relevantTables.push(table);
            console.log(`[CommentMatcher] Added table from relevance: ${table.name}`);
          }
        }
      }
    }

    console.log('[CommentMatcher] Found relevant tables:', relevantTables.map(t => t.name));
    return relevantTables;
  }
}
