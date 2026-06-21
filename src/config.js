// Loads configuration from environment variables (and an optional .env file).
// Kept dependency-free: a tiny .env parser instead of pulling in dotenv.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const bool = (v, fallback) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const config = {
  rootDir,
  port: Number(process.env.PORT) || 3000,
  apiKey: process.env.API_KEY || '',
  provider: (process.env.CHALLAN_PROVIDER || 'mock').toLowerCase(),
  refreshIntervalHours: Number(process.env.REFRESH_INTERVAL_HOURS) || 12,
  refreshOnStart: bool(process.env.REFRESH_ON_START, true),
  http: {
    url: process.env.CHALLAN_API_URL || '',
    apiKey: process.env.CHALLAN_API_KEY || '',
    mode: (process.env.CHALLAN_API_MODE || 'body').toLowerCase(),
    vehicleField: process.env.CHALLAN_API_VEHICLE_FIELD || 'vehicle_number',
    auth: (process.env.CHALLAN_API_AUTH || 'x-api-key').toLowerCase(),
  },
  instantPay: {
    url: process.env.INSTANTPAY_URL || 'https://api.instantpay.in/identity/vehicleChallan',
    clientId: process.env.INSTANTPAY_CLIENT_ID || '',
    clientSecret: process.env.INSTANTPAY_CLIENT_SECRET || '',
    authCode: process.env.INSTANTPAY_AUTH_CODE || '1',
    endpointIp: process.env.INSTANTPAY_ENDPOINT_IP || '127.0.0.1',
    latitude: process.env.INSTANTPAY_LATITUDE || '0',
    longitude: process.env.INSTANTPAY_LONGITUDE || '0',
    consent: process.env.INSTANTPAY_CONSENT || 'Y',
  },
  mastersIndia: {
    authUrl: process.env.MI_AUTH_URL || 'https://api-platform.mastersindia.co/api/v2/token-auth/',
    challanUrl:
      process.env.MI_CHALLAN_URL || 'https://api-platform.mastersindia.co/api/v2/sbt/ECHALLAN/',
    username: process.env.MI_USERNAME || '',
    password: process.env.MI_PASSWORD || '',
    subid: process.env.MI_SUBID || '',
    productId: process.env.MI_PRODUCTID || 'arap',
    mode: process.env.MI_MODE || 'Buyer',
  },
  dataFile: path.join(rootDir, 'data', 'store.json'),
};
