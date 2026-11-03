import type { NextConfig } from 'next';

// DuckDB is a native module: load it from node_modules instead of bundling it.
const config: NextConfig = { serverExternalPackages: ['@duckdb/node-api'] };
export default config;
