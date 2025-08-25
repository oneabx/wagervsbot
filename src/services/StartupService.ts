import { startMonitoring } from "./BalanceMonitorService";
import { getAllWallets } from "../models/WalletModel";

export async function initializeBalanceMonitoring(): Promise<void> {
  try {
    console.log("Initializing balance monitoring for existing wallets...");

    const wallets = await getAllWallets();

    for (const wallet of wallets) {
      try {
        await startMonitoring(
          wallet.wallet_public_key,
          wallet.telegram_user_id
        );
      } catch (error) {
        console.error(
          `Failed to start monitoring wallet ${wallet.wallet_public_key}:`,
          error
        );
      }
    }

    console.log(`Balance monitoring initialized for ${wallets.length} wallets`);
  } catch (error) {
    console.error("Error initializing balance monitoring:", error);
    throw error;
  }
}
