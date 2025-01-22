import { PublishedAPI } from '@/types/api';
import { getServerState } from './api';

// 从服务器加载状态
export const loadServerState = async () => {
  try {
    console.log('Loading server state...');
    const response = await fetch('/api/api-management/sync-state');
    if (!response.ok) {
      throw new Error('Failed to load server state');
    }
    const data = await response.json();
    console.log('Loaded server state:', data);
    return data as { apis: PublishedAPI[] };
  } catch (error) {
    console.error('Error loading server state:', error);
    // Return empty state instead of throwing
    return { apis: [] };
  }
};

// 将状态同步到服务器
export const syncWithServerState = async () => {
  try {
    const response = await fetch('/api/api-management/list');
    if (!response.ok) {
      throw new Error('Failed to fetch API list');
    }
    const apis: PublishedAPI[] = await response.json();
    const serverState = getServerState();
    serverState.apis = apis;
    return apis;
  } catch (error) {
    console.error('Error syncing with server state:', error);
    throw error;
  }
};
