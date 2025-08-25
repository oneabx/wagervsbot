import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { getConnection } from "./SolanaService";
import { updateWalletBalance } from "../models/WalletModel";
import { TOKEN_MULTIPLIER } from "../config/token";

const VS_TOKEN_MINT_ADDRESS =
  process.env.VS_TOKEN_MINT_ADDRESS ||
  "7SGrxHJFwNcsjkeu5WqZZKpB1b8LayWZLtrEEtBYhLjW";

interface WalletBalance {
  sol_amount: number;
  vs_token_amount: number;
}

const connection = getConnection();

export async function startMonitoring(
  publicKey: string,
  telegramUserId: number
): Promise<void> {
  try {
    const walletPubkey = new PublicKey(publicKey);

    await updateWalletBalances(publicKey, telegramUserId);

    const subscriptionId = connection.onAccountChange(
      walletPubkey,
      async (accountInfo: AccountInfo<Buffer>) => {
        console.log(`💰 SOL balance change detected for wallet: ${publicKey}`);
        await updateWalletBalances(publicKey, telegramUserId);
      },
      "confirmed"
    );

    try {
      const tokenMint = new PublicKey(VS_TOKEN_MINT_ADDRESS);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        walletPubkey
      );

      const tokenSubscriptionId = connection.onAccountChange(
        tokenAccount,
        async (accountInfo: AccountInfo<Buffer>) => {
          console.log(
            `🪙 VS token balance change detected for wallet: ${publicKey}`
          );
          await updateWalletBalances(publicKey, telegramUserId);
        },
        "confirmed"
      );
    } catch (tokenError) {
      console.log(`⚠️ No VS token account found for wallet: ${publicKey}`);
    }

    console.log(
      `✅ Started monitoring wallet: ${publicKey} for user: ${telegramUserId}`
    );
  } catch (error) {
    console.error(
      `❌ Error starting balance monitoring for wallet ${publicKey}:`,
      error
    );
    throw error;
  }
}

export async function getWalletBalances(
  publicKey: string
): Promise<WalletBalance> {
  try {
    const walletPubkey = new PublicKey(publicKey);

    const solBalance = await connection.getBalance(walletPubkey);
    const solAmount = solBalance / 1e9;

    let vsTokenAmount = 0;
    try {
      const tokenMint = new PublicKey(VS_TOKEN_MINT_ADDRESS);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        walletPubkey
      );

      try {
        const accountInfo = await getAccount(connection, tokenAccount);
        vsTokenAmount = Number(accountInfo.amount) / TOKEN_MULTIPLIER;
      } catch (accountError) {
        console.log(`⚠️ Token account not found for wallet: ${publicKey}`);
      }
    } catch (tokenError) {
      console.log(`⚠️ No VS token account found for wallet: ${publicKey}`);
    }

    return {
      sol_amount: solAmount,
      vs_token_amount: vsTokenAmount,
    };
  } catch (error) {
    console.error(`❌ Error getting balances for wallet ${publicKey}:`, error);
    throw error;
  }
}

async function updateWalletBalances(
  publicKey: string,
  telegramUserId: number
): Promise<void> {
  try {
    const balances = await getWalletBalances(publicKey);

    await updateWalletBalance(
      telegramUserId,
      balances.sol_amount,
      balances.vs_token_amount
    );

    console.log(
      `📊 Updated balances for wallet ${publicKey}: 💰 SOL=${balances.sol_amount},  VS=${balances.vs_token_amount}`
    );
  } catch (error) {
    console.error(`❌ Error updating balances for wallet ${publicKey}:`, error);
    throw error;
  }
}
