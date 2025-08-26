import {
  createNewWager,
  validateWagerEndTime,
  WAGER_CATEGORIES,
  WAGER_TYPES,
} from "../controllers/WagerController";
import { CreateWagerRequest } from "../models/WagerModel";

export interface WagerCreationState {
  telegramUserId: number;
  step: WagerCreationStep;
  data: Partial<CreateWagerRequest>;
}

export type WagerCreationStep =
  | "selecting_type"
  | "selecting_category"
  | "entering_name"
  | "entering_description"
  | "entering_side_1"
  | "entering_side_2"
  | "entering_image"
  | "entering_end_time"
  | "reviewing"
  | "completed";

const wagerCreationStates = new Map<number, WagerCreationState>();

export function initializeWagerCreation(
  telegramUserId: number,
  wagerType: "private" | "public"
): WagerCreationState {
  const state: WagerCreationState = {
    telegramUserId,
    step: "selecting_category",
    data: {
      creator_telegram_user_id: telegramUserId,
      wager_type: wagerType,
    },
  };

  wagerCreationStates.set(telegramUserId, state);
  return state;
}

export function getWagerCreationState(
  telegramUserId: number
): WagerCreationState | null {
  return wagerCreationStates.get(telegramUserId) || null;
}

export function updateWagerCreationState(
  telegramUserId: number,
  updates: Partial<WagerCreationState>
): WagerCreationState | null {
  const state = wagerCreationStates.get(telegramUserId);
  if (!state) return null;

  const updatedState = { ...state, ...updates };
  wagerCreationStates.set(telegramUserId, updatedState);
  return updatedState;
}

export function clearWagerCreationState(telegramUserId: number): void {
  wagerCreationStates.delete(telegramUserId);
}

export function getCategoriesList(): string {
  return WAGER_CATEGORIES.map((cat, index) => `${index + 1}. /${cat}`).join(
    "\n"
  );
}

export function getWagerTypesList(): string {
  return WAGER_TYPES.map((type, index) => `${index + 1}. ${type}`).join("\n");
}

export function processWagerCreationStep(
  telegramUserId: number,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState | null;
} {
  const state = getWagerCreationState(telegramUserId);
  if (!state) {
    return {
      success: false,
      message: "No wager creation session found. Please start over.",
    };
  }

  try {
    switch (state.step) {
      case "selecting_category":
        return processCategorySelection(state, userInput);

      case "entering_name":
        return processNameEntry(state, userInput);

      case "entering_description":
        return processDescriptionEntry(state, userInput);

      case "entering_side_1":
        return processSide1Entry(state, userInput);

      case "entering_side_2":
        return processSide2Entry(state, userInput);

      case "entering_image":
        return processImageEntry(state, userInput);

      case "entering_end_time":
        return processEndTimeEntry(state, userInput);

      default:
        return {
          success: false,
          message: "Invalid step in wager creation process.",
        };
    }
  } catch (error) {
    console.error("Error processing wager creation step:", error);
    return {
      success: false,
      message: "An error occurred. Please try again.",
    };
  }
}

function processCategorySelection(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const category = userInput.replace("/", "").trim();

  if (!WAGER_CATEGORIES.includes(category as any)) {
    return {
      success: false,
      message: `Invalid category. Please choose from:\n${getCategoriesList()}`,
    };
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "entering_name",
    data: { ...state.data, category },
  });

  return {
    success: true,
    message: "✅ Category selected! Now, what is the name of your wager?",
    nextStep: "entering_name",
    state: updatedState!,
  };
}

function processNameEntry(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const name = userInput.trim();

  if (name.length < 3 || name.length > 100) {
    return {
      success: false,
      message:
        "Wager name must be between 3 and 100 characters. Please try again.",
    };
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "entering_description",
    data: { ...state.data, name },
  });

  return {
    success: true,
    message: "✅ Name set! Now, what is the description of your wager?",
    nextStep: "entering_description",
    state: updatedState!,
  };
}

