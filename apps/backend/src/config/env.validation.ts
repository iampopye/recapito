/**
 * Fail-fast environment validation.
 *
 * Every secret in this file used to have a hardcoded fallback. That is the
 * single most dangerous pattern in a self-hosted product: the app boots
 * successfully, looks healthy, and is silently insecure. A deployment that
 * forgot JWT_SECRET was signing tokens with the literal string
 * 'default-secret' -- meaning anyone who read the source could forge a token
 * for any user on any such instance.
 *
 * There are no fallbacks here by design. If a required secret is missing the
 * process refuses to start and tells you exactly how to generate one.
 */

/** Minimum entropy we accept for the JWT signing secret. */
const MIN_JWT_SECRET_LENGTH = 32;

/** AES-256 needs a 32-byte key, which is 64 hex characters. */
const ENCRYPTION_KEY_HEX_LENGTH = 64;

/** Values that are obviously placeholders rather than real secrets. */
const KNOWN_PLACEHOLDERS = new Set([
  'default-secret',
  'secret',
  'changeme',
  'change-me',
  'your-secret',
  'your-secret-here',
  'recapito_dev_password',
  'recapito_secret',
  'password',
  'postgres',
  'test',
]);

export interface ValidatedEnv extends Record<string, unknown> {
  NODE_ENV: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USERNAME: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
}

function fail(errors: string[]): never {
  throw new Error(
    [
      '',
      'Recapito cannot start: required configuration is missing or invalid.',
      '',
      ...errors.map((e) => `  - ${e}`),
      '',
      'Generate strong values with:',
      '  JWT_SECRET      openssl rand -hex 64',
      '  ENCRYPTION_KEY  openssl rand -hex 32',
      '',
      'See .env.example for the full list of settings.',
      '',
    ].join('\n'),
  );
}

function requireValue(
  env: Record<string, unknown>,
  key: string,
  errors: string[],
): string | undefined {
  const raw = env[key];
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (!value) {
    errors.push(`${key} is required but was not set.`);
    return undefined;
  }
  if (KNOWN_PLACEHOLDERS.has(value.toLowerCase())) {
    errors.push(
      `${key} is set to the well-known placeholder "${value}". ` +
        'Anyone can guess it. Generate a real value.',
    );
    return undefined;
  }
  return value;
}

export function validateEnv(env: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];

  const nodeEnv = typeof env.NODE_ENV === 'string' && env.NODE_ENV.trim() ? env.NODE_ENV.trim() : 'development';

  // --- JWT signing secret -------------------------------------------------
  const jwtSecret = requireValue(env, 'JWT_SECRET', errors);
  if (jwtSecret && jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
        `(got ${jwtSecret.length}). Use: openssl rand -hex 64`,
    );
  }

  // --- Credential encryption key ------------------------------------------
  // Used to encrypt stored IMAP/SMTP passwords and provider API keys.
  const encryptionKey = requireValue(env, 'ENCRYPTION_KEY', errors);
  if (encryptionKey && !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    errors.push(
      'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (a 32-byte ' +
        'AES-256 key). Use: openssl rand -hex 32',
    );
  }

  // --- Database -----------------------------------------------------------
  const dbPassword = requireValue(env, 'DATABASE_PASSWORD', errors);

  const portRaw = typeof env.DATABASE_PORT === 'string' ? env.DATABASE_PORT : '5432';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`DATABASE_PORT must be a valid port number (got "${portRaw}").`);
  }

  if (errors.length > 0) {
    fail(errors);
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    JWT_SECRET: jwtSecret as string,
    ENCRYPTION_KEY: encryptionKey as string,
    DATABASE_HOST: (env.DATABASE_HOST as string) || 'localhost',
    DATABASE_PORT: port,
    DATABASE_USERNAME: (env.DATABASE_USERNAME as string) || 'recapito',
    DATABASE_PASSWORD: dbPassword as string,
    DATABASE_NAME: (env.DATABASE_NAME as string) || 'recapito',
  };
}

export { ENCRYPTION_KEY_HEX_LENGTH, MIN_JWT_SECRET_LENGTH };
