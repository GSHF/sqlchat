import { MatchResult } from '../types/schemaComments';

/**
 * 生成增强的提示
 * @param question 用户问题
 * @param matchResults 匹配结果
 * @param basePrompt 基础提示
 * @returns 增强后的提示
 */
export function generateEnhancedPrompt(
  question: string,
  matchResults: MatchResult[],
  basePrompt: string
): string {
  console.log('[PromptEnhancer] Generating enhanced prompt');
  console.log('  Question:', question);
  console.log('  Match results:', JSON.stringify(matchResults, null, 2));
  console.log('  Base prompt:', basePrompt);

  if (!matchResults || matchResults.length === 0) {
    console.log('[PromptEnhancer] No match results, returning base prompt');
    return basePrompt;
  }

  // 生成数据库结构上下文
  const schemaContext = matchResults
    .map(result => {
      const relevanceInfo = `相关度：${result.tableRelevance.toFixed(2)}`;
      const tableInfo = `表名：${result.table.name}\n警告：这是数据库中的实际表名，必须完全按此使用，不允许任何修改。\n例如：\n- 错误：把 'voltagelevel' 改写成 'voltage_level'\n- 错误：把 'voltagelevel' 改写成 'voltageLevel'\n- 正确：使用 'voltagelevel'\n\n描述：${result.table.comment || '无'}\n${relevanceInfo}\n结构：\n${result.table.structure}\n`;
      
      const columnInfo = result.matchedColumns.length > 0
        ? `相关字段：\n${result.matchedColumns
            .map(col => 
              `  - ${col.column.name} (${col.column.dataType})\n    描述：${col.column.comment || '无'}\n    相关度：${col.relevance.toFixed(2)}`
            )
            .join('\n')}`
        : '未找到特别相关的字段，将返回所有字段';
      
      console.log('[PromptEnhancer] Generated table info:', tableInfo);
      console.log('[PromptEnhancer] Generated column info:', columnInfo);
      
      return `${tableInfo}${columnInfo}`;
    })
    .join('\n\n');

  // 构建增强的提示
  const enhancedPrompt = `${basePrompt}

重要提示 - 表名使用规则：
1. 必须完全按照数据库中的实际表名使用，不允许任何修改
2. 常见错误示例：
   - 错误：把 'voltagelevel' 改写成 'voltage_level'
   - 错误：把 'voltagelevel' 改写成 'voltageLevel'
   - 错误：把 'voltagelevel' 改写成 'voltage'
3. 正确示例：
   - 正确：使用 'voltagelevel'
4. 即使表名看起来不符合命名规范，也必须按数据库中的实际名称使用

用户问题：${question}

找到的相关表结构信息：
${schemaContext}

请根据以上信息生成SQL查询。要求：
1. 必须使用完整的表名，绝对不要修改表名格式
2. 优先使用相关度高的表和字段
3. 如果没有找到特别相关的字段，则返回所有字段(SELECT *)
4. 确保生成的SQL语法正确且可执行
5. 如果表名或字段名与预期不同，必须以实际数据库中的名称为准
6. 返回格式：
   \`\`\`sql
   你的SQL语句
   \`\`\`
   解释：简要说明SQL的功能
   预期结果：描述查询会返回什么数据
`;

  console.log('[PromptEnhancer] Final enhanced prompt:', enhancedPrompt);
  return enhancedPrompt;
}
