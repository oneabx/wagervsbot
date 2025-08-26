import {
  createWager as createWagerInDB,
  getAllWagers as getAllWagersFromDB,
  getWagerById as getWagerByIdFromDB,
  getWagersByCategory as getWagersByCategoryFromDB,
  updateWagerStatus,
  Wager,
  CreateWagerRequest,
} from "../models/WagerModel";
import { Keypair } from "@solana/web3.js";

export interface WagerResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const WAGER_CATEGORIES = [
  "Crypto",
  "EuFootball",
  "Finance",
  "Golf",
  "IPL",
  "MLB",
  "NBA",
  "NHL",
  "Politics",
  "UFC",
] as const;

export type WagerCategory = (typeof WAGER_CATEGORIES)[number];

export const WAGER_TYPES = ["private", "public", "jackpot"] as const;
export type WagerType = (typeof WAGER_TYPES)[number];

export async function createNewWager(
  request: CreateWagerRequest
): Promise<WagerResponse> {
  try {
    if (
      !request.creator_telegram_user_id ||
      !request.category ||
      !request.name ||
      !request.description ||
      !request.side_1 ||
      !request.side_2 ||
      !request.wager_end_time ||
      !request.wager_type
    ) {
      return {
        success: false,
        error: "All required fields must be provided",
      };
    }

    if (!WAGER_CATEGORIES.includes(request.category as WagerCategory)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${WAGER_CATEGORIES.join(
          ", "
        )}`,
      };
    }

    if (!WAGER_TYPES.includes(request.wager_type as WagerType)) {
      return {
        success: false,
        error: `Invalid wager type. Must be one of: ${WAGER_TYPES.join(", ")}`,
      };
    }

    const now = new Date();
    const endTime = new Date(request.wager_end_time);
    if (endTime <= now) {
      return {
        success: false,
        error: "Wager end time must be in the future",
      };
    }

    const side1Wallet = Keypair.generate();
    const side2Wallet = Keypair.generate();

    const wagerRequest = {
      ...request,
      side_1_wallet_address: side1Wallet.publicKey.toString(),
      side_2_wallet_address: side2Wallet.publicKey.toString(),
    };

    const wager = await createWagerInDB(wagerRequest);

    return {
      success: true,
      data: wager,
    };
  } catch (error: any) {
    console.error("Error creating wager:", error);
    return {
      success: false,
      error: error.message || "Failed to create wager",
    };
  }
}

export async function getWagers(category?: string): Promise<WagerResponse> {
  try {
    let wagers: Wager[];

    if (category) {
      if (!WAGER_CATEGORIES.includes(category as WagerCategory)) {
        return {
          success: false,
          error: `Invalid category. Must be one of: ${WAGER_CATEGORIES.join(
            ", "
          )}`,
        };
      }
      wagers = await getWagersByCategoryFromDB(category);
    } else {
      wagers = await getAllWagersFromDB();
    }

    return {
      success: true,
      data: wagers,
    };
  } catch (error: any) {
    console.error("Error getting wagers:", error);
    return {
      success: false,
      error: error.message || "Failed to get wagers",
    };
  }
}

export async function getWager(wagerId: number): Promise<WagerResponse> {
  try {
    if (!wagerId || wagerId <= 0) {
      return {
        success: false,
        error: "Invalid wager ID",
      };
    }

    const wager = await getWagerByIdFromDB(wagerId);

    if (!wager) {
      return {
        success: false,
        error: "Wager not found",
      };
    }

    return {
      success: true,
      data: wager,
    };
  } catch (error: any) {
    console.error("Error getting wager:", error);
    return {
      success: false,
      error: error.message || "Failed to get wager",
    };
  }
}

export function validateWagerEndTime(dateTimeString: string): {
  isValid: boolean;
  error?: string;
  parsedDate?: Date;
} {
  try {
    const parsedDate = new Date(dateTimeString);

    if (isNaN(parsedDate.getTime())) {
      return {
        isValid: false,
        error:
          "Invalid date format. Please type like this: MM-DD-YY HHMM AM/PM",
      };
    }

    const now = new Date();
    if (parsedDate <= now) {
      return {
        isValid: false,
        error: "Wager end time must be in the future",
      };
    }

    return {
      isValid: true,
      parsedDate,
    };
  } catch (error) {
    return {
      isValid: false,
      error: "Invalid date format. Please type like this: MM-DD-YY HHMM AM/PM",
    };
  }
}
