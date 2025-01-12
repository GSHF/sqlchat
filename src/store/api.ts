import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { PersistOptions } from 'zustand/middleware';
import type { StorageValue } from 'zustand/middleware';
import { PublishedAPI, APIMetrics } from '@/types/api';
import { generateUUID } from '@/utils';

interface APIState {
  apis: PublishedAPI[];
}

interface APIActions {
  addAPI: (api: Omit<PublishedAPI, 'id' | 'createdAt' | 'metrics' | 'status'>) => PublishedAPI;
  updateAPIStatus: (id: string, status: 'active' | 'inactive') => void;
  updateAPIMetrics: (id: string, metrics: Partial<APIMetrics>) => void;
  getAPIById: (id: string) => PublishedAPI | undefined;
  getAPIByUrl: (url: string) => PublishedAPI | undefined;
  deleteAPI: (id: string) => void;
  clearAllAPIs: () => void;
  syncWithServer: (serverApis: PublishedAPI[]) => void;
}

type APIStore = APIState & APIActions;

// 服务器端状态
let serverState: APIStore = {
  apis: [],
  addAPI: (api) => {
    const newApi: PublishedAPI = {
      ...api,
      id: generateUUID(),
      createdAt: new Date(),
      metrics: {
        successCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
        currentConcurrentCalls: 0,
        maxConcurrentCalls: 0,
        totalCalls: 0,
      },
      status: 'active',
    };
    serverState.apis = [...serverState.apis, newApi];
    // 保存状态到文件
    saveServerState();
    return newApi;
  },
  updateAPIStatus: (id, status) => {
    const apiIndex = serverState.apis.findIndex(api => api.id === id);
    if (apiIndex === -1) {
      throw new Error(`API not found with id: ${id}`);
    }
    
    // 创建新的 API 对象以避免引用问题
    const updatedApi = {
      ...serverState.apis[apiIndex],
      status
    };
    
    // 更新数组
    serverState.apis = [
      ...serverState.apis.slice(0, apiIndex),
      updatedApi,
      ...serverState.apis.slice(apiIndex + 1)
    ];
    
    // 保存状态到文件
    saveServerState();
    
    // 返回更新后的 API
    return updatedApi;
  },
  updateAPIMetrics: (id, metrics) => {
    const apiIndex = serverState.apis.findIndex(api => api.id === id);
    if (apiIndex === -1) {
      throw new Error(`API not found with id: ${id}`);
    }
    
    // 创建新的 metrics 对象
    const updatedMetrics = {
      ...serverState.apis[apiIndex].metrics,
      ...metrics,
      totalCalls: (serverState.apis[apiIndex].metrics.successCalls || 0) + 
                 (serverState.apis[apiIndex].metrics.failedCalls || 0),
      maxConcurrentCalls: Math.max(
        serverState.apis[apiIndex].metrics.maxConcurrentCalls || 0,
        metrics.currentConcurrentCalls || serverState.apis[apiIndex].metrics.currentConcurrentCalls || 0
      ),
    };
    
    // 创建新的 API 对象
    const updatedApi = {
      ...serverState.apis[apiIndex],
      metrics: updatedMetrics
    };
    
    // 更新数组
    serverState.apis = [
      ...serverState.apis.slice(0, apiIndex),
      updatedApi,
      ...serverState.apis.slice(apiIndex + 1)
    ];
    
    // 保存状态到文件
    saveServerState();
    
    // 返回更新后的 API
    return updatedApi;
  },
  getAPIById: (id) => serverState.apis.find(api => api.id === id),
  getAPIByUrl: (url) => {
    // 移除查询参数进行比较
    const normalizeUrl = (u: string) => u.split('?')[0];
    const normalizedUrl = normalizeUrl(url);
    return serverState.apis.find(api => normalizeUrl(api.url) === normalizedUrl);
  },
  deleteAPI: (id) => {
    const apiIndex = serverState.apis.findIndex(api => api.id === id);
    if (apiIndex === -1) {
      throw new Error(`API not found with id: ${id}`);
    }
    
    serverState.apis = [
      ...serverState.apis.slice(0, apiIndex),
      ...serverState.apis.slice(apiIndex + 1)
    ];
    
    // 保存状态到文件
    saveServerState();
  },
  clearAllAPIs: () => {
    serverState.apis = [];
    // 保存状态到文件
    saveServerState();
  },
  syncWithServer: (apis) => {
    serverState.apis = apis.map(api => ({...api}));
    // 保存状态到文件
    saveServerState();
  },
};

