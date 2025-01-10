import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAPIStore } from '@/store/api';
import { Connection } from '@/types/connection';
import toast from '@/utils/toast';
import Modal from './kit/Modal';
import { generateUUID } from '@/utils';
import { encrypt } from '@/utils/encryption';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  sqlQuery: string;
  tableName: string;
  selectedDatabase?: string;
}

export const ApiPublishModal: React.FC<Props> = ({
  isOpen,
  onClose,
  connection,
  sqlQuery,
  tableName,
  selectedDatabase,
}) => {
  const { t } = useTranslation();
  const [apiName, setApiName] = useState('');
  const [apiDescription, setApiDescription] = useState('');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [isPublishing, setIsPublishing] = useState(false);
  const store = useAPIStore();

  // 预览 API URL
  const previewUrl = useMemo(() => {
    if (!apiName || !connection || !sqlQuery || !selectedDatabase) return '';
    
    try {
      // 创建一个新的连接对象，使用选择的数据库
      const connectionWithSelectedDB = {
        ...connection,
        database: selectedDatabase  // 使用选择的数据库替换默认数据库
      };

      // 使用加密方法加密连接信息
      const connectionInfo = encodeURIComponent(encrypt(JSON.stringify(connectionWithSelectedDB)));
      const encodedQuery = encodeURIComponent(sqlQuery);
      
      // 使用与之前相同的URL格式
      return `${window.location.origin}/api/sql/${tableName}?connectionInfo=${connectionInfo}&query=${encodedQuery}`;
    } catch (error) {
      console.error('Error generating preview URL:', error);
      return '';
    }
  }, [apiName, connection, sqlQuery, tableName, selectedDatabase]);

  const handlePublishAPI = async () => {
    if (!apiName) {
      toast.error('请输入 API 名称');
      return;
    }

    if (!sqlQuery) {
      toast.error('SQL 查询不能为空');
      return;
    }

    if (!selectedDatabase) {
      toast.error('请选择数据库');
      return;
    }

    try {
      setIsPublishing(true);

      // 创建一个新的连接对象，使用选择的数据库
      const connectionWithSelectedDB = {
        ...connection,
        database: selectedDatabase
      };

      // 发送到服务器注册API
      const response = await fetch('/api/vulcan/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: apiName,
          description: apiDescription,
          connection: connectionWithSelectedDB,
          tableName,
          sqlQuery,
          database: selectedDatabase,
          method: apiMethod
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register API');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // 使用返回的API数据更新store
      store.addAPI({
        name: apiName,
        description: apiDescription,
        url: data.api.url,
        sqlQuery,
        connectionId: connection.id,
        tableName,
        database: selectedDatabase,
        method: apiMethod
      });

      toast.success('API 发布成功');
      onClose();
    } catch (error: unknown) {
      console.error('Error publishing API:', error);
      toast.error(`发布 API 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal
      title="发布 API"
      isOpen={isOpen}
      onClose={onClose}
      className="w-[800px] max-w-[90vw] bg-gray-50 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：API 基本信息 */}
        <div className="col-span-7 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API 名称
            </label>
            <input
              type="text"
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入API名称"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API 描述
            </label>
            <textarea
              value={apiDescription}
              onChange={(e) => setApiDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="请输入API描述"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              请求方法
            </label>
            <div className="flex space-x-4">
              {(['GET', 'POST'] as const).map((method) => (
                <label key={method} className="inline-flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 px-4 py-2 rounded-md">
                  <input
                    type="radio"
                    value={method}
                    checked={apiMethod === method}
                    onChange={(e) => setApiMethod(e.target.value as 'GET' | 'POST')}
                    className="form-radio h-4 w-4 text-blue-600 dark:text-blue-500 transition duration-150 ease-in-out"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{method}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SQL 查询语句
            </label>
            <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">
                {sqlQuery}
              </pre>
            </div>
          </div>
        </div>

        {/* 右侧：功能说明和预览 */}
        <div className="col-span-5 space-y-4">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">API 功能说明</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>自动生成 API 文档</li>
              <li>支持参数验证</li>
              <li>访问控制和限流</li>
            </ul>
          </div>

          {previewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API 预览
              </label>
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-800 dark:text-gray-200 break-all">
                  {previewUrl}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          取消
        </button>
        <button
          onClick={handlePublishAPI}
          disabled={isPublishing || !apiName.trim()}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isPublishing || !apiName.trim()
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isPublishing ? '发布中...' : '发布 API'}
        </button>
      </div>
    </Modal>
  );
};
