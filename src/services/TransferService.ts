import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { getConnection, getAdminPublicKey } from "./SolanaService";
import {
  TOKEN_MULTIPLIER,
  USDC_MULTIPLIER,
  VS_TOKEN_MINT_ADDRESS,
  ADMIN_WALLET_PRIVATE_KEY,
} from "../config";
import bs58 from "bs58";

const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

async function validateWalletBalance(
  connection: Connection,
  keypair: Keypair,
  amount: number,
  isSOL: boolean = true
): Promise<boolean> {
  try {
    if (isSOL) {
      const balance = await connection.getBalance(keypair.publicKey);
      return balance >= Math.floor(amount * LAMPORTS_PER_SOL);
    } else {
      const tokenMint = new PublicKey(USDC_MINT_ADDRESS);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        keypair.publicKey
      );
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      return (
        Number(accountInfo.value.amount) >=
        Math.floor(amount * TOKEN_MULTIPLIER)
      );
    }
  } catch (error) {
    console.error("Error validating wallet balance:", error);
    return false;
  }
}

function keypairFromBase64(base64Key: string): Keypair {
  const secret = Buffer.from(base64Key, "base64");
  return Keypair.fromSecretKey(secret);
}

export async function transferSOL(
  fromPrivateKey: string,
  toPublicKey: string,
  amount: number
): Promise<TransferResult> {
  try {
    if (amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    if (!Number.isFinite(amount) || amount > 1000000) {
      return { success: false, error: "Invalid amount specified" };
    }

    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    console.log(`🔢 Converting ${amount} SOL to ${lamports} lamports`);

    const connection = getConnection();
    const fromKeypair = keypairFromBase64(fromPrivateKey);
    const toPubkey = new PublicKey(toPublicKey);

    const hasBalance = await validateWalletBalance(
      connection,
      fromKeypair,
      amount,
      true
    );
    if (!hasBalance) {
      return { success: false, error: "Insufficient SOL balance" };
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPubkey,
        lamports: lamports,
      })
    );

    const signature = await connection.sendTransaction(transaction, [
      fromKeypair,
    ]);
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`💰 SOL transfer successful: ${signature}`);
    return { success: true, signature };
  } catch (error: any) {
    console.error("Error transferring SOL:", error);
    return { success: false, error: error.message || "SOL transfer failed" };
  }
}

export async function transferUSDC(
  fromPrivateKey: string,
  toPublicKey: string,
  amount: number
): Promise<TransferResult> {
  try {
    if (amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    if (!Number.isFinite(amount) || amount > 1000000000) {
      return { success: false, error: "Invalid amount specified" };
    }

    const tokenAmount = Math.floor(amount * USDC_MULTIPLIER);
    console.log(`🔢 Converting ${amount} USDC to ${tokenAmount} token units`);

    const connection = getConnection();
    const fromKeypair = keypairFromBase64(fromPrivateKey);
    const toPubkey = new PublicKey(toPublicKey);
    const usdcMint = new PublicKey(USDC_MINT_ADDRESS);

    const fromTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      fromKeypair.publicKey
    );
    const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

    const hasBalance = await validateWalletBalance(
      connection,
      fromKeypair,
      amount,
      false
    );
    if (!hasBalance) {
      return { success: false, error: "Insufficient USDC balance" };
    }

    const transaction = new Transaction();

    try {
      await connection.getAccountInfo(toTokenAccount);
    } catch {
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        fromKeypair.publicKey,
        toTokenAccount,
        toPubkey,
        usdcMint
      );
      transaction.add(createAccountInstruction);
    }

    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromKeypair.publicKey,
      tokenAmount
    );

    transaction.add(transferInstruction);

    const signature = await connection.sendTransaction(transaction, [
      fromKeypair,
    ]);
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`💵 USDC transfer successful: ${signature}`);
    return { success: true, signature };
  } catch (error: any) {
    console.error("Error transferring USDC:", error);
    return { success: false, error: error.message || "USDC transfer failed" };
  }
}

