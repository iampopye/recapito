import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ path: '../../.env' });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'imark',
  password: process.env.DATABASE_PASSWORD || 'imark_secret',
  database: process.env.DATABASE_NAME || 'imark_mailer',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});