function processDescriptionEntry(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const description = userInput.trim();

  if (description.length < 10 || description.length > 500) {
    return {
      success: false,
      message:
        "Description must be between 10 and 500 characters. Please try again.",
    };
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "entering_side_1",
    data: { ...state.data, description },
  });

  return {
    success: true,
    message: "✅ Description set! Now, what is Side 1?",
    nextStep: "entering_side_1",
    state: updatedState!,
  };
}

function processSide1Entry(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const side_1 = userInput.trim();

  if (side_1.length < 1 || side_1.length > 50) {
    return {
      success: false,
      message: "Side 1 must be between 1 and 50 characters. Please try again.",
    };
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "entering_side_2",
    data: { ...state.data, side_1 },
  });

  return {
    success: true,
    message: "✅ Side 1 set! Now, what is Side 2?",
    nextStep: "entering_side_2",
    state: updatedState!,
  };
}

function processSide2Entry(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const side_2 = userInput.trim();

  if (side_2.length < 1 || side_2.length > 50) {
    return {
      success: false,
      message: "Side 2 must be between 1 and 50 characters. Please try again.",
    };
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "entering_image",
    data: { ...state.data, side_2 },
  });

  return {
    success: true,
    message: "✅ Side 2 set! Now, paste an image URL (or type /no to skip):",
    nextStep: "entering_image",
    state: updatedState!,
  };
}

function processImageEntry(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const imageInput = userInput.trim();
  let image_file_id: string | undefined;

  if (imageInput.toLowerCase() === "/no") {
    image_file_id = undefined;
  } else if (imageInput.startsWith("http")) {
    image_file_id = imageInput;
  } else {
    image_file_id = imageInput;
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "entering_end_time",
    data: { ...state.data, image_file_id },
  });

  return {
    success: true,
    message:
      "✅ Image set! Now, what date/time (EST) will the wager end?\nExample: 5-12-25 10pm",
    nextStep: "entering_end_time",
    state: updatedState!,
  };
}

function processEndTimeEntry(
  state: WagerCreationState,
  userInput: string
): {
  success: boolean;
  message: string;
  nextStep?: WagerCreationStep;
  state?: WagerCreationState;
} {
  const validation = validateWagerEndTime(userInput);

  if (!validation.isValid) {
    return {
      success: false,
      message: validation.error || "Invalid date format. Please try again.",
    };
  }

  const updatedState = updateWagerCreationState(state.telegramUserId, {
    step: "reviewing",
    data: { ...state.data, wager_end_time: validation.parsedDate! },
  });

  const reviewMessage = generateWagerReviewMessage(updatedState!);

  return {
    success: true,
    message: reviewMessage,
    nextStep: "reviewing",
    state: updatedState!,
  };
}

function generateWagerReviewMessage(state: WagerCreationState): string {
  const data = state.data;

  return `📋 **Your Wager Review**

🏷️ **Name:** ${data.name}
📂 **Category:** ${data.category}
📝 **Description:** ${data.description}
⚔️ **Side 1:** ${data.side_1}
⚔️ **Side 2:** ${data.side_2}
🖼️ **Image:** ${data.image_file_id ? "Yes" : "No"}
⏰ **End Time:** ${data.wager_end_time?.toLocaleString()}
🎯 **Type:** ${data.wager_type}

Is this correct? Type /confirm to create the wager or /cancel to start over.`;
}

export async function finalizeWagerCreation(telegramUserId: number): Promise<{
  success: boolean;
  message: string;
  wagerId?: number;
}> {
  const state = getWagerCreationState(telegramUserId);
  if (!state || state.step !== "reviewing") {
    return {
      success: false,
      message: "No wager to finalize. Please start over.",
    };
  }

  try {
    const result = await createNewWager(state.data as CreateWagerRequest);

    if (result.success) {
      clearWagerCreationState(telegramUserId);
      return {
        success: true,
        message: `🎉 Wager created successfully!\n\nID: ${result.data.id}\nName: ${result.data.name}\n\nYour wager is now live!`,
        wagerId: result.data.id,
      };
    } else {
      return {
        success: false,
        message: `❌ Failed to create wager: ${result.error}`,
      };
    }
  } catch (error) {
    console.error("Error finalizing wager creation:", error);
    return {
      success: false,
      message: "An error occurred while creating the wager. Please try again.",
    };
  }
}
