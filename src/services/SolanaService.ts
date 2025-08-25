import { Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";

let connection: Connection;

export function getConnection(): Connection {
  if (!connection) {
    // connection = new Connection(
    //   "https://mainnet.helius-rpc.com/?api-key=f0f55f22-248c-4b87-9a33-a2a67483ca9e",
    //   "confirmed"
    // );
    connection = new Connection("https://api.devnet.solana.com", "confirmed");
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
    const adminWalletPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
    if (!adminWalletPrivateKey) {
      throw new Error("ADMIN_WALLET_PRIVATE_KEY not found in environment");
    }

    const privateKeyBytes = bs58.decode(adminWalletPrivateKey);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    const publicKey = keypair.publicKey.toBase58();

    console.log(`🔑 Admin public key derived: ${publicKey}`);
    return publicKey;
  } catch (error) {
    console.error("Error deriving admin public key:", error);
    throw new Error("Failed to derive admin public key");
  }
}
