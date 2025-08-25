import mysql from "mysql2/promise";
import { createDatabaseConnection } from "../config/database";

export interface Wager {
  id?: number;
  creator_telegram_user_id: number;
  category: string;
  name: string;
  description: string;
  image_url?: string;
  side_1: string;
  side_2: string;
  wager_end_time: Date;
  wager_type: "private" | "public";
  status: "active" | "ended" | "cancelled";
  total_pool_amount?: number;
  winning_side?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateWagerRequest {
  creator_telegram_user_id: number;
  category: string;
  name: string;
  description: string;
  image_url?: string;
  side_1: string;
  side_2: string;
  wager_end_time: Date;
  wager_type: "private" | "public";
}

async function getConnection(): Promise<mysql.Connection> {
  return await createDatabaseConnection();
}

export async function createWager(request: CreateWagerRequest): Promise<Wager> {
  const dbConnection = await getConnection();

  try {
    const [result] = await dbConnection.execute(
      `INSERT INTO wagers (
        creator_telegram_user_id, 
        category, 
        name, 
        description, 
        image_url, 
        side_1, 
        side_2, 
        wager_end_time, 
        wager_type, 
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        request.creator_telegram_user_id,
        request.category,
        request.name,
        request.description,
        request.image_url || null,
        request.side_1,
        request.side_2,
        request.wager_end_time,
        request.wager_type,
      ]
    );

    const insertResult = result as mysql.ResultSetHeader;
    const wagerId = insertResult.insertId;

    // Fetch the created wager
    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE id = ?",
      [wagerId]
    );

    const wagers = rows as Wager[];
    return wagers[0];
  } catch (error) {
    console.error("Error creating wager:", error);
    throw error;
  }
}

export async function getAllWagers(): Promise<Wager[]> {
  const dbConnection = await getConnection();

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
  }
}

export async function getWagerById(wagerId: number): Promise<Wager | null> {
  const dbConnection = await getConnection();

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
  }
}

export async function getWagersByCategory(category: string): Promise<Wager[]> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE category = ? AND status = 'active' ORDER BY created_at DESC",
      [category]
    );

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting wagers by category:", error);
    throw error;
  }
}

export async function getWagersByCreator(
  telegramUserId: number
): Promise<Wager[]> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM wagers WHERE creator_telegram_user_id = ? ORDER BY created_at DESC",
      [telegramUserId]
    );

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting wagers by creator:", error);
    throw error;
  }
}

export async function updateWagerStatus(
  wagerId: number,
  status: "active" | "ended" | "cancelled",
  winningSide?: string
): Promise<void> {
  const dbConnection = await getConnection();

  try {
    await dbConnection.execute(
      "UPDATE wagers SET status = ?, winning_side = ?, updated_at = NOW() WHERE id = ?",
      [status, winningSide || null, wagerId]
    );

    console.log(`✅ Updated wager ${wagerId} status to ${status}`);
  } catch (error) {
    console.error("Error updating wager status:", error);
    throw error;
  }
}

export async function getActiveWagersCount(): Promise<number> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      "SELECT COUNT(*) as count FROM wagers WHERE status = 'active'"
    );

    const result = rows as { count: number }[];
    return result[0].count;
  } catch (error) {
    console.error("Error getting active wagers count:", error);
    throw error;
  }
}

export async function getWagersEndingSoon(
  hours: number = 24
): Promise<Wager[]> {
  const dbConnection = await getConnection();

  try {
    const [rows] = await dbConnection.execute(
      `SELECT * FROM wagers 
       WHERE status = 'active' 
         AND wager_end_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)
       ORDER BY wager_end_time ASC`,
      [hours]
    );

    return rows as Wager[];
  } catch (error) {
    console.error("Error getting wagers ending soon:", error);
    throw error;
  }
}
