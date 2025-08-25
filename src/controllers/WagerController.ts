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

export interface WagerResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const WAGER_CATEGORIES = [
  "Crypto",
  "EuFootball",
  "Finance",
  "Golf",
  "IPL",
  "MLB",
  "NBA",
  "NHL",
  "Politics",
  "UFC",
] as const;

export type WagerCategory = (typeof WAGER_CATEGORIES)[number];

export const WAGER_TYPES = ["private", "public", "jackpot"] as const;
export type WagerType = (typeof WAGER_TYPES)[number];

export async function createNewWager(
  request: CreateWagerRequest
): Promise<WagerResponse> {
  try {
    // Validate required fields
    if (
      !request.creator_telegram_user_id ||
      !request.category ||
      !request.name ||
      !request.description ||
      !request.side_1 ||
      !request.side_2 ||
      !request.wager_end_time ||
      !request.wager_type
    ) {
      return {
        success: false,
        error: "All required fields must be provided",
      };
    }

    // Validate category
    if (!WAGER_CATEGORIES.includes(request.category as WagerCategory)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${WAGER_CATEGORIES.join(
          ", "
        )}`,
      };
    }

    // Validate wager type
    if (!WAGER_TYPES.includes(request.wager_type as WagerType)) {
      return {
        success: false,
        error: `Invalid wager type. Must be one of: ${WAGER_TYPES.join(", ")}`,
      };
    }

    // Validate wager end time (must be in the future)
    const now = new Date();
    const endTime = new Date(request.wager_end_time);
    if (endTime <= now) {
      return {
        success: false,
        error: "Wager end time must be in the future",
      };
    }

    // Create the wager
    const wager = await createWagerInDB(request);

    console.log(`✅ Created new wager: ${wager.name} (ID: ${wager.id})`);

    return {
      success: true,
      data: wager,
    };
  } catch (error: any) {
    console.error("Error creating wager:", error);
    return {
      success: false,
      error: error.message || "Failed to create wager",
    };
  }
}

export async function getWagers(category?: string): Promise<WagerResponse> {
  try {
    let wagers: Wager[];

    if (category) {
      if (!WAGER_CATEGORIES.includes(category as WagerCategory)) {
        return {
          success: false,
          error: `Invalid category. Must be one of: ${WAGER_CATEGORIES.join(
            ", "
          )}`,
        };
      }
      wagers = await getWagersByCategoryFromDB(category);
    } else {
      wagers = await getAllWagersFromDB();
    }

    return {
      success: true,
      data: wagers,
    };
  } catch (error: any) {
    console.error("Error getting wagers:", error);
    return {
      success: false,
      error: error.message || "Failed to get wagers",
    };
  }
}

export async function getWager(wagerId: number): Promise<WagerResponse> {
  try {
    if (!wagerId || wagerId <= 0) {
      return {
        success: false,
        error: "Invalid wager ID",
      };
    }

    const wager = await getWagerByIdFromDB(wagerId);

    if (!wager) {
      return {
        success: false,
        error: "Wager not found",
      };
    }

    return {
      success: true,
      data: wager,
    };
  } catch (error: any) {
    console.error("Error getting wager:", error);
    return {
      success: false,
      error: error.message || "Failed to get wager",
    };
  }
}

export function validateWagerEndTime(dateTimeString: string): {
  isValid: boolean;
  error?: string;
  parsedDate?: Date;
} {
  try {
    // Parse the date string (format: MM-DD-YY HHMM AM/PM)
    // Example: "5-23-25 10pm" -> May 23, 2025 10:00 PM
    const parsedDate = new Date(dateTimeString);

    if (isNaN(parsedDate.getTime())) {
      return {
        isValid: false,
        error:
          "Invalid date format. Please type like this: MM-DD-YY HHMM AM/PM",
      };
    }

    const now = new Date();
    if (parsedDate <= now) {
      return {
        isValid: false,
        error: "Wager end time must be in the future",
      };
    }

    return {
      isValid: true,
      parsedDate,
    };
  } catch (error) {
    return {
      isValid: false,
      error: "Invalid date format. Please type like this: MM-DD-YY HHMM AM/PM",
    };
  }
}

// Database functions
async function createWagerInDB(request: CreateWagerRequest): Promise<Wager> {
  const dbConnection = await getConnection();

  try {
    // First, ensure the wagers table exists
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS wagers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        creator_telegram_user_id BIGINT NOT NULL,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        image_url VARCHAR(500),
        side_1 VARCHAR(50) NOT NULL,
        side_2 VARCHAR(50) NOT NULL,
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
        INDEX idx_created_at (created_at)
      )
    `);

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

async function getAllWagersFromDB(): Promise<Wager[]> {
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

async function getWagerByIdFromDB(wagerId: number): Promise<Wager | null> {
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

async function getWagersByCategoryFromDB(category: string): Promise<Wager[]> {
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
