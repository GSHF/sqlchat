import { NextApiRequest, NextApiResponse } from 'next';
import { Vulcan } from '../../../vulcan/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { connection } = req.query;
  
  if (!connection) {
    return res.status(400).json({ error: 'Connection configuration is required' });
  }

  try {
    const vulcan = new Vulcan({ 
      connection: JSON.parse(connection as string),
      enableSwagger: true 
    });

    const docs = vulcan.getSwaggerDocs();
    return res.status(200).json(docs);
  } catch (error) {
    console.error('Swagger docs error:', error);
    return res.status(500).json({ error: 'Failed to generate Swagger documentation' });
  }
}
