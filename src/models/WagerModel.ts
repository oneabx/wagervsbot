import mysql from "mysql2/promise";
import { createDatabaseConnection } from "../config/database";

export interface Wager {
  id?: number;
  creator_telegram_user_id: number;
  category: string;
  name: string;
  description: string;
  image_file_id?: string;
  side_1: string;
  side_2: string;
  side_1_wallet_address: string;
  side_2_wallet_address: string;
  wager_end_time: Date;
  wager_type: "private" | "public";
  status: "active" | "ended" | "cancelled";
  total_pool_amount?: number;
  winning_side?: "side_1" | "side_2";
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateWagerRequest {
  creator_telegram_user_id: number;
  category: string;
  name: string;
  description: string;
  image_file_id?: string;
  side_1: string;
  side_2: string;
  side_1_wallet_address: string;
  side_2_wallet_address: string;
  wager_end_time: Date;
  wager_type: "private" | "public";
}

// Remove the getConnection function and create new connections for each operation

export async function createWager(request: CreateWagerRequest): Promise<Wager> {
  const dbConnection = await createDatabaseConnection();

  try {
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS wagers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        creator_telegram_user_id BIGINT NOT NULL,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        image_file_id VARCHAR(255),
        side_1 VARCHAR(50) NOT NULL,
        side_2 VARCHAR(50) NOT NULL,
        side_1_wallet_address VARCHAR(44) NOT NULL,
        side_2_wallet_address VARCHAR(44) NOT NULL,
        wager_end_time DATETIME NOT NULL,
        wager_type ENUM('private', 'public') NOT NULL DEFAULT 'public',
        status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active',
        total_pool_amount DECIMAL(20, 9) DEFAULT 0,
        winning_side ENUM('side_1', 'side_2') NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_creator (creator_telegram_user_id),
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_wager_end_time (wager_end_time),
        INDEX idx_created_at (created_at),
        INDEX idx_side_1_wallet (side_1_wallet_address),
        INDEX idx_side_2_wallet (side_2_wallet_address)
      )
    `);

    const [result] = await dbConnection.execute(
      `INSERT INTO wagers (
        creator_telegram_user_id, 
        category, 
        name, 
        description, 
        image_file_id, 
        side_1, 
        side_2, 
        side_1_wallet_address,
        side_2_wallet_address,
        wager_end_time, 
        wager_type, 
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        request.creator_telegram_user_id,
        request.category,
        request.name,
        request.description,
        request.image_file_id || null,
        request.side_1,
        request.side_2,
        request.side_1_wallet_address,
        request.side_2_wallet_address,
        request.wager_end_time,
        request.wager_type,
      ]
    );

    const insertResult = result as mysql.ResultSetHeader;
    const wagerId = insertResult.insertId;

    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE id = ?",
      [wagerId]
    );

    const wagers = rows as Wager[];
    return wagers[0];
  } catch (error) {
    console.error("Error creating wager:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getAllWagers(): Promise<Wager[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(`
      SELECT * FROM wagers 
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting all wagers:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getWagerById(wagerId: number): Promise<Wager | null> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE id = ?",
      [wagerId]
    );

    const wagers = rows as Wager[];
    return wagers.length > 0 ? wagers[0] : null;
  } catch (error) {
    console.error("Error getting wager by ID:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function updateWagerStatus(
  wagerId: number,
  status: "active" | "ended" | "cancelled"
): Promise<void> {
  const dbConnection = await createDatabaseConnection();

  try {
    await dbConnection.execute(
      "UPDATE wagers SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, wagerId]
    );
  } catch (error) {
    console.error("Error updating wager status:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function updateWagerWinningSide(
  wagerId: number,
  winningSide: "side_1" | "side_2"
): Promise<boolean> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [result] = await dbConnection.execute(
      "UPDATE wagers SET winning_side = ?, status = 'ended', updated_at = NOW() WHERE id = ?",
      [winningSide, wagerId]
    );

    const updateResult = result as mysql.ResultSetHeader;
    return updateResult.affectedRows > 0;
  } catch (error) {
    console.error("Error updating wager winning side:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function updateWagerPoolAmount(
  wagerId: number,
  totalPoolAmount: number
): Promise<void> {
  const dbConnection = await createDatabaseConnection();

  try {
    await dbConnection.execute(
      "UPDATE wagers SET total_pool_amount = ?, updated_at = NOW() WHERE id = ?",
      [totalPoolAmount, wagerId]
    );
  } catch (error) {
    console.error("Error updating wager pool amount:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getExpiredWagers(): Promise<Wager[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(`
      SELECT * FROM wagers 
      WHERE status = 'active' AND wager_end_time <= NOW()
      ORDER BY wager_end_time ASC
    `);

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting expired wagers:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getEndedWagersWithoutWinner(): Promise<Wager[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(`
      SELECT * FROM wagers 
      WHERE status = 'ended' AND winning_side IS NULL
      ORDER BY wager_end_time ASC
    `);

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting ended wagers without winner:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getWagersByCreator(
  creatorTelegramUserId: number
): Promise<Wager[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE creator_telegram_user_id = ? ORDER BY created_at DESC",
      [creatorTelegramUserId]
    );

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting wagers by creator:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getWagersByCategory(category: string): Promise<Wager[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE category = ? AND status = 'active' ORDER BY created_at DESC",
      [category]
    );

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting wagers by category:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function updateExpiredWagers(): Promise<number> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [result] = await dbConnection.execute(
      `UPDATE wagers 
       SET status = 'ended', updated_at = NOW() 
       WHERE status = 'active' 
       AND wager_end_time <= NOW()`
    );

    return (result as any).affectedRows || 0;
  } catch (error) {
    console.error("Error updating expired wagers:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}
