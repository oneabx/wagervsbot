import * as dotenv from "dotenv";
import { startBot } from "./services/telegramService";
import { initializeBalanceMonitoring } from "./services/StartupService";

// Load environment variables
dotenv.config();

// Check for required environment variables
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN is not set in environment variables");
  process.exit(1);
}

async function initializeApp() {
  try {
    console.log("🎲 Wager Bot is starting...");

    await initializeBalanceMonitoring();

    startBot(token as string);

    console.log("📱 Bot initialized successfully");
    console.log("🚀 Ready to handle wager requests!");
  } catch (error) {
    console.error("❌ Failed to initialize application:", error);
    process.exit(1);
  }
}

initializeApp();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down Wager Bot...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down Wager Bot...");
  process.exit(0);
});
