import { NextApiRequest, NextApiResponse } from 'next';
import { PublishedAPI } from '@/types/api';
import { getServerAPIStore } from '@/store/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const api: PublishedAPI = req.body;
    const store = getServerAPIStore();
    
    // Validate required fields
    if (!api.name || !api.sqlQuery || !api.connectionId || !api.url) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Add the API to server state using store's addAPI method
    const newApi = store.getState().addAPI(api);
    
    // 返回完整的API数据，包括ID和创建时间
    return res.status(200).json({ 
      message: 'API created successfully', 
      api: newApi 
    });
  } catch (error) {
    console.error('Error creating API:', error);
    return res.status(500).json({ message: 'Failed to create API' });
  }
}
