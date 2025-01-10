import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NextPage } from 'next';
import { PublishedAPI } from '@/types/api';
import { useAPIStore } from '@/store';
import toast from '@/utils/toast';

const APIManagementPage: NextPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const apiStore = useAPIStore();
  const apis = apiStore.apis || [];
  const syncWithServer = apiStore.syncWithServer;
  const updateAPIStatus = apiStore.updateAPIStatus;
  const clearAllAPIs = apiStore.clearAllAPIs;
  const deleteAPI = apiStore.deleteAPI;

  // 获取热度前5的API
  const topAPIs = useMemo(() => 
    Array.isArray(apis) ? [...apis]
      .sort((a, b) => b.metrics.totalCalls - a.metrics.totalCalls)
      .slice(0, 5)
    : [],
    [apis]
  );

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        // 从服务器获取最新的API列表
        const response = await fetch('/api/api-management/sync-state');
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API Error response:', errorData);
          throw new Error(`Failed to load API list: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API Response data:', data);
        
        if (!data || !data.apis) {
          console.error('Invalid API response format:', data);
          throw new Error('Invalid API response format');
        }

        // 确保 apis 是数组
        const apiList = Array.isArray(data.apis) ? data.apis : [];
        console.log('Syncing APIs to store:', apiList);
        
        // 更新本地store
        syncWithServer(apiList);
      } catch (error) {
        console.error('Error initializing page:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        toast.error(`加载 API 列表失败: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [syncWithServer]);

  const handleStatusChange = async (id: string, newStatus: 'active' | 'inactive') => {
    try {
      setUpdatingStatus(id);
      console.log('Updating API status:', { id, newStatus });

      // 发送请求到服务器
      const response = await fetch('/api/api-management/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        console.error('API Error response:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to update API status');
      }

      const data = await response.json();
      console.log('Status update response:', data);

      if (!data.api) {
        throw new Error('No API data returned from server');
      }

      // 同步服务器返回的状态
      updateAPIStatus(data.api.id, data.api.status);
      
      toast.success('API 状态已更新');
    } catch (error: any) {
      console.error('Error updating API status:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`更新 API 状态失败: ${errorMessage}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleToggleAPIStatus = async (id: string) => {
    const api = apis.find(api => api.id === id);
    if (!api) return;
    const newStatus = api.status === 'active' ? 'inactive' : 'active';
    await handleStatusChange(id, newStatus);
  };

  const handleDeleteAPI = async (id: string) => {
    try {
      setDeletingId(id);
      
      // 发送请求到服务器
      const response = await fetch('/api/api-management/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || errorData.error || 'Failed to delete API');
      }

      // 删除本地状态
      deleteAPI(id);
      toast.success('API 已删除');
    } catch (error: any) {
      console.error('Error deleting API:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`删除 API 失败: ${errorMessage}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllAPIs = async () => {
    try {
      setLoading(true);
      
      // 先清除本地状态
      clearAllAPIs();
      
      // 发送请求到服务器
      const response = await fetch('/api/api-management/clear-all', {
        method: 'POST',
      });

      if (!response.ok) {
        // 如果服务器清除失败，重新同步状态
        const syncResponse = await fetch('/api/api-management/sync-state');
        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          if (syncData.apis) {
            syncWithServer(syncData.apis);
          }
        }
        
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || errorData.error || 'Failed to clear APIs');
      }

      toast.success('所有 API 已清除');
    } catch (error: any) {
      console.error('Error clearing APIs:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`清除 API 失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Top 5 APIs Section */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Top 5 APIs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topAPIs.map((api) => (
                <div
                  key={api.id}
                  className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{api.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      api.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400'
                    }`}>
                      {api.status === 'active' ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{api.description || '暂无描述'}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>调用次数: {api.metrics.totalCalls}</span>
                    <span>最后调用: {api.metrics.lastCalledAt ? formatDate(new Date(api.metrics.lastCalledAt)) : '从未调用'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All APIs Table */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">所有 APIs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      API 名称
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      状态
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      URL
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      调用次数
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      最后调用时间
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-6">
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {apis.map((api) => (
                    <tr key={api.id}>
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{api.name}</div>
                          <div className="text-gray-500 dark:text-gray-400">{api.description || '暂无描述'}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          api.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400'
                        }`}>
                          {api.status === 'active' ? '已启用' : '已禁用'}
                        </span>
                      </td>
                      <td className="whitespace-normal px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <a 
                          href={api.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all"
                        >
                          {api.url}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{api.metrics.totalCalls}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {api.metrics.lastCalledAt ? formatDate(new Date(api.metrics.lastCalledAt)) : '从未调用'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleToggleAPIStatus(api.id)}
                            className={`text-sm ${
                              api.status === 'active'
                                ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                                : 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300'
                            }`}
                          >
                            {api.status === 'active' ? '禁用' : '启用'}
                          </button>
                          <button
                            onClick={() => handleDeleteAPI(api.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIManagementPage;
