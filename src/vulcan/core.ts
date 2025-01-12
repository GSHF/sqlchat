import { NextApiRequest, NextApiResponse } from 'next';
import { VulcanConfig, SQLEndpoint, VulcanRouter } from './types';
import { Engine } from '../types/connection';
import { parseSQL } from './parser';
import { getConnectionInstance } from '../utils/connection';

export class Vulcan {
  private config: VulcanConfig;
  private routers: VulcanRouter[] = [];

  constructor(config: VulcanConfig) {
    this.config = {
      prefix: '/api',
      enableSwagger: true,
      ...config
    };
  }

  addSQL(sql: string) {
    const endpoint = parseSQL(sql);
    this.addEndpoint(endpoint);
    return endpoint;
  }

  private addEndpoint(endpoint: SQLEndpoint) {
    const existingRouter = this.routers.find(r => r.path === endpoint.path);
    if (existingRouter) {
      existingRouter.endpoints.push(endpoint);
    } else {
      this.routers.push({
        path: endpoint.path,
        endpoints: [endpoint]
      });
    }
  }

  async handleRequest(req: NextApiRequest, res: NextApiResponse) {
    const { method, query, body } = req;
    const path = req.url?.split('?')[0] || '';
    const startTime = Date.now();

    try {
      const router = this.findRouter(path);
      if (!router) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }

      const endpoint = router.endpoints.find(e => e.method === method);
      if (!endpoint) {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // 验证参数
      const params = this.validateParams(endpoint, query, body);
      if ('error' in params) {
        return res.status(400).json(params);
      }

      // 执行SQL
      const result = await this.executeSQL(endpoint, params);

      // 更新 API 调用指标
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 从 query 或 body 中获取 apiId
      const apiId = query.apiId || body.apiId;
      if (apiId) {
        const { getServerAPIStore } = require('../store/api');
        const apiStore = getServerAPIStore();
        const currentMetrics = apiStore.getState().apis.find(api => api.id === apiId)?.metrics || {
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
          averageResponseTime: 0,
        };

        apiStore.updateAPIMetrics(apiId, {
          totalCalls: (currentMetrics.totalCalls || 0) + 1,
          successCalls: (currentMetrics.successCalls || 0) + 1,
          averageResponseTime: Math.round(
            ((currentMetrics.averageResponseTime || 0) * (currentMetrics.totalCalls || 0) + responseTime) / 
            ((currentMetrics.totalCalls || 0) + 1)
          ),
          lastCalledAt: new Date(),
        });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Vulcan error:', error);

      // 更新失败调用计数
      const apiId = query.apiId || body.apiId;
      if (apiId) {
        const { getServerAPIStore } = require('../store/api');
        const apiStore = getServerAPIStore();
        const currentMetrics = apiStore.getState().apis.find(api => api.id === apiId)?.metrics || {
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
          averageResponseTime: 0,
        };

        apiStore.updateAPIMetrics(apiId, {
          totalCalls: (currentMetrics.totalCalls || 0) + 1,
          failedCalls: (currentMetrics.failedCalls || 0) + 1,
          lastCalledAt: new Date(),
        });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  private findRouter(path: string): VulcanRouter | undefined {
    return this.routers.find(r => path.startsWith(r.path));
  }

  private validateParams(endpoint: SQLEndpoint, query: any, body: any) {
    const params: Record<string, any> = {};
    
    for (const param of endpoint.params) {
      const value = param.in === 'query' ? query[param.name] : body[param.name];
      
      if (param.required && value === undefined) {
        return { error: `Missing required parameter: ${param.name}` };
      }

      if (value !== undefined) {
        params[param.name] = this.convertParamValue(value, param.type);
      }
    }

    return params;
  }

  private convertParamValue(value: string, type: string) {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      default:
        return value;
    }
  }

  private async executeSQL(endpoint: SQLEndpoint, params: Record<string, any>) {
    const instance = await getConnectionInstance(this.config.connection);
    if (!instance) {
      throw new Error('Failed to get database connection');
    }
    let sql = endpoint.sql;

    // Replace parameters
    Object.entries(params).forEach(([key, value]) => {
      sql = sql.replace(
        new RegExp(`${key}\\s*=\\s*[^\\s]+`),
        `${key} = ${typeof value === 'string' ? `'${value}'` : value}`
      );
    });

    if (this.config.connection.engineType === Engine.MySQL) {
      const [rows] = await (instance as any).query(sql);
      return rows;
    } else {
      const result = await (instance as any).query(sql);
      return result.rows;
    }
  }

  getSwaggerDocs() {
    if (!this.config.enableSwagger) return null;

    return {
      openapi: '3.0.0',
      info: {
        title: 'SQL API',
        version: '1.0.0'
      },
      paths: this.routers.reduce((paths, router) => {
        paths[router.path] = router.endpoints.reduce((methods, endpoint) => {
          methods[endpoint.method.toLowerCase()] = {
            summary: `Execute ${endpoint.method} on ${router.path}`,
            parameters: endpoint.params.map(param => ({
              name: param.name,
              in: param.in,
              required: param.required,
              schema: {
                type: param.type
              }
            })),
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object'
                      }
                    }
                  }
                }
              }
            }
          };
          return methods;
        }, {} as Record<string, any>);
        return paths;
      }, {} as Record<string, any>)
    };
  }
}
