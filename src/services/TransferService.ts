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
import { TOKEN_MULTIPLIER, USDC_MULTIPLIER } from "../config/token";
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

    // Validate amount is a reasonable number
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

    // Validate amount is a reasonable number
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

export async function transferVSTokens(
  toPublicKey: string,
  amount: number
): Promise<TransferResult> {
  try {
    if (amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    // Validate amount is a reasonable number
    if (!Number.isFinite(amount) || amount > 1000000000) {
      return { success: false, error: "Invalid amount specified" };
    }

    const tokenAmount = Math.floor(amount * TOKEN_MULTIPLIER);
    console.log(
      `🔢 Converting ${amount} VS tokens to ${tokenAmount} token units`
    );

    const connection = getConnection();
    const adminPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;

    if (!adminPrivateKey) {
      return { success: false, error: "Admin private key not found" };
    }

    const adminKeypair = Keypair.fromSecretKey(bs58.decode(adminPrivateKey));
    const toPubkey = new PublicKey(toPublicKey);
    const vsTokenMint = new PublicKey(
      process.env.VS_TOKEN_MINT_ADDRESS ||
        "7SGrxHJFwNcsjkeu5WqZZKpB1b8LayWZLtrEEtBYhLjW"
    );

    const adminTokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      adminKeypair.publicKey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      vsTokenMint,
      toPubkey
    );

    const transaction = new Transaction();

    try {
      await connection.getAccountInfo(toTokenAccount);
    } catch {
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
    console.error("Error transferring VS tokens:", error);
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
      `✅ Complete transaction successful: Payment ${paymentResult.signature}, Tokens ${tokenResult.signature}`
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
