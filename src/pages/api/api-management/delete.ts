import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAPIStore } from '@/store/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'API ID is required' });
    }

    const store = getServerAPIStore();
    const storeState = store.getState();
    const api = storeState.apis.find(api => api.id === id);
    
    if (!api) {
      return res.status(404).json({ message: 'API not found' });
    }

    // Delete the API
    store.getState().apis = store.getState().apis.filter(a => a.id !== id);
    
    return res.status(200).json({ 
      message: 'API deleted successfully',
      id
    });
  } catch (error) {
    console.error('Error deleting API:', error);
    return res.status(500).json({ message: 'Failed to delete API' });
  }
}
