import type { NextConfig } from 'next';
import path from 'node:path';

const releaseEnvironment = process.env.APP_ENV === 'staging' || process.env.APP_ENV === 'production';
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
if (releaseEnvironment && (!apiBaseUrl || !apiBaseUrl.startsWith('https://') || apiBaseUrl.endsWith('/'))) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL must be an https URL without a trailing slash for staging and production builds');
}

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@net-slet/exam-rules'],
};
export default config;
