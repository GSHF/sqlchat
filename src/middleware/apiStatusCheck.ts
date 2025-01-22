import { NextApiRequest, NextApiResponse } from "next";
import { getServerAPIStore } from "@/store/api";

type NextApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export function withAPIStatusCheck(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // 跳过 API 管理相关的请求
    if (req.url?.startsWith('/api/api-management')) {
      return handler(req, res);
    }

    const store = getServerAPIStore();
    const state = store.getState();
    if (!state || !Array.isArray(state.apis) || state.apis.length === 0) {
      console.error('No APIs configured or store state is invalid:', state);
      return res.status(404).json({ error: 'No APIs available' });
    }

    // 获取请求的路径信息
    const requestPath = req.url?.split('?')[0] || '';
    console.log('Request URL:', req.url);
    console.log('Request path (without query):', requestPath);
    console.log('Available APIs:', state.apis.map(api => ({
      id: api.id,
      url: api.url,
      status: api.status
    })));

    // 移除末尾的分号和斜杠（如果存在）
    const normalizePathForMatch = (path: string) => {
      let normalized = path;
      normalized = normalized.endsWith(';') ? normalized.slice(0, -1) : normalized;
      normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
      normalized = normalized.startsWith('/') ? normalized : '/' + normalized;
      return normalized.toLowerCase();
    };

    const normalizedRequestPath = normalizePathForMatch(requestPath);

    // 优先使用 URL 中的 API ID
    const apiId = req.query.apiId as string;
    console.log('Looking for API with ID:', apiId);
    let matchingApi = undefined;

    if (apiId) {
      // 如果指定了 API ID，只查找该 ID 的 API
      matchingApi = state.apis.find(api => api.id === apiId);
      if (!matchingApi) {
        return res.status(404).json({ error: `API with ID ${apiId} not found` });
      }
      if (matchingApi.status === 'inactive') {
        return res.status(403).json({ error: `API ${apiId} is currently inactive` });
      }
    } else {
      // 如果没有指定 API ID，通过 URL 匹配
      // 找到所有匹配 URL 的 API
      const matchingApis = state.apis.filter(api => {
        const apiUrlPath = api.url.split('?')[0];
        const normalizedApiPath = normalizePathForMatch(apiUrlPath);
        const matches = normalizedApiPath === normalizedRequestPath;
        console.log('Comparing paths:', { 
          apiPath: normalizedApiPath, 
          requestPath: normalizedRequestPath,
          originalApiUrl: api.url,
          matches,
          status: api.status
        });
        return matches;
      });

      if (matchingApis.length === 0) {
        return res.status(404).json({ error: 'No matching API found for this URL' });
      }

      // 检查是否有任何匹配的 API 处于活动状态
      const activeApi = matchingApis.find(api => api.status === 'active');
      if (!activeApi) {
        return res.status(403).json({ 
          error: 'All matching APIs for this URL are currently inactive' 
        });
      }

      matchingApi = activeApi;
    }

    console.log(`Found matching API: ${matchingApi.id} (${matchingApi.status})`);
    const startTime = Date.now();

    try {
      // 更新并发数
      await state.updateAPIMetrics(matchingApi.id, {
        currentConcurrentCalls: (matchingApi.metrics.currentConcurrentCalls || 0) + 1,
      });

      // 执行原始处理程序
      await handler(req, res);

      // 更新 API 指标
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      try {
        await state.updateAPIMetrics(matchingApi.id, {
          successCalls: (matchingApi.metrics.successCalls || 0) + 1,
          averageResponseTime: Math.round(
            ((matchingApi.metrics.averageResponseTime || 0) * (matchingApi.metrics.successCalls || 0) + responseTime) /
            ((matchingApi.metrics.successCalls || 0) + 1)
          ),
          currentConcurrentCalls: Math.max(0, (matchingApi.metrics.currentConcurrentCalls || 0) - 1),
        });
        console.log(`Updated metrics for API ${matchingApi.id}`);
      } catch (error) {
        console.error('Error updating API metrics:', error);
      }
    } catch (error) {
      // 更新失败调用次数
      try {
        await state.updateAPIMetrics(matchingApi.id, {
          failedCalls: (matchingApi.metrics.failedCalls || 0) + 1,
          currentConcurrentCalls: Math.max(0, (matchingApi.metrics.currentConcurrentCalls || 0) - 1),
        });
      } catch (metricsError) {
        console.error('Error updating failure metrics:', metricsError);
      }
      throw error;
    }
  };
}
