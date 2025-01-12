import type { NextApiRequest, NextApiResponse } from 'next';
import { PublishedAPI } from '@/types/api';
import { getServerAPIStore } from '@/store/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const apiStore = getServerAPIStore();
    console.log('API Store initialized:', apiStore !== null);

    if (req.method === 'GET') {
      try {
        const state = apiStore.getState();
        console.log('Current server state:', state);
        if (!state || !Array.isArray(state.apis)) {
          console.error('Invalid server state:', state);
          throw new Error('Invalid server state');
        }
        res.status(200).json({ apis: state.apis });
      } catch (error) {
        console.error('Error getting state:', error);
        res.status(500).json({ 
          message: 'Internal server error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (req.method === 'POST') {
      try {
        const { apis } = req.body as { apis: PublishedAPI[] };
        if (!Array.isArray(apis)) {
          throw new Error('Invalid APIs data format');
        }
        console.log('Received APIs to sync:', apis);
        
        // Update server state with client state
        const state = apiStore.getState();
        state.syncWithServer(apis);
        console.log('Server state updated successfully');
        
        res.status(200).json({ 
          message: 'State synced successfully',
          apis: state.apis 
        });
      } catch (error) {
        console.error('Error syncing state:', error);
        res.status(500).json({ 
          message: 'Internal server error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Critical API error:', error);
    res.status(500).json({ 
      message: 'Critical server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
