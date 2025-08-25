import axios from "axios";

interface CoinGeckoResponse {
  solana: {
    usd: number;
  };
}

interface PriceData {
  solPrice: number;
  lastUpdated: number;
}

let cachedPrice: PriceData | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getSolPrice(): Promise<number> {
  try {
    if (cachedPrice && Date.now() - cachedPrice.lastUpdated < CACHE_DURATION) {
      console.log(`💰 Using cached SOL price: $${cachedPrice.solPrice}`);
      return cachedPrice.solPrice;
    }

    const response = await axios.get<CoinGeckoResponse>(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      {
        timeout: 10000,
        headers: {
          Accept: "application/json",
          "User-Agent": "wager-ts-bot/1.0",
        },
      }
    );

    const solPrice = response.data.solana.usd;

    if (!solPrice || solPrice <= 0) {
      throw new Error("Invalid SOL price received from CoinGecko");
    }

    cachedPrice = {
      solPrice,
      lastUpdated: Date.now(),
    };

    console.log(`💰 Fetched SOL price from CoinGecko: $${solPrice}`);
    return solPrice;
  } catch (error: any) {
    console.error("Error fetching SOL price from CoinGecko:", error.message);

    if (cachedPrice) {
      console.log(`⚠️ Using stale cached SOL price: $${cachedPrice.solPrice}`);
      return cachedPrice.solPrice;
    }

    console.log("⚠️ Using fallback SOL price: $100");
    return 100;
  }
}

export async function calculatePaymentAmount(
  tokenAmount: number,
  currency: string
): Promise<{ paymentAmount: number; solPrice?: number; totalUsd: number }> {
  const VS_TOKEN_PRICE_USD = 2 * Math.pow(10, -5);
  const totalUsd = tokenAmount * VS_TOKEN_PRICE_USD;

  if (currency.toLowerCase() === "sol") {
    const solPrice = await getSolPrice();
    const paymentAmount = totalUsd / solPrice;

    return {
      paymentAmount,
      solPrice,
      totalUsd,
    };
  } else if (currency.toLowerCase() === "usdc") {
    return {
      paymentAmount: totalUsd,
      totalUsd,
    };
  } else {
    throw new Error("Unsupported currency");
  }
}
