import { generateSqlApiUrl } from '../src/utils/urlGenerator';
import { Connection, Engine } from '../src/types/connection';

// 示例数据库连接信息
const connection: Connection = {
  id: 'example',
  title: 'Example Connection',
  engineType: Engine.PostgreSQL,  // 或 Engine.MySQL
  host: 'localhost',
  port: '5432',             // PostgreSQL的默认端口，MySQL使用3306
  username: 'your_username',
  password: 'your_password',
  database: 'your_database'
};

// 生成URL
const url = generateSqlApiUrl(
  'http://localhost:3000',
  connection,
  'basevoltage',
  'SELECT DISTINCT basevoltage_name FROM basevoltage'
);

// 生成curl命令
const curlCommand = `curl -X GET "${url}"`;

console.log('Generated curl command:');
console.log(curlCommand);
console.log('\nNote: The URL contains encrypted connection information.');
