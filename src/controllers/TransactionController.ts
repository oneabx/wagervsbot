import {
  createTransaction as createTransactionInDB,
  getTransactionsByWager,
  getTransactionsByUser,
  updateTransactionStatus,
  getTransactionById,
  TransactionHistory,
  CreateTransactionRequest,
} from "../models/TransactionHistoryModel";
import { PublicKey } from "@solana/web3.js";
import {
  walletExists,
  getBalance,
  updateWalletBalance,
  getWalletByTelegramId,
} from "../models/WalletModel";
import {
  transferVSTokensFromUser,
  getVSTokenBalance,
  getSideWalletVSTokenBalance,
} from "../services/TransferService";
import { getWager } from "./WagerController";

export interface TransactionResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface TransferVSTokenRequest {
  wagerId: number;
  userTelegramId: number;
  side: "side_1" | "side_2";
  walletAddress: string;
  amount: number;
}

export async function transferVSTokenToSideWallet(
  request: TransferVSTokenRequest
): Promise<TransactionResponse> {
  try {
    if (
      !request.wagerId ||
      !request.userTelegramId ||
      !request.side ||
      !request.walletAddress ||
      !request.amount
    ) {
      return {
        success: false,
        error: "All required fields must be provided",
      };
    }

    if (request.amount <= 0) {
      return {
        success: false,
        error: "Transfer amount must be greater than 0",
      };
    }

    try {
      new PublicKey(request.walletAddress);
    } catch (error) {
      return {
        success: false,
        error: "Invalid destination wallet address",
      };
    }

    const hasWallet = await walletExists(request.userTelegramId);
    if (!hasWallet) {
      return {
        success: false,
        error: "User wallet not found. Please create a wallet first.",
      };
    }

    const balance = await getBalance(request.userTelegramId);
    if (!balance) {
      return {
        success: false,
        error: "Failed to get wallet balance",
      };
    }

    const vsTokenBalance = balance.vs_token_amount || 0;
    if (vsTokenBalance < request.amount) {
      return {
        success: false,
        error: `Insufficient VS token balance. You have ${vsTokenBalance} VS token, but trying to transfer ${request.amount} VS token.`,
      };
    }

    const userWallet = await getWalletByTelegramId(request.userTelegramId);
    if (!userWallet) {
      return {
        success: false,
        error: "User wallet credentials not found",
      };
    }

    const monitoredBalance = await getVSTokenBalance(
      userWallet.wallet_public_key
    );
    if (!monitoredBalance.success) {
      return {
        success: false,
        error: "Your wallet does not have VS token. Please buy VS token first.",
      };
    }

    if (monitoredBalance.balance! < request.amount) {
      return {
        success: false,
        error: `Insufficient VS token balance. You have ${monitoredBalance.balance} VS token, but trying to transfer ${request.amount} VS token.`,
      };
    }

    const transactionRequest: CreateTransactionRequest = {
      wager_id: request.wagerId,
      user_telegram_id: request.userTelegramId,
      side: request.side,
      wallet_address: request.walletAddress,
      amount: request.amount,
      transaction_hash: undefined,
    };

    const transaction = await createTransactionInDB(transactionRequest);

    try {
      const transferResult = await transferVSTokensFromUser(
        userWallet.wallet_private_key,
        request.walletAddress,
        request.amount
      );

      if (!transferResult.success) {
        await updateTransactionStatus(transaction.id!, "failed");
        return {
          success: false,
          error: `Solana transaction failed: ${transferResult.error}`,
        };
      }

      const newUserBalance = vsTokenBalance - request.amount;
      await updateWalletBalance(
        request.userTelegramId,
        balance.sol_amount,
        newUserBalance
      );

      await updateTransactionStatus(
        transaction.id!,
        "completed",
        transferResult.signature
      );

      return {
        success: true,
        data: {
          transaction,
          message: "VS token transfer completed successfully",
          newUserBalance,
          transactionHash: transferResult.signature,
        },
      };
    } catch (transferError) {
      await updateTransactionStatus(transaction.id!, "failed");
      console.error("Error transferring VS token:", transferError);
      return {
        success: false,
        error: "Failed to transfer VS token. Please try again.",
      };
    }
  } catch (error: any) {
    console.error("Error transferring VS token:", error);
    return {
      success: false,
      error: error.message || "Failed to transfer VS token",
    };
  }
}

export async function getTransactionHistory(
  wagerId?: number,
  userTelegramId?: number
): Promise<TransactionResponse> {
  try {
    let transactions: TransactionHistory[];

    if (wagerId) {
      transactions = await getTransactionsByWager(wagerId);
    } else if (userTelegramId) {
      transactions = await getTransactionsByUser(userTelegramId);
    } else {
      return {
        success: false,
        error: "Either wagerId or userTelegramId must be provided",
      };
    }

    return {
      success: true,
      data: transactions,
    };
  } catch (error: any) {
    console.error("Error getting transaction history:", error);
    return {
      success: false,
      error: error.message || "Failed to get transaction history",
    };
  }
}

export async function getTransaction(
  transactionId: number
): Promise<TransactionResponse> {
  try {
    if (!transactionId || transactionId <= 0) {
      return {
        success: false,
        error: "Invalid transaction ID",
      };
    }

    const transaction = await getTransactionById(transactionId);

    if (!transaction) {
      return {
        success: false,
        error: "Transaction not found",
      };
    }

    return {
      success: true,
      data: transaction,
    };
  } catch (error: any) {
    console.error("Error getting transaction:", error);
    return {
      success: false,
      error: error.message || "Failed to get transaction",
    };
  }
}

export async function getTotalAmountBySide(
  wagerId: number,
  side: "side_1" | "side_2"
): Promise<number> {
  try {
    const wagerResult = await getWager(wagerId);
    if (!wagerResult.success) {
      console.error("Error getting wager:", wagerResult.error);
      return 0;
    }

    const wager = wagerResult.data;
    const sideWalletAddress =
      side === "side_1"
        ? wager.side_1_wallet_address
        : wager.side_2_wallet_address;

    const vsTokenBalance = await getSideWalletVSTokenBalance(sideWalletAddress);
    return vsTokenBalance;
  } catch (error) {
    console.error("Error getting total amount by side:", error);
    return 0;
  }
}
