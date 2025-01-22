import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAPIStore } from '@/store/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id, status } = req.body;
    console.log('Received update request:', { id, status });

    if (!id || !status) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const store = getServerAPIStore();
    const state = store.getState();
    
    try {
      // 更新 API 状态
      const updatedApi = state.updateAPIStatus(id, status);
      
      // 验证更新是否成功
      const api = state.getAPIById(id);
      if (!api) {
        throw new Error(`API not found after update: ${id}`);
      }
      
      if (api.status !== status) {
        throw new Error(`Status mismatch after update: expected ${status}, got ${api.status}`);
      }
      
      console.log('API updated successfully:', api);
      
      // 返回更新后的 API
      res.status(200).json({ 
        message: 'API status updated successfully',
        api
      });
    } catch (error) {
      console.error('Error updating API status:', error);
      
      if (error instanceof Error && error.message.includes('API not found')) {
        return res.status(404).json({ 
          message: 'API not found',
          error: error.message 
        });
      }
      
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update API status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in update-status handler:', error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Failed to update API status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
