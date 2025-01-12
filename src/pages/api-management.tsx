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
    <div className="min-h-screen w-full bg-gray-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-zinc-900">
        <div className="space-y-8">
          {/* Top 5 APIs Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">热门 APIs</h2>
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

          {/* All APIs Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">所有 APIs</h2>
            </div>
            <div className="p-6 space-y-4">
              {apis.map((api) => (
                <div
                  key={api.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
                        {api.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        api.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400'
                      }`}>
                        {api.status === 'active' ? '已启用' : '已禁用'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {api.description || '暂无描述'}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 break-all">
                      <a
                        href={api.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {api.url}
                      </a>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>调用次数: {api.metrics.totalCalls}</span>
                      <span>最后调用: {api.metrics.lastCalledAt ? formatDate(new Date(api.metrics.lastCalledAt)) : '从未调用'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <button
                      onClick={() => handleToggleAPIStatus(api.id)}
                      disabled={updatingStatus === api.id}
                      className={`text-sm font-medium transition-colors ${
                        api.status === 'active'
                          ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                          : 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300'
                      } disabled:opacity-50`}
                    >
                      {api.status === 'active' ? '禁用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleDeleteAPI(api.id)}
                      disabled={deletingId === api.id}
                      className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* 添加一个额外的背景层来确保滚动时背景色一致 */}
      <div className="fixed inset-0 -z-10 bg-gray-50 dark:bg-zinc-900" aria-hidden="true" />
    </div>
  );
};

export default APIManagementPage;
