import * as dotenv from "dotenv";
import { startBot } from "./services/telegramService";
import { initializeBalanceMonitoring } from "./services/StartupService";
import { TELEGRAM_BOT_TOKEN } from "./config";

dotenv.config();

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set in environment variables");
  process.exit(1);
}

async function initializeApp() {
  try {
    console.log("🎲 Wager Bot is starting...");

    await initializeBalanceMonitoring();

    startBot(TELEGRAM_BOT_TOKEN!);

    console.log("📱 Bot initialized successfully");
    console.log("🚀 Ready to handle wager requests!");
  } catch (error) {
    console.error("❌ Failed to initialize application:", error);
    process.exit(1);
  }
}

initializeApp();

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down Wager Bot...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down Wager Bot...");
  process.exit(0);
});
