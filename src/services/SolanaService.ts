import { Keypair, Connection } from "@solana/web3.js";
import { SOLANA_RPC_URL, ADMIN_WALLET_PRIVATE_KEY } from "../config";
import bs58 from "bs58";

let connection: Connection;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(SOLANA_RPC_URL, "confirmed");
    console.log(`🔗 Connected to Solana RPC: ${SOLANA_RPC_URL}`);
  }
  return connection;
}

export function createWallet(): { publicKey: string; privateKey: string } {
  try {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);

    return {
      publicKey,
      privateKey,
    };
  } catch (error) {
    console.error("Error creating Solana wallet:", error);
    throw new Error("Failed to create Solana wallet");
  }
}

export function getAdminPublicKey(): string {
  try {
    if (!ADMIN_WALLET_PRIVATE_KEY) {
      throw new Error("ADMIN_WALLET_PRIVATE_KEY not found in environment");
    }

    const privateKeyBytes = bs58.decode(ADMIN_WALLET_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    const publicKey = keypair.publicKey.toBase58();

    console.log(`🔑 Admin public key derived: ${publicKey}`);
    return publicKey;
  } catch (error) {
    console.error("Error deriving admin public key:", error);
    throw new Error("Failed to derive admin public key");
  }
}
