import { Connection } from '../types/connection';
import { SchemaCommentsService } from '../services/schemaComments';
import { CommentMatcher } from '../services/commentMatcher';
import { generateEnhancedPrompt } from '../utils/promptEnhancer';

export class SchemaEnhancer {
  private static instance: SchemaEnhancer;
  private schemaCommentsService: SchemaCommentsService;
  private commentMatcher: CommentMatcher;

  private constructor() {
    this.schemaCommentsService = SchemaCommentsService.getInstance();
    this.commentMatcher = CommentMatcher.getInstance();
  }

  static getInstance(): SchemaEnhancer {
    if (!this.instance) {
      this.instance = new SchemaEnhancer();
    }
    return this.instance;
  }

  async enhancePrompt(
    question: string,
    connection: Connection,
    database: string,
    basePrompt: string
  ): Promise<string> {
    console.log('[SchemaEnhancer] Enhancing prompt for question:', question);
    console.log('[SchemaEnhancer] Using database:', database);
    console.log('[SchemaEnhancer] Connection:', { ...connection, password: '***' });

    try {
      // 1. Get schema comments
      console.log('[SchemaEnhancer] Getting schema comments...');
      const schemasWithComments = await this.schemaCommentsService.getSchemaComments(
        connection,
        database
      );
      console.log('[SchemaEnhancer] Got schema comments:', JSON.stringify(schemasWithComments, null, 2));

      // 2. Match question with schema
      console.log('[SchemaEnhancer] Matching question with schema...');
      const matchResults = this.commentMatcher.matchSchemaToQuestion(
        question,
        schemasWithComments
      );
      console.log('[SchemaEnhancer] Match results:', JSON.stringify(matchResults, null, 2));

      // 3. Generate enhanced prompt
      console.log('[SchemaEnhancer] Generating enhanced prompt...');
      const enhancedPrompt = generateEnhancedPrompt(question, matchResults, basePrompt);
      console.log('[SchemaEnhancer] Enhanced prompt:', enhancedPrompt);

      return enhancedPrompt;
    } catch (error) {
      console.error('[SchemaEnhancer] Error enhancing prompt:', error);
      // Fallback to base prompt if enhancement fails
      return basePrompt;
    }
  }
}
