import mysql from "mysql2/promise";
import { Wallet, CreateWalletRequest } from "../types/wallet";
import { createDatabaseConnection } from "../config/database";

// Remove the global connection variable and getConnection function
// Instead, create a new connection for each operation

export async function createWallet(
  request: CreateWalletRequest,
  publicKey: string,
  privateKey: string
): Promise<Wallet> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [result] = await dbConnection.execute(
      "INSERT INTO wallets (wallet_public_key, wallet_private_key, telegram_user_id, sol_amount, vs_token_amount) VALUES (?, ?, ?, ?, ?)",
      [publicKey, privateKey, request.telegram_user_id, 0, 0]
    );

    const insertResult = result as mysql.ResultSetHeader;

    return {
      id: insertResult.insertId,
      wallet_public_key: publicKey,
      wallet_private_key: privateKey,
      telegram_user_id: request.telegram_user_id,
      sol_amount: 0,
      vs_token_amount: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getBalance(
  telegramUserId: number
): Promise<{ sol_amount: number; vs_token_amount: number } | null> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT sol_amount, vs_token_amount FROM wallets WHERE telegram_user_id = ?",
      [telegramUserId]
    );

    const wallets = rows as { sol_amount: number; vs_token_amount: number }[];
    return wallets.length > 0 ? wallets[0] : null;
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getWalletByTelegramId(
  telegramUserId: number
): Promise<{ wallet_public_key: string; wallet_private_key: string } | null> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT wallet_public_key, wallet_private_key FROM wallets WHERE telegram_user_id = ?",
      [telegramUserId]
    );

    const wallets = rows as {
      wallet_public_key: string;
      wallet_private_key: string;
    }[];
    return wallets.length > 0 ? wallets[0] : null;
  } catch (error) {
    console.error("Error getting wallet by telegram ID:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function walletExists(telegramUserId: number): Promise<boolean> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT COUNT(*) as count FROM wallets WHERE telegram_user_id = ?",
      [telegramUserId]
    );

    const result = rows as { count: number }[];
    return result[0].count > 0;
  } catch (error) {
    console.error("Error checking if wallet exists:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function updateWalletBalance(
  telegramUserId: number,
  solAmount: number,
  vsTokenAmount: number
): Promise<void> {
  const dbConnection = await createDatabaseConnection();

  try {
    await dbConnection.execute(
      "UPDATE wallets SET sol_amount = ?, vs_token_amount = ?, updated_at = NOW() WHERE telegram_user_id = ?",
      [solAmount, vsTokenAmount, telegramUserId]
    );
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getAllWallets(): Promise<
  {
    wallet_public_key: string;
    wallet_private_key: string;
    telegram_user_id: number;
  }[]
> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT wallet_public_key, wallet_private_key, telegram_user_id FROM wallets"
    );

    return rows as {
      wallet_public_key: string;
      wallet_private_key: string;
      telegram_user_id: number;
    }[];
  } catch (error) {
    console.error("Error getting all wallets:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getAllUsers(): Promise<{ telegram_user_id: number }[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT DISTINCT telegram_user_id FROM wallets ORDER BY telegram_user_id"
    );

    return rows as { telegram_user_id: number }[];
  } catch (error) {
    console.error("Error getting all users:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getAllUsersWithWallets(): Promise<
  {
    telegram_user_id: number;
    wallet_public_key: string;
    wallet_private_key: string;
  }[]
> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT telegram_user_id, wallet_public_key, wallet_private_key FROM wallets ORDER BY telegram_user_id"
    );

    return rows as {
      telegram_user_id: number;
      wallet_public_key: string;
      wallet_private_key: string;
    }[];
  } catch (error) {
    console.error("Error getting all users with wallets:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}
