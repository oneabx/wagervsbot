import mysql from "mysql2/promise";
import { createDatabaseConnection } from "../config/database";

export interface Bet {
  id?: number;
  wager_id: number;
  user_telegram_id: number;
  side: "side_1" | "side_2";
  amount: number;
  created_at?: Date;
}

export interface CreateBetRequest {
  wager_id: number;
  user_telegram_id: number;
  side: "side_1" | "side_2";
  amount: number;
}

// Remove the getConnection function and create new connections for each operation

export async function createBet(request: CreateBetRequest): Promise<Bet> {
  const dbConnection = await createDatabaseConnection();

  try {
    // First, ensure the bets table exists
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS bets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wager_id INT NOT NULL,
        user_telegram_id BIGINT NOT NULL,
        side ENUM('side_1', 'side_2') NOT NULL,
        amount DECIMAL(20, 9) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_wager (wager_id),
        INDEX idx_user (user_telegram_id),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (wager_id) REFERENCES wagers(id) ON DELETE CASCADE
      )
    `);

    const [result] = await dbConnection.execute(
      `INSERT INTO bets (
        wager_id, 
        user_telegram_id, 
        side, 
        amount,
        created_at
      ) VALUES (?, ?, ?, ?, NOW())`,
      [request.wager_id, request.user_telegram_id, request.side, request.amount]
    );

    const insertResult = result as mysql.ResultSetHeader;
    const betId = insertResult.insertId;

    // Fetch the created bet
    const [rows] = await dbConnection.execute(
      "SELECT * FROM bets WHERE id = ?",
      [betId]
    );

    const bets = rows as Bet[];
    return bets[0];
  } catch (error) {
    console.error("Error creating bet:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getBetsByWager(wagerId: number): Promise<Bet[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM bets WHERE wager_id = ? ORDER BY created_at DESC",
      [wagerId]
    );

    return rows as Bet[];
  } catch (error) {
    console.error("Error getting bets by wager:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getBetsByUser(userTelegramId: number): Promise<Bet[]> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM bets WHERE user_telegram_id = ? ORDER BY created_at DESC",
      [userTelegramId]
    );

    return rows as Bet[];
  } catch (error) {
    console.error("Error getting bets by user:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getTotalPoolAmount(wagerId: number): Promise<number> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE wager_id = ?",
      [wagerId]
    );

    const result = rows as { total: number }[];
    return Number(result[0].total);
  } catch (error) {
    console.error("Error getting total pool amount:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getTotalAmountBySide(
  wagerId: number,
  side: "side_1" | "side_2"
): Promise<number> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE wager_id = ? AND side = ?",
      [wagerId, side]
    );

    const result = rows as { total: number }[];
    return Number(result[0].total);
  } catch (error) {
    console.error("Error getting total amount by side:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function updateWagerPoolAmount(wagerId: number): Promise<void> {
  const dbConnection = await createDatabaseConnection();

  try {
    // Calculate total pool amount
    const totalAmount = await getTotalPoolAmount(wagerId);

    // Update wager table
    await dbConnection.execute(
      "UPDATE wagers SET total_pool_amount = ? WHERE id = ?",
      [totalAmount, wagerId]
    );
  } catch (error) {
    console.error("Error updating wager pool amount:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}

export async function getBetById(betId: number): Promise<Bet | null> {
  const dbConnection = await createDatabaseConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM bets WHERE id = ?",
      [betId]
    );

    const bets = rows as Bet[];
    return bets.length > 0 ? bets[0] : null;
  } catch (error) {
    console.error("Error getting bet by ID:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
}
