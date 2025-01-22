import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAPIStore } from '@/store/api';

export function middleware(request: NextRequest) {
  try {
    // 从URL中提取表名和查询参数
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tableName = pathParts[pathParts.length - 1];
    const connectionInfo = url.searchParams.get('connectionInfo');
    const query = url.searchParams.get('query');

    if (!connectionInfo || !query) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取API store
    const store = getServerAPIStore();
    const state = store.getState();
    console.log('Current server state:', state);

    if (!state || !Array.isArray(state.apis)) {
      console.error('Invalid server state:', state);
      return new NextResponse(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查是否有匹配的API
    const matchingApi = state.apis.find(api => 
      api.tableName === tableName && 
      api.sqlQuery === decodeURIComponent(query)
    );

    if (!matchingApi) {
      console.log('No matching API found for:', { tableName, query });
      return new NextResponse(
        JSON.stringify({ error: 'API not found or unauthorized' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查API状态
    if (matchingApi.status === 'inactive') {
      console.log(`API ${matchingApi.id} is inactive`);
      return new NextResponse(
        JSON.stringify({ error: 'API is currently inactive' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 更新API指标
    try {
      state.updateAPIMetrics(matchingApi.id, {
        totalCalls: (matchingApi.metrics.totalCalls || 0) + 1,
        currentConcurrentCalls: (matchingApi.metrics.currentConcurrentCalls || 0) + 1,
      });
      console.log(`Updated metrics for API ${matchingApi.id}`);
    } catch (error) {
      console.error('Error updating API metrics:', error);
      // 继续处理请求，即使指标更新失败
    }

    // 继续处理请求
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
