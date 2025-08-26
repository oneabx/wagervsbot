import mysql from "mysql2/promise";
import { createDatabaseConnection } from "../config/database";

export interface TransactionHistory {
  id?: number;
  wager_id: number;
  user_telegram_id: number;
  side: "side_1" | "side_2";
  wallet_address: string;
  amount: number;
  transaction_hash?: string;
  status: "pending" | "completed" | "failed";
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateTransactionRequest {
  wager_id: number;
  user_telegram_id: number;
  side: "side_1" | "side_2";
  wallet_address: string;
  amount: number;
  transaction_hash?: string;
}

async function getConnection(): Promise<mysql.Connection> {
  return await createDatabaseConnection();
}

export async function createTransaction(
  request: CreateTransactionRequest
): Promise<TransactionHistory> {
  const dbConnection = await getConnection();

  try {
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS transaction_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wager_id INT NOT NULL,
        user_telegram_id BIGINT NOT NULL,
        side ENUM('side_1', 'side_2') NOT NULL,
        wallet_address VARCHAR(44) NOT NULL,
        amount DECIMAL(20, 9) NOT NULL,
        transaction_hash VARCHAR(88),
        status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_wager (wager_id),
        INDEX idx_user (user_telegram_id),
        INDEX idx_wallet (wallet_address),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (wager_id) REFERENCES wagers(id) ON DELETE CASCADE
      )
    `);

    const [result] = await dbConnection.execute(
      `INSERT INTO transaction_history (
        wager_id, 
        user_telegram_id, 
        side, 
        wallet_address,
        amount,
        transaction_hash,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        request.wager_id,
        request.user_telegram_id,
        request.side,
        request.wallet_address,
        request.amount,
        request.transaction_hash || null,
      ]
    );

    const insertResult = result as mysql.ResultSetHeader;
    const transactionId = insertResult.insertId;

    const [rows] = await dbConnection.execute(
      "SELECT * FROM transaction_history WHERE id = ?",
      [transactionId]
    );

    const transactions = rows as TransactionHistory[];
    return transactions[0];
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw error;
  }
}

export async function getTransactionsByWager(
  wagerId: number
): Promise<TransactionHistory[]> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM transaction_history WHERE wager_id = ? ORDER BY created_at DESC",
      [wagerId]
    );

    return rows as TransactionHistory[];
  } catch (error) {
    console.error("Error getting transactions by wager:", error);
    throw error;
  }
}

export async function getTransactionsByUser(
  userTelegramId: number
): Promise<TransactionHistory[]> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM transaction_history WHERE user_telegram_id = ? ORDER BY created_at DESC",
      [userTelegramId]
    );

    return rows as TransactionHistory[];
  } catch (error) {
    console.error("Error getting transactions by user:", error);
    throw error;
  }
}

export async function getTransactionsByWallet(
  walletAddress: string
): Promise<TransactionHistory[]> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM transaction_history WHERE wallet_address = ? ORDER BY created_at DESC",
      [walletAddress]
    );

    return rows as TransactionHistory[];
  } catch (error) {
    console.error("Error getting transactions by wallet:", error);
    throw error;
  }
}

export async function updateTransactionStatus(
  transactionId: number,
  status: "pending" | "completed" | "failed",
  transactionHash?: string
): Promise<void> {
  const dbConnection = await getConnection();

  try {
    if (transactionHash) {
      await dbConnection.execute(
        "UPDATE transaction_history SET status = ?, transaction_hash = ?, updated_at = NOW() WHERE id = ?",
        [status, transactionHash, transactionId]
      );
    } else {
      await dbConnection.execute(
        "UPDATE transaction_history SET status = ?, updated_at = NOW() WHERE id = ?",
        [status, transactionId]
      );
    }
  } catch (error) {
    console.error("Error updating transaction status:", error);
    throw error;
  }
}

export async function getTransactionById(
  transactionId: number
): Promise<TransactionHistory | null> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM transaction_history WHERE id = ?",
      [transactionId]
    );

    const transactions = rows as TransactionHistory[];
    return transactions.length > 0 ? transactions[0] : null;
  } catch (error) {
    console.error("Error getting transaction by ID:", error);
    throw error;
  }
}