export async function getVSTokenBalance(
  walletPublicKey: string
): Promise<{ success: boolean; balance?: number; error?: string }> {
  try {
    const connection = getConnection();
    const walletPubkey = new PublicKey(walletPublicKey);
    const vsTokenMint = new PublicKey(VS_TOKEN_MINT_ADDRESS);

    const tokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      walletPubkey
    );

    try {
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      const balance = Number(accountInfo.value.amount) / TOKEN_MULTIPLIER;

      return {
        success: true,
        balance: balance,
      };
    } catch (error) {
      return {
        success: false,
        error: "No VS token account found",
      };
    }
  } catch (error: any) {
    console.error("Error getting VS token balance:", error);
    return {
      success: false,
      error: error.message || "Failed to get VS token balance",
    };
  }
}

export async function getSideWalletVSTokenBalance(
  sideWalletAddress: string
): Promise<number> {
  try {
    const balanceResult = await getVSTokenBalance(sideWalletAddress);
    if (balanceResult.success) {
      return balanceResult.balance!;
    } else {
      console.log(
        `No VS token account found for side wallet: ${sideWalletAddress}`
      );
      return 0;
    }
  } catch (error) {
    console.error("Error getting side wallet VS token balance:", error);
    return 0;
  }
}

export async function transferVSTokensFromUser(
  fromPrivateKey: string,
  toPublicKey: string,
  amount: number
): Promise<TransferResult> {
  try {
    if (amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    if (!Number.isFinite(amount) || amount > 1000000000) {
      return { success: false, error: "Invalid amount specified" };
    }

    const tokenAmount = Math.floor(amount * TOKEN_MULTIPLIER);
    console.log(
      `🔢 Converting ${amount} VS token to ${tokenAmount} token units`
    );

    const connection = getConnection();
    const fromKeypair = keypairFromBase64(fromPrivateKey);
    const toPubkey = new PublicKey(toPublicKey);
    const vsTokenMint = new PublicKey(VS_TOKEN_MINT_ADDRESS);

    console.log(`🔍 Checking token accounts...`);
    console.log(`From wallet: ${fromKeypair.publicKey.toString()}`);
    console.log(`To wallet: ${toPubkey.toString()}`);
    console.log(`VS Token Mint: ${vsTokenMint.toString()}`);

    const fromTokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      fromKeypair.publicKey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      toPubkey
    );

    console.log(`From token account: ${fromTokenAccount.toString()}`);
    console.log(`To token account: ${toTokenAccount.toString()}`);

    const transaction = new Transaction();

    try {
      const fromAccountInfo = await connection.getAccountInfo(fromTokenAccount);
      if (!fromAccountInfo) {
        console.log(
          `❌ From token account does not exist: ${fromTokenAccount.toString()}`
        );
        return {
          success: false,
          error:
            "Your wallet does not have VS token. Please buy VS token first.",
        };
      }
      console.log(`✅ From token account exists`);
    } catch (error) {
      console.log(`❌ Error checking from token account: ${error}`);
      return {
        success: false,
        error: "Your wallet does not have VS token. Please buy VS token first.",
      };
    }

    try {
      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      if (!toAccountInfo) {
        console.log(
          `📝 Creating destination token account: ${toTokenAccount.toString()}`
        );
        const createAccountInstruction =
          createAssociatedTokenAccountInstruction(
            fromKeypair.publicKey,
            toTokenAccount,
            toPubkey,
            vsTokenMint
          );
        transaction.add(createAccountInstruction);
      } else {
        console.log(`✅ Destination token account exists`);
      }
    } catch (error) {
      console.log(
        `📝 Creating destination token account (caught error): ${toTokenAccount.toString()}`
      );
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        fromKeypair.publicKey,
        toTokenAccount,
        toPubkey,
        vsTokenMint
      );
      transaction.add(createAccountInstruction);
    }

    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromKeypair.publicKey,
      tokenAmount
    );

    transaction.add(transferInstruction);

    console.log(`🚀 Sending transaction...`);
    const signature = await connection.sendTransaction(transaction, [
      fromKeypair,
    ]);

    console.log(`⏳ Confirming transaction: ${signature}`);
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`🪙 VS Token transfer from user successful: ${signature}`);
    return { success: true, signature };
  } catch (error: any) {
    console.error("Error transferring VS token from user:", error);

    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }

    return {
      success: false,
      error: error.message || "VS token transfer failed",
    };
  }
}

