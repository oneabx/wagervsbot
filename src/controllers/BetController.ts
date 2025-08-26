import {
  createBet as createBetInDB,
  getBetsByWager as getBetsByWagerFromDB,
  getTotalPoolAmount as getTotalPoolAmountFromDB,
  updateWagerPoolAmount,
  getBetsByUser as getBetsByUserFromDB,
  getBetById,
  Bet,
  CreateBetRequest,
} from "../models/BetModel";

export interface BetResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function createBet(
  request: CreateBetRequest
): Promise<BetResponse> {
  try {
    // Validate required fields
    if (
      !request.wager_id ||
      !request.user_telegram_id ||
      !request.side ||
      !request.amount
    ) {
      return {
        success: false,
        error: "All required fields must be provided",
      };
    }

    // Validate amount
    if (request.amount <= 0) {
      return {
        success: false,
        error: "Bet amount must be greater than 0",
      };
    }

    // Create the bet
    const bet = await createBetInDB(request);

    // Update wager total pool amount
    await updateWagerPoolAmount(request.wager_id);

    console.log(`✅ Created new bet: ${bet.id} for wager ${bet.wager_id}`);

    return {
      success: true,
      data: bet,
    };
  } catch (error: any) {
    console.error("Error creating bet:", error);
    return {
      success: false,
      error: error.message || "Failed to create bet",
    };
  }
}

export async function getBetsByWager(wagerId: number): Promise<BetResponse> {
  try {
    if (!wagerId || wagerId <= 0) {
      return {
        success: false,
        error: "Invalid wager ID",
      };
    }

    const bets = await getBetsByWagerFromDB(wagerId);

    return {
      success: true,
      data: bets,
    };
  } catch (error: any) {
    console.error("Error getting bets:", error);
    return {
      success: false,
      error: error.message || "Failed to get bets",
    };
  }
}

export async function getBetsByUser(
  userTelegramId: number
): Promise<BetResponse> {
  try {
    if (!userTelegramId || userTelegramId <= 0) {
      return {
        success: false,
        error: "Invalid user ID",
      };
    }

    const bets = await getBetsByUserFromDB(userTelegramId);

    return {
      success: true,
      data: bets,
    };
  } catch (error: any) {
    console.error("Error getting user bets:", error);
    return {
      success: false,
      error: error.message || "Failed to get user bets",
    };
  }
}

export async function getBet(betId: number): Promise<BetResponse> {
  try {
    if (!betId || betId <= 0) {
      return {
        success: false,
        error: "Invalid bet ID",
      };
    }

    const bet = await getBetById(betId);

    if (!bet) {
      return {
        success: false,
        error: "Bet not found",
      };
    }

    return {
      success: true,
      data: bet,
    };
  } catch (error: any) {
    console.error("Error getting bet:", error);
    return {
      success: false,
      error: error.message || "Failed to get bet",
    };
  }
}

export async function getTotalPoolAmount(wagerId: number): Promise<number> {
  try {
    return await getTotalPoolAmountFromDB(wagerId);
  } catch (error) {
    console.error("Error getting total pool amount:", error);
    return 0;
  }
}
