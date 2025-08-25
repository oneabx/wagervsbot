export const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || "9", 10);
export const TOKEN_MULTIPLIER = Math.pow(10, TOKEN_DECIMALS);

export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = Math.pow(10, USDC_DECIMALS);

export const SOL_DECIMALS = 9;
export const SOL_MULTIPLIER = Math.pow(10, SOL_DECIMALS);

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const ADMIN_WALLET_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY;

export const VS_TOKEN_MINT_ADDRESS =
  process.env.VS_TOKEN_MINT_ADDRESS ||
  "7SGrxHJFwNcsjkeu5WqZZKpB1b8LayWZLtrEEtBYhLjW";

export const DB_HOST = process.env.DB_HOST || "localhost";
export const DB_USER = process.env.DB_USER || "root";
export const DB_PASSWORD = process.env.DB_PASSWORD || "";
export const DB_NAME = process.env.DB_NAME || "wager_bot";
export const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const SOLANA_NETWORK = process.env.SOLANA_NETWORK || "devnet";
