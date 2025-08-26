import {
  createWallet as createWalletModel,
  getBalance,
  walletExists as walletExistsModel,
  getAllWallets,
  getWalletByTelegramId as getWalletByTelegramIdModel,
} from "../models/WalletModel";
import {
  createWallet as createSolanaWallet,
  getAdminPublicKey,
} from "../services/SolanaService";
import { startMonitoring } from "../services/BalanceMonitorService";
import { processTokenPurchase } from "../services/TransferService";

interface CreateWalletRequest {
  telegram_user_id: number;
}

interface WalletBalanceResponse {
  success: boolean;
  sol_amount?: number;
  vs_token_amount?: number;
  error?: string;
}

interface BuyTokensRequest {
  telegram_user_id: number;
  vs_token_amount: number;
  payment_currency: string;
  payment_amount: number;
}

export async function createWallet(
  request: CreateWalletRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const existingWallet = await walletExistsModel(request.telegram_user_id);
    if (existingWallet) {
      return {
        success: false,
        error: "Wallet already exists for this user",
      };
    }

    const { publicKey, privateKey } = createSolanaWallet();
    const wallet = await createWalletModel(request, publicKey, privateKey);

    try {
      await startMonitoring(publicKey, request.telegram_user_id);
    } catch (monitoringError) {
      console.error("Error starting balance monitoring:", monitoringError);
    }

    return {
      success: true,
      data: wallet,
    };
  } catch (error: any) {
    console.error("Error creating wallet:", error);
    return {
      success: false,
      error: error.message || "Failed to create wallet",
    };
  }
}

export async function walletExists(telegramUserId: number): Promise<boolean> {
  try {
    if (!telegramUserId || telegramUserId <= 0) {
      return false;
    }
    return await walletExistsModel(telegramUserId);
  } catch (error) {
    console.error("Error checking wallet existence:", error);
    return false;
  }
}

export async function getWalletByTelegramId(
  telegramUserId: number
): Promise<{ wallet_public_key: string; wallet_private_key: string } | null> {
  try {
    if (!telegramUserId || telegramUserId <= 0) {
      return null;
    }
    return await getWalletByTelegramIdModel(telegramUserId);
  } catch (error) {
    console.error("Error getting wallet by telegram ID:", error);
    return null;
  }
}

export async function getWalletBalance(
  telegramUserId: number
): Promise<WalletBalanceResponse> {
  try {
    if (!telegramUserId || telegramUserId <= 0) {
      return {
        success: false,
        error: "Invalid telegram user ID",
      };
    }

    const balance = await getBalance(telegramUserId);

    if (!balance) {
      return {
        success: false,
        error: "Wallet not found",
      };
    }

    return {
      success: true,
      sol_amount: balance.sol_amount,
      vs_token_amount: balance.vs_token_amount,
    };
  } catch (error: any) {
    console.error("Error getting wallet balance:", error);
    return {
      success: false,
      error: error.message || "Failed to get wallet balance",
    };
  }
}

export async function buyTokens(
  request: BuyTokensRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const wallets = await getAllWallets();
    const userWallet = wallets.find(
      (w) => w.telegram_user_id === request.telegram_user_id
    );

    if (!userWallet) {
      return {
        success: false,
        error: "Wallet not found. Please create a wallet first.",
      };
    }

    const transferResult = await processTokenPurchase(
      userWallet.wallet_private_key,
      userWallet.wallet_public_key,
      request.payment_amount,
      request.payment_currency.toLowerCase(),
      request.vs_token_amount
    );

    if (!transferResult.success) {
      return {
        success: false,
        error: transferResult.error,
      };
    }

    return {
      success: true,
      data: {
        vs_token_amount: request.vs_token_amount,
        payment_currency: request.payment_currency,
        user_wallet: userWallet.wallet_public_key,
        message: "Transaction completed successfully!",
      },
    };
  } catch (error: any) {
    console.error("Error processing buy request:", error);
    return {
      success: false,
      error: error.message || "Failed to process buy request",
    };
  }
}
