// Token configuration
export const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || "9", 10);
export const TOKEN_MULTIPLIER = Math.pow(10, TOKEN_DECIMALS);

// USDC has 6 decimals
export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = Math.pow(10, USDC_DECIMALS);

// SOL has 9 decimals (lamports)
export const SOL_DECIMALS = 9;
export const SOL_MULTIPLIER = Math.pow(10, SOL_DECIMALS);
