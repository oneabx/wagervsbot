export interface Wallet {
  id?: number;
  wallet_public_key: string;
  wallet_private_key: string;
  telegram_user_id: number;
  sol_amount: number;
  vs_token_amount: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateWalletRequest {
  telegram_user_id: number;
}

export interface WalletResponse {
  success: boolean;
  data?: Wallet;
  error?: string;
  message?: string;
}

export interface WalletBalanceResponse {
  success: boolean;
  sol_amount?: number;
  vs_token_amount?: number;
  error?: string;
}
