export interface APIMetrics {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  maxConcurrentCalls: number;  // 最大并发量
  currentConcurrentCalls: number;  // 当前并发量
  lastCalledAt?: Date;
  clientInfo?: {
    name: string;
    lastCallTime: Date;
    callCount: number;
  }[];
}

export interface PublishedAPI {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  connectionId: string;
  tableName: string;
  sqlQuery: string;
  database?: string;
  description?: string;
  createdAt: Date;
  status: 'active' | 'inactive';
  metrics: APIMetrics;
}

export interface ResponseObject<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}
