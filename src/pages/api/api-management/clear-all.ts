import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAPIStore } from '@/store/api';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取服务器状态
    const store = getServerAPIStore();
    const state = store.getState();

    // 清除内存中的状态
    state.clearAllAPIs();

    // 清除持久化文件
    const statePath = path.join(process.cwd(), 'server-state.json');
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    
    return res.status(200).json({ message: 'All APIs cleared successfully' });
  } catch (error) {
    console.error('Error clearing APIs:', error);
    return res.status(500).json({ error: 'Failed to clear APIs' });
  }
}