export async function transferVSTokens(
  toPublicKey: string,
  amount: number
): Promise<TransferResult> {
  try {
    if (amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    if (!Number.isFinite(amount) || amount > 1000000000) {
      return { success: false, error: "Invalid amount specified" };
    }

    const tokenAmount = Math.floor(amount * TOKEN_MULTIPLIER);
    console.log(
      `🔢 Converting ${amount} VS token to ${tokenAmount} token units`
    );

    const connection = getConnection();

    if (!ADMIN_WALLET_PRIVATE_KEY) {
      return { success: false, error: "Admin private key not found" };
    }

    const adminKeypair = Keypair.fromSecretKey(
      bs58.decode(ADMIN_WALLET_PRIVATE_KEY)
    );
    const toPubkey = new PublicKey(toPublicKey);
    const vsTokenMint = new PublicKey(VS_TOKEN_MINT_ADDRESS);

    const adminTokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      adminKeypair.publicKey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      toPubkey
    );

    const transaction = new Transaction();

    // Check if the recipient's token account exists
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);

    if (!toTokenAccountInfo) {
      // Token account doesn't exist, create it first
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        adminKeypair.publicKey,
        toTokenAccount,
        toPubkey,
        vsTokenMint
      );
      transaction.add(createAccountInstruction);
    }

    const transferInstruction = createTransferInstruction(
      adminTokenAccount,
      toTokenAccount,
      adminKeypair.publicKey,
      tokenAmount
    );

    transaction.add(transferInstruction);

    const signature = await connection.sendTransaction(transaction, [
      adminKeypair,
    ]);
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`🪙 VS Token transfer successful: ${signature}`);
    return { success: true, signature };
  } catch (error: any) {
    console.error("Error transferring VS token:", error);
    return {
      success: false,
      error: error.message || "VS token transfer failed",
    };
  }
}

export async function processTokenPurchase(
  userPrivateKey: string,
  userPublicKey: string,
  paymentAmount: number,
  paymentCurrency: string,
  vsTokenAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userPrivateKey || !userPublicKey) {
      return { success: false, error: "Invalid wallet credentials" };
    }

    if (paymentAmount <= 0 || vsTokenAmount <= 0) {
      return { success: false, error: "Invalid amounts" };
    }

    const adminPublicKey = getAdminPublicKey();
    let paymentResult: TransferResult;

    if (paymentCurrency === "sol") {
      paymentResult = await transferSOL(
        userPrivateKey,
        adminPublicKey,
        paymentAmount
      );
    } else if (paymentCurrency === "usdc") {
      paymentResult = await transferUSDC(
        userPrivateKey,
        adminPublicKey,
        paymentAmount
      );
    } else {
      return { success: false, error: "Unsupported payment currency" };
    }

    if (!paymentResult.success) {
      return {
        success: false,
        error: `Payment failed: ${paymentResult.error}`,
      };
    }

    const tokenResult = await transferVSTokens(userPublicKey, vsTokenAmount);

    if (!tokenResult.success) {
      return {
        success: false,
        error: `Token transfer failed: ${tokenResult.error}`,
      };
    }

    console.log(
      `✅ Complete transaction successful: Payment ${paymentResult.signature}, Token ${tokenResult.signature}`
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error processing token purchase:", error);
    return {
      success: false,
      error: error.message || "Transaction processing failed",
    };
  }
}
