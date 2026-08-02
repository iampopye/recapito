import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ path: '../../.env' });

/**
 * DataSource used by the TypeORM CLI for generating and running migrations.
 *
 * DATABASE_PASSWORD has no fallback here on purpose. It previously defaulted
 * to a value committed to this repository, which meant the documented setup
 * path produced a database whose password was public.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required to run migrations but was not set. ` +
        'Copy .env.example to .env and fill it in.',
    );
  }
  return value;
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'recapito',
  password: required('DATABASE_PASSWORD'),
  database: process.env.DATABASE_NAME || 'recapito',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});