// 从文件加载服务器状态
const loadServerState = () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const statePath = path.join(process.cwd(), 'server-state.json');
    
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      const loadedState = JSON.parse(data);
      if (loadedState && Array.isArray(loadedState.apis)) {
        serverState.apis = loadedState.apis.map((api: PublishedAPI) => ({...api}));
        console.log('Loaded server state:', serverState.apis.length, 'APIs');
      }
    }
  } catch (err) {
    console.error('Error loading server state:', err);
  }
};

// 保存服务器状态到文件
const saveServerState = () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const statePath = path.join(process.cwd(), 'server-state.json');
    
    // 创建深拷贝以避免循环引用
    const stateToSave = {
      apis: serverState.apis.map((api: PublishedAPI) => ({
        ...api,
        metrics: {...api.metrics}
      }))
    };
    
    fs.writeFileSync(statePath, JSON.stringify(stateToSave, null, 2), 'utf8');
    console.log('Saved server state:', serverState.apis.length, 'APIs');
  } catch (err) {
    console.error('Error saving server state:', err);
  }
};

// 初始化时加载状态
if (typeof window === 'undefined') {
  loadServerState();
}

// 获取服务器端 store 实例
export const getServerAPIStore = () => {
  // 确保每次获取服务器状态时都重新加载
  if (typeof window === 'undefined') {
    loadServerState();
  }
  return {
    getState: () => serverState,
  };
};

// 创建 store
const createStore = () => {
  return create<APIStore>()(
    persist(
      (set, get) => ({
        apis: [],
        addAPI: (api) => {
          const newApi: PublishedAPI = {
            ...api,
            id: generateUUID(),
            createdAt: new Date(),
            metrics: {
              successCalls: 0,
              failedCalls: 0,
              averageResponseTime: 0,
              currentConcurrentCalls: 0,
              maxConcurrentCalls: 0,
              totalCalls: 0,
            },
            status: 'active',
          };
          set((state) => ({
            apis: [...state.apis, newApi],
          }));
          return newApi;
        },
        updateAPIStatus: (id, status) => {
          set((state) => {
            const apiIndex = state.apis.findIndex(api => api.id === id);
            if (apiIndex === -1) {
              console.error(`API not found with id: ${id}`);
              return state;
            }
            
            // 创建新的 API 对象以避免引用问题
            const updatedApi = {
              ...state.apis[apiIndex],
              status
            };
            
            // 更新数组
            return {
              apis: [
                ...state.apis.slice(0, apiIndex),
                updatedApi,
                ...state.apis.slice(apiIndex + 1)
              ]
            };
          });
        },
        updateAPIMetrics: (id, metrics) => {
          set((state) => {
            const apiIndex = state.apis.findIndex(api => api.id === id);
            if (apiIndex === -1) {
              console.error(`API not found with id: ${id}`);
              return state;
            }
            
            // 创建新的 metrics 对象
            const updatedMetrics = {
              ...state.apis[apiIndex].metrics,
              ...metrics,
              totalCalls: (state.apis[apiIndex].metrics.successCalls || 0) + 
                       (state.apis[apiIndex].metrics.failedCalls || 0),
              maxConcurrentCalls: Math.max(
                state.apis[apiIndex].metrics.maxConcurrentCalls || 0,
                metrics.currentConcurrentCalls || state.apis[apiIndex].metrics.currentConcurrentCalls || 0
              ),
            };
            
            // 创建新的 API 对象
            const updatedApi = {
              ...state.apis[apiIndex],
              metrics: updatedMetrics
            };
            
            // 更新数组
            return {
              apis: [
                ...state.apis.slice(0, apiIndex),
                updatedApi,
                ...state.apis.slice(apiIndex + 1)
              ]
            };
          });
        },
        getAPIById: (id) => {
          const state = get();
          return state.apis.find(api => api.id === id);
        },
        getAPIByUrl: (url) => {
          const state = get();
          // 移除查询参数进行比较
          const normalizeUrl = (u: string) => u.split('?')[0];
          const normalizedUrl = normalizeUrl(url);
          return state.apis.find(api => normalizeUrl(api.url) === normalizedUrl);
        },
        deleteAPI: (id) => {
          set((state) => ({
            apis: state.apis.filter(api => api.id !== id)
          }));
        },
        clearAllAPIs: () => {
          set({ apis: [] });
        },
        syncWithServer: (serverApis) => {
          set({ apis: serverApis.map(api => ({...api})) });
        },
      }),
      {
        name: 'api-storage',
        storage: createJSONStorage(() => localStorage),
      }
    )
  );
};

// 创建单个store实例
const store = createStore();

// 获取 store 实例
export const useAPIStore = store;

// 导出服务器状态，用于 SSR
export const getServerState = () => serverState;
