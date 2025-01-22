import crypto from 'crypto';

// 使用SHA256生成一个固定长度的密钥
function getKey(key: string): Buffer {
  const hash = crypto.createHash('sha256');
  hash.update(key);
  return hash.digest();
}

// 使用固定的密钥，确保前后端一致
const ENCRYPTION_KEY = 'your-secret-key-32-chars-long!!!!!';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  try {
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }

    // 验证输入是否为有效的JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
      // Ensure database field exists and is not undefined
      if (parsed.database === undefined) {
        parsed.database = '';
      }
      text = JSON.stringify(parsed);
    } catch (e) {
      console.error('Invalid JSON input:', e);
      throw new Error('Input must be a valid JSON string');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey(ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv(ALGORITHM, new Uint8Array(key), new Uint8Array(iv));
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Convert Buffer to Uint8Array before concatenation
    const result = Buffer.concat([
      new Uint8Array(iv),
      new Uint8Array(Buffer.from(encrypted, 'base64'))
    ]).toString('base64');
    return result;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

export function decrypt(text: string): string {
  try {
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }

    // 解码base64
    const buffer = Buffer.from(text, 'base64');
    
    // 提取IV和加密数据
    const iv = buffer.slice(0, IV_LENGTH);
    const encrypted = buffer.slice(IV_LENGTH);
    
    const key = getKey(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv(ALGORITHM, new Uint8Array(key), new Uint8Array(iv));
    
    let decrypted = decipher.update(Buffer.from(encrypted).toString('base64'), 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    try {
      return decrypted;
    } catch (e) {
      console.error('Invalid JSON after decryption:', decrypted);
      throw new Error('Decryption resulted in invalid JSON');
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
}
