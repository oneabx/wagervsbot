import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

export interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  return {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wager_bot",
    port: parseInt(process.env.DB_PORT || "3306"),
  };
};

export const createDatabaseConnection = async () => {
  const config = getDatabaseConfig();

  try {
    const connection = await mysql.createConnection(config);
    console.log("✅ Database connected successfully");
    return connection;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};
