import TelegramBot = require("node-telegram-bot-api");
import {
  createWallet,
  getWalletBalance,
  walletExists,
  buyTokens,
  getWagers,
  getWager,
  transferVSTokenToSideWallet,
  getTotalAmountBySide,
  getWalletByTelegramId,
} from "../controllers";
import { calculatePaymentAmount } from "./PriceService";
import {
  initializeWagerCreation,
  processWagerCreationStep,
  finalizeWagerCreation,
  clearWagerCreationState,
  getCategoriesList,
  getWagerCreationState,
} from "./WagerCreationService";
import {
  getVSTokenBalance,
  transferVSTokens,
} from "../services/TransferService";
import { createDatabaseConnection } from "../config/database";
import {
  updateExpiredWagers,
  getEndedWagersWithoutWinner,
  updateWagerWinningSide,
} from "../models/WagerModel";
import { getAllUsers, getAllUsersWithWallets } from "../models/WalletModel";

let bot: TelegramBot;

function setupEventHandlers(): void {
  bot.onText(/\/start/, handleStart);
  bot.onText(/\/help/, handleHelp);
  bot.onText(/\/balance/, handleBalance);
  bot.onText(/\/token_balance/, handleTokenBalance);
  bot.onText(/\/createwallet/, handleCreateWallet);
  bot.onText(/\/buy (\d+) (sol|usdc)/, handleBuyTokens);

  bot.onText(/\/createwager/, handleCreateWager);
  bot.onText(/\/private/, handlePrivateWager);
  bot.onText(/\/public/, handlePublicWager);
  bot.onText(/\/cancel/, handleCancelWager);
  bot.onText(/\/confirm/, handleConfirmWager);

  bot.onText(/\/show_wagers/, handleShowWagers);
  bot.onText(/\/check_winners/, handleCheckWinners);
  bot.onText(/\/airdrop/, handleDailyAirdrop);

  bot.on("callback_query", handleCallbackQuery);

  bot.on("message", handleMessage);
}

async function setupBotMenu(): Promise<void> {
  try {
    await bot.setMyCommands([
      {
        command: "start",
        description: "🚀 Start the bot and see available commands",
      },
      {
        command: "help",
        description: "📖 Get help and instructions",
      },
      {
        command: "createwallet",
        description: "🔐 Create a new Solana wallet",
      },
      {
        command: "balance",
        description: "💰 Check your wallet balance (database)",
      },
      {
        command: "token_balance",
        description: "🔗 Check your token balance",
      },
      {
        command: "buy",
        description: "🪙 Buy VS token (amount currency)",
      },
      {
        command: "createwager",
        description: "🎲 Create a new wager",
      },
      {
        command: "show_wagers",
        description: "📋 View all active wagers",
      },
      {
        command: "check_winners",
        description: "🏆 Check wagers needing winner determination",
      },
      {
        command: "airdrop",
        description: "🎁 Trigger daily airdrop (admin)",
      },
    ]);

    await bot.setChatMenuButton({
      menu_button: {
        type: "commands",
      },
    });

    console.log("✅ Bot menu and commands set successfully!");
  } catch (error) {
    console.error("❌ Error setting up bot menu:", error);
  }
}

function handleStart(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || "User";

  const welcomeMessage = `Hello ${firstName}! 👋

🎲 <b>Wager VS Bot</b>

<b>Main Commands:</b>
• /createwager - Create a new wager (private or public)
• /show_wagers - View all active wagers
• /createwallet - Create a Solana wallet
• /balance - Check your wallet balance (database)
• /token_balance - Check your token balance
• /buy [amount] [currency] - Buy VS token

<b>Wager Types:</b>
• 🔒 Private: FREE - Settle disputes between friends
• 🌐 Public: 0.15 SOL - Public to all users

<b>Supported Currencies:</b>
• SOL - Solana (dynamic pricing)
• USDC - USD Coin (1:1 USD)

💰 <b>VS Token Price:</b> $0.000002 USD

Type /help for detailed instructions!`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "HTML",
  });
}

async function handleHelp(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  const helpMessage = `🤖 <b>Wager Bot Help</b>

<b>Available Commands:</b>
• /start - Start the bot and see available commands
• /help - Get help and instructions
• /show_wagers - View all active wagers
• /createwallet - Create a Solana wallet
• /balance - Check your wallet balance (database)
• /token_balance - Check your token balance
• /buy [amount] [currency] - Buy VS token

<b>Wager Commands:</b>
• /createwager - Create a new wager
• /private - Create a private wager
• /public - Create a public wager
• /cancel - Cancel wager creation
• /confirm - Confirm and save wager

<b>How to Use:</b>
1. Create a wallet with /createwallet
2. Buy VS token with /buy [amount] [currency]
3. Create wagers with /createwager
4. View wagers with /show_wagers
5. Place bets by clicking side buttons

<b>Pool Amounts:</b>
💰 Pool amounts show real VS token balances
🔗 Use /token_balance to check your actual token balance

<b>Supported Currencies:</b>
• SOL - Solana
• USDC - USD Coin

Need help? Contact support!`;

  bot.sendMessage(chatId, helpMessage, { parse_mode: "HTML" });
}

async function handleBalance(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user");
    return;
  }

  try {
    const balanceResponse = await getWalletBalance(telegramUserId);

    if (balanceResponse.success && balanceResponse.sol_amount !== undefined) {
      const solAmount = Number(balanceResponse.sol_amount);
      const vsTokenAmount = Number(balanceResponse.vs_token_amount || 0);

      const message =
        `💰 <b>Wallet Balance (Database)</b>\n\n` +
        `SOL: <b>${solAmount.toFixed(9)}</b>\n` +
        `VS Token: <b>${vsTokenAmount.toFixed(9)}</b>`;

      bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } else {
      bot.sendMessage(
        chatId,
        "❌ No wallet found. Use /createwallet to create one."
      );
    }
  } catch (error) {
    console.error("Error handling balance command:", error);
    bot.sendMessage(chatId, "❌ Error retrieving wallet balance");
  }
}

async function handleTokenBalance(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user");
    return;
  }

  try {
    const wallet = await getWalletByTelegramId(telegramUserId);

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet found. Use /createwallet to create one."
      );
      return;
    }

    const vsTokenBalance = await getVSTokenBalance(wallet.wallet_public_key);

    if (vsTokenBalance.success) {
      const message =
        `🔗 <b>Token Balance</b>\n\n` +
        `VS Token: <b>${vsTokenBalance.balance!.toFixed(9)}</b>\n\n` +
        `💡 <i>This shows your actual VS token balance.</i>`;

      bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } else {
      const message =
        `🔗 <b>Token Balance</b>\n\n` +
        `VS Token: <b>0.000000000</b>\n\n` +
        `💡 <i>No VS token account found. You need to buy VS token first.</i>`;

      bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Error handling token balance command:", error);
    bot.sendMessage(chatId, "❌ Error retrieving token balance");
  }
}

async function handleCreateWallet(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user");
    return;
  }

  try {
    const walletExistsResult = await walletExists(telegramUserId);

    if (walletExistsResult) {
      bot.sendMessage(chatId, "❌ Wallet already exists for this user");
      return;
    }

    const walletResponse = await createWallet({
      telegram_user_id: telegramUserId,
    });

    if (walletResponse.success && walletResponse.data) {
      const message =
        `✅ <b>Wallet Created Successfully!</b>\n\n` +
        `Public Key: <code>${walletResponse.data.wallet_public_key}</code>\n\n` +
        `Your wallet is ready to use! Use /balance to check your balance.`;

      bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } else {
      bot.sendMessage(
        chatId,
        `❌ Failed to create wallet: ${walletResponse.error}`
      );
    }
  } catch (error) {
    console.error("Error handling create wallet command:", error);
    bot.sendMessage(chatId, "❌ Error creating wallet");
  }
}

async function handleBuyTokens(
  msg: TelegramBot.Message,
  match: RegExpExecArray | null
): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user");
    return;
  }

  if (!match || !match[1] || !match[2]) {
    const helpMessage = `❌ Please specify token amount and currency type.

📝 Format: /buy [token_amount] [currency_type]

💡 Examples:
• /buy 100000 sol
• /buy 50000 usdc

💰 Price: 1 VS Token = $0.000002 (2×10⁻⁶ USD)`;

    bot.sendMessage(chatId, helpMessage, { parse_mode: "HTML" });
    return;
  }

  const vsTokenAmount = parseInt(match[1]);
  const paymentCurrency = match[2].toLowerCase();

  if (isNaN(vsTokenAmount) || vsTokenAmount <= 0) {
    bot.sendMessage(
      chatId,
      "❌ Please enter a valid positive number for VS token amount"
    );
    return;
  }

  if (!["sol", "usdc"].includes(paymentCurrency)) {
    const formatMessage = `❌ Invalid currency type.

💡 Valid currencies:
• /buy 100000 sol
• /buy 50000 usdc`;

    bot.sendMessage(chatId, formatMessage, { parse_mode: "HTML" });
    return;
  }

  let priceData;
  try {
    priceData = await calculatePaymentAmount(vsTokenAmount, paymentCurrency);
  } catch (error) {
    bot.sendMessage(
      chatId,
      "❌ Error calculating payment amount. Please try again."
    );
    return;
  }

  const { paymentAmount, solPrice, totalUsd } = priceData;

  let priceInfo = `💰 Total Price: $${totalUsd.toFixed(6)} USD\n`;
  if (solPrice) {
    priceInfo += `📈 SOL Price: $${solPrice.toFixed(2)} USD\n`;
  }

  const processingMessage = await bot.sendMessage(
    chatId,
    `⏳ <b>Processing transaction...</b>\n\n` +
      `🪙 Amount: ${vsTokenAmount.toLocaleString()} VS token\n` +
      priceInfo +
      `💳 Payment: ${paymentAmount.toFixed(
        6
      )} ${paymentCurrency.toUpperCase()}\n\n` +
      `Please wait while we process your payment and send tokens.`,
    { parse_mode: "HTML" }
  );

  try {
    const buyResponse = await buyTokens({
      telegram_user_id: telegramUserId,
      vs_token_amount: vsTokenAmount,
      payment_amount: paymentAmount,
      payment_currency: paymentCurrency,
    });

    if (buyResponse.success && buyResponse.data) {
      let successPriceInfo = `💰 Total Price: <b>$${totalUsd.toFixed(
        6
      )} USD</b>\n`;
      if (solPrice) {
        successPriceInfo += `📈 SOL Price: <b>$${solPrice.toFixed(
          2
        )} USD</b>\n`;
      }

      const successMessage =
        `✅ <b>VS Token Purchase Completed!</b>\n\n` +
        `🪙 Amount: <b>${vsTokenAmount.toLocaleString()} VS token</b>\n` +
        successPriceInfo +
        `💳 Payment: <b>${paymentAmount.toFixed(
          6
        )} ${paymentCurrency.toUpperCase()}</b>\n\n` +
        `🎉 <b>Transaction successful!</b>\n` +
        `Your VS token has been sent to your wallet.\n\n` +
        `💼 Wallet: <code>${buyResponse.data.user_wallet}</code>`;

      await bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: processingMessage.message_id,
        parse_mode: "HTML",
      });
    } else {
      const errorMessage = `❌ <b>Transaction Failed</b>\n\n${buyResponse.error}`;
      await bot.editMessageText(errorMessage, {
        chat_id: chatId,
        message_id: processingMessage.message_id,
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("Error handling buy tokens command:", error);
    const errorMessage =
      "❌ <b>System Error</b>\n\nAn unexpected error occurred. Please try again later.";
    await bot.editMessageText(errorMessage, {
      chat_id: chatId,
      message_id: processingMessage.message_id,
      parse_mode: "HTML",
    });
  }
}

// Wager Creation Handlers
function handleCreateWager(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;

  const message = `🎲 **Create a New Wager**

**Lets Create a New Event!**

• 50% Revenue Share

**Private Wager**: FREE - Settle a dispute between friends
**Public Wager**: 0.15 SOL - Public to all users. Sends notification to all groups with @wagervsbot

Choose your wager type:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "🌐 Public",
          callback_data: "wager_public",
        },
        {
          text: "🔒 Private",
          callback_data: "wager_private",
        },
      ],
    ],
  };

  bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: inlineKeyboard,
  });
}

function handlePrivateWager(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user. Please try again.");
    return;
  }

  // Initialize wager creation for private type
  initializeWagerCreation(telegramUserId, "private");

  const message = `✅ **Private Wager Selected**

Choose a category for your wager:

${getCategoriesList()}

Type the category (e.g., /Crypto, /NBA) or /cancel to stop.`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

function handlePublicWager(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user. Please try again.");
    return;
  }

  // Initialize wager creation for public type
  initializeWagerCreation(telegramUserId, "public");

  const message = `✅ **Public Wager Selected** (0.15 SOL)

Choose a category for your wager:

${getCategoriesList()}

Type the category (e.g., /Crypto, /NBA) or /cancel to stop.`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

function handleCancelWager(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user. Please try again.");
    return;
  }

  // Clear any existing wager creation state
  clearWagerCreationState(telegramUserId);

  bot.sendMessage(
    chatId,
    "❌ Wager creation cancelled. Type /createwager to start over."
  );
}

async function handleConfirmWager(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user. Please try again.");
    return;
  }

  try {
    // Finalize wager creation
    const result = await finalizeWagerCreation(telegramUserId);

    if (result.success) {
      bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, result.message);
    }
  } catch (error) {
    console.error("Error confirming wager:", error);
    bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

async function handleMessage(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;
  const text = msg.text;

  if (!telegramUserId) {
    return;
  }

  // Check if user is in betting state first (highest priority)
  const bettingState = getBettingState(telegramUserId);
  if (bettingState) {
    await handleBettingMessage(msg);
    return;
  }

  // Check if user is in wager creation state
  const wagerState = getWagerCreationState(telegramUserId);
  if (wagerState) {
    await handleWagerCreationMessage(msg);
    return;
  }

  // If not in any state and it's not a command, ignore the message
  // This prevents unwanted processing of random text
  if (!text || !text.startsWith("/")) {
    return;
  }
}

// Handle show wagers command
async function handleShowWagers(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const result = await getWagers();

    if (!result.success) {
      bot.sendMessage(chatId, `❌ Error: ${result.error}`);
      return;
    }

    const wagers = result.data || [];

    if (wagers.length === 0) {
      bot.sendMessage(chatId, "📭 No active wagers found.");
      return;
    }

    // Create inline keyboard with wager buttons
    const inlineKeyboard = {
      inline_keyboard: wagers.map((wager: any) => [
        {
          text: `🎲 ${wager.name} (${wager.category})`,
          callback_data: `view_wager_${wager.id}`,
        },
      ]),
    };

    const message = `📋 **Active Wagers** (${wagers.length} total)

Click on a wager to view details:`;

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard,
    });
  } catch (error) {
    console.error("Error showing wagers:", error);
    bot.sendMessage(chatId, "❌ An error occurred while fetching wagers.");
  }
}

// Handle wager view callback
async function handleWagerView(
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) {
    return;
  }

  try {
    // Answer the callback query to remove loading state
    await bot.answerCallbackQuery(callbackQuery.id);

    // Extract wager ID from callback data
    const wagerId = parseInt(data.replace("view_wager_", ""));

    if (isNaN(wagerId)) {
      bot.sendMessage(chatId, "❌ Invalid wager ID.");
      return;
    }

    const result = await getWager(wagerId);

    if (!result.success) {
      bot.sendMessage(chatId, `❌ Error: ${result.error}`);
      return;
    }

    const wager = result.data;

    // Get real-time pool amounts for both sides
    const side1Amount = await getTotalAmountBySide(wager.id, "side_1");
    const side2Amount = await getTotalAmountBySide(wager.id, "side_2");
    const totalPoolAmount = side1Amount + side2Amount;

    // Check if wager has ended
    const now = new Date();
    const endTime = new Date(wager.wager_end_time);
    const isExpired = endTime <= now;
    const statusText = isExpired ? "🕐 Ended" : "🟢 Active";

    // Check if winner has been determined
    const winnerText = wager.winning_side
      ? `🏆 <b>Winner:</b> ${
          wager.winning_side === "side_1" ? wager.side_1 : wager.side_2
        }`
      : isExpired
      ? "⏳ <b>Winner:</b> Pending determination"
      : "";

    // Create wager details message
    const wagerMessage = `🎲 <b>${wager.name}</b>

📂 <b>Category:</b> ${wager.category}
📝 <b>Description:</b> ${wager.description}
🎯 <b>Type:</b> ${wager.wager_type === "private" ? "🔒 Private" : "🌐 Public"}
⏰ <b>Ends:</b> ${endTime.toLocaleString()}
💰 <b>Total Pool:</b> ${totalPoolAmount} VS token
📊 <b>Side 1 Pool:</b> ${side1Amount} VS token
📊 <b>Side 2 Pool:</b> ${side2Amount} VS token
📊 <b>Status:</b> ${statusText}
🆔 <b>ID:</b> ${wager.id}
${winnerText ? `\n${winnerText}` : ""}

${
  isExpired
    ? "🕐 <b>This wager has ended. No more bets can be placed.</b>"
    : "<b>Transfer VS token to place your bet:</b>"
}`;

    // Create inline keyboard for betting (only if wager is active)
    const bettingKeyboard = isExpired
      ? undefined
      : {
          inline_keyboard: [
            [
              {
                text: `🎯 ${wager.side_1}`,
                callback_data: `bet_side1_${wager.id}`,
              },
              {
                text: `🎯 ${wager.side_2}`,
                callback_data: `bet_side2_${wager.id}`,
              },
            ],
          ],
        };

    // Send wager details
    if (wager.image_file_id && isValidTelegramFileId(wager.image_file_id)) {
      try {
        // Use file_id directly for sending photo
        await bot.sendPhoto(chatId, wager.image_file_id, {
          caption: wagerMessage,
          parse_mode: "HTML",
          reply_markup: bettingKeyboard,
        });
      } catch (photoError) {
        console.error("Error sending photo with file_id:", photoError);

        // Fallback to text-only
        bot.sendMessage(chatId, wagerMessage, {
          parse_mode: "HTML",
          reply_markup: bettingKeyboard,
        });
      }
    } else {
      // Send without image
      bot.sendMessage(chatId, wagerMessage, {
        parse_mode: "HTML",
        reply_markup: bettingKeyboard,
      });
    }
  } catch (error: any) {
    console.error("Error viewing wager:", error);

    // Send a more specific error message based on the error type
    if (error.message && error.message.includes("400")) {
      bot.sendMessage(
        chatId,
        "❌ Error: Invalid image URL in wager. Showing text-only version."
      );
    } else {
      bot.sendMessage(chatId, "❌ An error occurred while viewing the wager.");
    }
  }
}

// Helper function to validate Telegram file_id
function isValidTelegramFileId(fileId: string): boolean {
  if (!fileId || fileId.trim() === "") {
    return false;
  }

  // Telegram file_ids are typically long strings with underscores
  // They should be at least 20 characters and contain underscores
  return fileId.length >= 20 && fileId.includes("_") && !fileId.includes(" ");
}

// Helper function to validate and clean image URLs
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") {
    return false;
  }

  try {
    // Check if it's a valid URL
    const urlObj = new URL(url);

    // Check if it's an HTTP/HTTPS URL
    if (!urlObj.protocol.startsWith("http")) {
      return false;
    }

    // Accept any valid HTTP/HTTPS URL - let Telegram handle image validation
    return true;
  } catch (error) {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
}

// Helper function to clean image URL for display
function cleanImageUrl(url: string): string | null {
  if (!url || url.trim() === "") {
    return null;
  }

  // Remove any whitespace
  const cleanedUrl = url.trim();

  // Check if it's a valid URL format
  if (!isValidImageUrl(cleanedUrl)) {
    return null;
  }

  return cleanedUrl;
}

// Helper function to check if URL is a Telegram file URL
function isTelegramFileUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === "api.telegram.org" &&
      urlObj.pathname.includes("/file/bot") &&
      urlObj.pathname.includes("/photos/")
    );
  } catch (error) {
    return false;
  }
}

// In-memory storage for betting states
interface BettingState {
  telegramUserId: number;
  wagerId: number;
  side: "side_1" | "side_2";
  sideName: string;
}

const bettingStates = new Map<number, BettingState>();

// Betting state management functions
function setBettingState(telegramUserId: number, state: BettingState): void {
  bettingStates.set(telegramUserId, state);
}

function getBettingState(telegramUserId: number): BettingState | null {
  return bettingStates.get(telegramUserId) || null;
}

function clearBettingState(telegramUserId: number): void {
  bettingStates.delete(telegramUserId);
}

// Handle betting callback queries
async function handleBettingCallback(
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  const telegramUserId = callbackQuery.from?.id;

  if (!chatId || !data || !telegramUserId) {
    return;
  }

  try {
    await bot.answerCallbackQuery(callbackQuery.id);

    if (data.startsWith("bet_side1_") || data.startsWith("bet_side2_")) {
      const wagerId = parseInt(
        data.replace("bet_side1_", "").replace("bet_side2_", "")
      );
      const side = data.startsWith("bet_side1_") ? "side_1" : "side_2";

      if (isNaN(wagerId)) {
        bot.sendMessage(chatId, "❌ Invalid wager ID.");
        return;
      }

      // Get wager details
      const result = await getWager(wagerId);
      if (!result.success) {
        bot.sendMessage(chatId, `❌ Error: ${result.error}`);
        return;
      }

      const wager = result.data;

      // Check if wager has ended
      const now = new Date();
      const endTime = new Date(wager.wager_end_time);
      if (endTime <= now) {
        bot.sendMessage(
          chatId,
          "🕐 <b>This wager has ended. No more bets can be placed.</b>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const sideName = side === "side_1" ? wager.side_1 : wager.side_2;

      // Set betting state
      setBettingState(telegramUserId, {
        telegramUserId,
        wagerId,
        side,
        sideName,
      });

      bot.sendMessage(
        chatId,
        `🎯 <b>Betting on: ${sideName}</b>\n\n💰 Enter the amount of VS token you want to transfer:`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("Error handling betting callback:", error);
    bot.sendMessage(chatId, "❌ An error occurred while processing your bet.");
  }
}

// Handle betting amount input
async function handleBettingMessage(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;
  const text = msg.text;

  if (!telegramUserId || !text) {
    return;
  }

  // Check if user is in betting state
  const bettingState = getBettingState(telegramUserId);
  if (!bettingState) {
    return; // Not in betting state, let other handlers process
  }

  // Check if it's a command (skip betting processing for commands)
  if (text.startsWith("/")) {
    return;
  }

  try {
    const amount = parseFloat(text);

    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(
        chatId,
        "❌ Please enter a valid positive number for VS token."
      );
      return;
    }

    // Get wager details to get the wallet address
    const wagerResult = await getWager(bettingState.wagerId);
    if (!wagerResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Failed to get wager details: ${wagerResult.error}`
      );
      clearBettingState(telegramUserId);
      return;
    }

    const wager = wagerResult.data;

    // Check if wager has ended
    const now = new Date();
    const endTime = new Date(wager.wager_end_time);
    if (endTime <= now) {
      bot.sendMessage(
        chatId,
        "🕐 <b>This wager has ended. No more bets can be placed.</b>",
        { parse_mode: "HTML" }
      );
      clearBettingState(telegramUserId);
      return;
    }

    const walletAddress =
      bettingState.side === "side_1"
        ? wager.side_1_wallet_address
        : wager.side_2_wallet_address;

    // Transfer VS token to side wallet
    const transferResult = await transferVSTokenToSideWallet({
      wagerId: bettingState.wagerId,
      userTelegramId: telegramUserId,
      side: bettingState.side,
      walletAddress: walletAddress,
      amount: amount,
    });

    if (!transferResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Failed to transfer VS token: ${transferResult.error}`
      );
      clearBettingState(telegramUserId);
      return;
    }

    // Get updated pool amounts
    const updatedSide1Amount = await getTotalAmountBySide(
      bettingState.wagerId,
      "side_1"
    );
    const updatedSide2Amount = await getTotalAmountBySide(
      bettingState.wagerId,
      "side_2"
    );
    const updatedTotalPoolAmount = updatedSide1Amount + updatedSide2Amount;

    const message = `✅ <b>VS Token Transfer Successful!</b>

🎯 <b>Side:</b> ${bettingState.sideName}
💰 <b>Amount:</b> ${amount} VS token
🎲 <b>Wager ID:</b> ${bettingState.wagerId}
🏆 <b>Transaction ID:</b> ${transferResult.data.transaction.id}
🔗 <b>Solana TX:</b> ${transferResult.data.transactionHash}
🏦 <b>Wallet:</b> ${walletAddress}
💳 <b>New Balance:</b> ${transferResult.data.newUserBalance} VS token

💰 <b>Updated Pool:</b> ${updatedTotalPoolAmount} VS token
📊 <b>Side 1:</b> ${updatedSide1Amount} VS token
📊 <b>Side 2:</b> ${updatedSide2Amount} VS token

Your VS token has been transferred to the side wallet!`;

    bot.sendMessage(chatId, message, { parse_mode: "HTML" });

    // Clear betting state
    clearBettingState(telegramUserId);
  } catch (error) {
    console.error("Error processing betting amount:", error);
    bot.sendMessage(chatId, "❌ An error occurred while processing your bet.");
    clearBettingState(telegramUserId);
  }
}

// Handle wager creation messages
async function handleWagerCreationMessage(
  msg: TelegramBot.Message
): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;
  const text = msg.text;

  if (!telegramUserId) {
    return;
  }

  // Handle photo messages (images)
  if (msg.photo && msg.photo.length > 0) {
    try {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      const fileId = largestPhoto.file_id;

      // Validate the file_id with Telegram API
      const fileInfo = await getFileInfo(fileId);
      if (!fileInfo.success) {
        bot.sendMessage(
          chatId,
          "❌ Invalid image file. Please try uploading again or type /no to skip."
        );
        return;
      }

      const result = await processWagerCreationStep(telegramUserId, fileId);

      if (result.success) {
        bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, result.message);
      }
    } catch (error) {
      console.error("Error processing photo:", error);
      bot.sendMessage(
        chatId,
        "❌ Error processing image. Please try again or type /no to skip."
      );
    }
    return;
  }

  // Handle document uploads (images sent as files)
  if (msg.document) {
    try {
      const fileId = msg.document.file_id;
      const mimeType = msg.document.mime_type || "";

      // Check if it's an image file
      if (mimeType.startsWith("image/")) {
        // Validate the file_id with Telegram API
        const fileInfo = await getFileInfo(fileId);
        if (!fileInfo.success) {
          bot.sendMessage(
            chatId,
            "❌ Invalid image file. Please try uploading again or type /no to skip."
          );
          return;
        }

        const result = await processWagerCreationStep(telegramUserId, fileId);

        if (result.success) {
          bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        } else {
          bot.sendMessage(chatId, result.message);
        }
      } else {
        bot.sendMessage(
          chatId,
          "❌ Please upload an image file (JPG, PNG, GIF, etc.). Other file types are not supported."
        );
      }
    } catch (error) {
      console.error("Error processing document:", error);
      bot.sendMessage(
        chatId,
        "❌ Error processing file. Please try again or type /no to skip."
      );
    }
    return;
  }

  // Handle video uploads (for GIFs or video thumbnails)
  if (msg.video) {
    try {
      const fileId = msg.video.file_id;

      // Validate the file_id with Telegram API
      const fileInfo = await getFileInfo(fileId);
      if (!fileInfo.success) {
        bot.sendMessage(
          chatId,
          "❌ Invalid video file. Please try uploading again or type /no to skip."
        );
        return;
      }

      const result = await processWagerCreationStep(telegramUserId, fileId);

      if (result.success) {
        bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, result.message);
      }
    } catch (error) {
      console.error("Error processing video:", error);
      bot.sendMessage(
        chatId,
        "❌ Error processing video. Please try again or type /no to skip."
      );
    }
    return;
  }

  // Handle animation uploads (GIFs)
  if (msg.animation) {
    try {
      const fileId = msg.animation.file_id;

      // Validate the file_id with Telegram API
      const fileInfo = await getFileInfo(fileId);
      if (!fileInfo.success) {
        bot.sendMessage(
          chatId,
          "❌ Invalid animation file. Please try uploading again or type /no to skip."
        );
        return;
      }

      const result = await processWagerCreationStep(telegramUserId, fileId);

      if (result.success) {
        bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, result.message);
      }
    } catch (error) {
      console.error("Error processing animation:", error);
      bot.sendMessage(
        chatId,
        "❌ Error processing animation. Please try again or type /no to skip."
      );
    }
    return;
  }

  // If no text and no media, ignore the message
  if (!text) {
    return;
  }

  // Check if this is a category command
  const categoryMatch = text.match(
    /^\/(Crypto|EuFootball|Finance|Golf|IPL|MLB|NBA|NHL|Politics|UFC)$/i
  );

  if (categoryMatch) {
    try {
      const result = await processWagerCreationStep(telegramUserId, text);
      if (result.success) {
        bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, result.message);
      }
    } catch (error) {
      console.error("Error processing category selection:", error);
      bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
    }
    return;
  }

  // Skip if it's any other command
  if (text.startsWith("/")) {
    return;
  }

  try {
    const result = await processWagerCreationStep(telegramUserId, text);
    if (result.success) {
      bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, result.message);
    }
  } catch (error) {
    console.error("Error processing wager creation step:", error);
  }
}

// Update the main callback query handler to include betting
async function handleCallbackQuery(
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const data = callbackQuery.data;

  if (!data) {
    return;
  }

  // Handle betting callbacks
  if (data.startsWith("bet_side1_") || data.startsWith("bet_side2_")) {
    await handleBettingCallback(callbackQuery);
    return;
  }

  // Handle wager viewing callbacks
  if (data.startsWith("view_wager_")) {
    await handleWagerView(callbackQuery);
    return;
  }

  // Handle wager creation callbacks
  if (data === "wager_private" || data === "wager_public") {
    const chatId = callbackQuery.message?.chat.id;
    const telegramUserId = callbackQuery.from?.id;

    if (!chatId || !telegramUserId) {
      return;
    }

    try {
      await bot.answerCallbackQuery(callbackQuery.id);

      const wagerType = data === "wager_private" ? "private" : "public";
      const state = initializeWagerCreation(telegramUserId, wagerType);

      const message = `🎲 <b>Creating ${wagerType} wager...</b>

📂 <b>Choose a category:</b>

${getCategoriesList()}`;

      bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Error handling wager creation callback:", error);
      bot.sendMessage(
        chatId,
        "❌ An error occurred while starting wager creation."
      );
    }
  }

  // Handle winner determination callbacks
  if (data.startsWith("winner_side1_") || data.startsWith("winner_side2_")) {
    await handleWinnerDeterminationCallback(callbackQuery);
    return;
  }

  // Handle check winner callbacks
  if (data.startsWith("check_winner_")) {
    await handleCheckWinnerCallback(callbackQuery);
    return;
  }
}

// Function to get file info from Telegram API
async function getFileInfo(
  fileId: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const fileInfo = await bot.getFile(fileId);
    return {
      success: true,
      filePath: fileInfo.file_path,
    };
  } catch (error) {
    console.error(`Error getting file info for ${fileId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Function to clean up invalid file_ids in database
async function cleanupInvalidFileIds(): Promise<void> {
  try {
    const dbConnection = await createDatabaseConnection();

    // First, get all wagers with image_file_id
    const [rows] = await dbConnection.execute(
      "SELECT id, image_file_id FROM wagers WHERE image_file_id IS NOT NULL"
    );

    let cleanedCount = 0;

    for (const row of rows as any[]) {
      const fileId = row.image_file_id;

      // Check if it's a URL (keep those)
      if (fileId.startsWith("http")) {
        continue;
      }

      // Check if it looks like a valid file_id
      if (!isValidTelegramFileId(fileId)) {
        // Update to NULL
        await dbConnection.execute(
          "UPDATE wagers SET image_file_id = NULL WHERE id = ?",
          [row.id]
        );
        cleanedCount++;
        continue;
      }

      // Validate with Telegram API
      try {
        const fileInfo = await getFileInfo(fileId);
        if (!fileInfo.success) {
          // File doesn't exist on Telegram, remove it
          await dbConnection.execute(
            "UPDATE wagers SET image_file_id = NULL WHERE id = ?",
            [row.id]
          );
          cleanedCount++;
        }
      } catch (error) {
        // Error validating file, remove it
        await dbConnection.execute(
          "UPDATE wagers SET image_file_id = NULL WHERE id = ?",
          [row.id]
        );
        cleanedCount++;
      }
    }

    await dbConnection.end();
  } catch (error) {
    console.error("Error cleaning up invalid file_ids:", error);
  }
}

// Function to check and update expired wagers
async function checkExpiredWagers(): Promise<void> {
  try {
    const expiredCount = await updateExpiredWagers();
    if (expiredCount > 0) {
      console.log(
        `🕐 Updated ${expiredCount} expired wagers to 'ended' status`
      );
    }
  } catch (error) {
    console.error("Error checking expired wagers:", error);
  }
}

// Schedule expired wager checks and winner determination (every 5 minutes)
function scheduleExpiredWagerChecks(): void {
  setInterval(async () => {
    await checkExpiredWagers();
    await checkWagersNeedingWinnerDetermination();
  }, 5 * 60 * 1000); // 5 minutes
}

// Winner determination state management
interface WinnerDeterminationState {
  telegramUserId: number;
  wagerId: number;
  wagerName: string;
  side1: string;
  side2: string;
}

const winnerDeterminationStates = new Map<number, WinnerDeterminationState>();

function setWinnerDeterminationState(
  telegramUserId: number,
  state: WinnerDeterminationState
): void {
  winnerDeterminationStates.set(telegramUserId, state);
}

function getWinnerDeterminationState(
  telegramUserId: number
): WinnerDeterminationState | null {
  return winnerDeterminationStates.get(telegramUserId) || null;
}

function clearWinnerDeterminationState(telegramUserId: number): void {
  winnerDeterminationStates.delete(telegramUserId);
}

// Function to check for wagers that need winner determination
async function checkWagersNeedingWinnerDetermination(): Promise<void> {
  try {
    const wagersNeedingWinner = await getEndedWagersWithoutWinner();

    for (const wager of wagersNeedingWinner) {
      // Ask the wager creator to determine the winner
      await askWagerCreatorForWinner(wager);
    }
  } catch (error) {
    console.error("Error checking wagers needing winner determination:", error);
  }
}

// Function to ask wager creator for winner determination
async function askWagerCreatorForWinner(wager: any): Promise<void> {
  try {
    const message = `🏆 <b>Winner Determination Required</b>

🎲 <b>Wager:</b> ${wager.name}
📂 <b>Category:</b> ${wager.category}
⏰ <b>Ended:</b> ${new Date(wager.wager_end_time).toLocaleString()}

💰 <b>Total Pool:</b> ${wager.total_pool_amount || 0} VS token

<b>Please determine the winner:</b>`;

    const winnerKeyboard = {
      inline_keyboard: [
        [
          {
            text: `🏆 ${wager.side_1} (Side 1)`,
            callback_data: `winner_side1_${wager.id}`,
          },
          {
            text: `🏆 ${wager.side_2} (Side 2)`,
            callback_data: `winner_side2_${wager.id}`,
          },
        ],
      ],
    };

    await bot.sendMessage(wager.creator_telegram_user_id, message, {
      parse_mode: "HTML",
      reply_markup: winnerKeyboard,
    });
  } catch (error) {
    console.error(
      `Error asking creator ${wager.creator_telegram_user_id} for winner determination:`,
      error
    );
  }
}

// Handle winner determination callback
async function handleWinnerDeterminationCallback(
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  const telegramUserId = callbackQuery.from?.id;

  if (!chatId || !data || !telegramUserId) {
    return;
  }

  try {
    await bot.answerCallbackQuery(callbackQuery.id);

    if (data.startsWith("winner_side1_") || data.startsWith("winner_side2_")) {
      const wagerId = parseInt(
        data.replace("winner_side1_", "").replace("winner_side2_", "")
      );
      const winningSide = data.startsWith("winner_side1_")
        ? "side_1"
        : "side_2";

      if (isNaN(wagerId)) {
        bot.sendMessage(chatId, "❌ Invalid wager ID.");
        return;
      }

      // Update the winning side in the database
      const success = await updateWagerWinningSide(wagerId, winningSide);

      if (success) {
        bot.sendMessage(
          chatId,
          `🏆 <b>Winner Determined Successfully!</b>\n\n🎲 <b>Winning Side:</b> ${
            winningSide === "side_1" ? "Side 1" : "Side 2"
          }\n\n✅ The winning side has been saved to the database.`,
          { parse_mode: "HTML" }
        );
      } else {
        bot.sendMessage(
          chatId,
          "❌ Failed to update winning side. The wager may not be in 'ended' status or you may not have permission.",
          { parse_mode: "HTML" }
        );
      }
    }
  } catch (error) {
    console.error("Error handling winner determination callback:", error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while processing the winner determination."
    );
  }
}

async function handleCheckWinners(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user.");
    return;
  }

  try {
    const wagersNeedingWinner = await getEndedWagersWithoutWinner();

    if (wagersNeedingWinner.length === 0) {
      bot.sendMessage(
        chatId,
        "📭 No wagers found that need winner determination."
      );
      return;
    }

    const message = `📋 **Wagers Needing Winner Determination** (${wagersNeedingWinner.length} total)

Click on a wager to determine the winner:`;

    const inlineKeyboard = {
      inline_keyboard: wagersNeedingWinner.map((wager: any) => [
        {
          text: `🎲 ${wager.name} (${wager.category})`,
          callback_data: `check_winner_${wager.id}`,
        },
      ]),
    };

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard,
    });
  } catch (error) {
    console.error("Error handling check_winners command:", error);
    bot.sendMessage(chatId, "❌ An error occurred while checking wagers.");
  }
}

// Handle check winner callback
async function handleCheckWinnerCallback(
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  const telegramUserId = callbackQuery.from?.id;

  if (!chatId || !data || !telegramUserId) {
    return;
  }

  try {
    await bot.answerCallbackQuery(callbackQuery.id);

    if (data.startsWith("check_winner_")) {
      const wagerId = parseInt(data.replace("check_winner_", ""));

      if (isNaN(wagerId)) {
        bot.sendMessage(chatId, "❌ Invalid wager ID.");
        return;
      }

      // Get wager details
      const result = await getWager(wagerId);
      if (!result.success) {
        bot.sendMessage(chatId, `❌ Error: ${result.error}`);
        return;
      }

      const wager = result.data;

      // Check if wager has ended and needs winner determination
      const now = new Date();
      const endTime = new Date(wager.wager_end_time);
      if (endTime > now) {
        bot.sendMessage(chatId, "❌ This wager has not ended yet.");
        return;
      }

      if (wager.winning_side) {
        bot.sendMessage(
          chatId,
          `🏆 <b>Winner Already Determined</b>\n\n🎲 <b>Wager:</b> ${
            wager.name
          }\n🏆 <b>Winner:</b> ${
            wager.winning_side === "side_1" ? wager.side_1 : wager.side_2
          }`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Ask for winner determination
      await askWagerCreatorForWinner(wager);
    }
  } catch (error) {
    console.error("Error handling check winner callback:", error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while processing the request."
    );
  }
}

// Daily airdrop state
let dailyAirdropRunning = false;
const DAILY_AIRDROP_AMOUNT = 50000; // 50,000 VS tokens

// Function to perform daily airdrop
async function performDailyAirdrop(): Promise<void> {
  if (dailyAirdropRunning) {
    console.log("🔄 Daily airdrop already running, skipping...");
    return;
  }

  dailyAirdropRunning = true;
  console.log("🎁 Starting daily airdrop...");

  try {
    const usersWithWallets = await getAllUsersWithWallets();
    console.log(
      `📊 Found ${usersWithWallets.length} users with wallets for daily airdrop`
    );

    if (usersWithWallets.length === 0) {
      console.log("⚠️ No users with wallets found for airdrop");
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const user of usersWithWallets) {
      try {
        console.log(
          `🔄 Processing user ${user.telegram_user_id} with wallet ${user.wallet_public_key}`
        );

        // Send 50,000 VS tokens from admin wallet to user wallet
        const transferResult = await transferVSTokens(
          user.wallet_public_key,
          DAILY_AIRDROP_AMOUNT
        );

        if (transferResult.success) {
          successCount++;
          console.log(
            `✅ Sent ${DAILY_AIRDROP_AMOUNT} VS tokens to user ${user.telegram_user_id} (tx: ${transferResult.signature})`
          );

          // Send notification to user
          try {
            await bot.sendMessage(
              user.telegram_user_id,
              `🎁 <b>Daily Airdrop!</b>\n\n💰 You received <b>${DAILY_AIRDROP_AMOUNT.toLocaleString()} VS tokens</b>\n\n🎲 Use them to place bets on wagers!`,
              { parse_mode: "HTML" }
            );
          } catch (notificationError) {
            console.error(
              `Failed to send notification to user ${user.telegram_user_id}:`,
              notificationError
            );
          }
        } else {
          failureCount++;
          console.error(
            `❌ Failed to send tokens to user ${user.telegram_user_id}:`,
            transferResult.error
          );
        }

        // Small delay between transfers to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        failureCount++;
        console.error(
          `❌ Error processing user ${user.telegram_user_id}:`,
          error
        );
      }
    }

    console.log(
      `🎁 Daily airdrop completed: ${successCount} successful, ${failureCount} failed`
    );
  } catch (error) {
    console.error("❌ Error during daily airdrop:", error);
  } finally {
    dailyAirdropRunning = false;
  }
}

// Function to schedule daily airdrop at 00:00
function scheduleDailyAirdrop(): void {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilMidnight = tomorrow.getTime() - now.getTime();

  // Schedule first run at midnight
  setTimeout(() => {
    performDailyAirdrop();

    // Then schedule to run every 24 hours
    setInterval(performDailyAirdrop, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);

  console.log(`⏰ Daily airdrop scheduled for ${tomorrow.toLocaleString()}`);
}

// Handle manual airdrop command (for testing)
async function handleDailyAirdrop(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from?.id;

  if (!telegramUserId) {
    bot.sendMessage(chatId, "❌ Unable to identify user.");
    return;
  }

  try {
    bot.sendMessage(chatId, "🎁 Starting manual daily airdrop...");
    await performDailyAirdrop();
    bot.sendMessage(chatId, "✅ Daily airdrop completed!");
  } catch (error) {
    console.error("Error handling manual daily airdrop:", error);
    bot.sendMessage(chatId, "❌ An error occurred during daily airdrop.");
  }
}

export function startBot(token: string): void {
  bot = new TelegramBot(token, { polling: true });

  setupEventHandlers();
  setupBotMenu();

  // Clean up any invalid file_ids in the database
  cleanupInvalidFileIds().catch((error) => {
    console.error("Error during file_id cleanup:", error);
  });

  scheduleExpiredWagerChecks();
  scheduleDailyAirdrop(); // Schedule daily airdrop

  console.log("✅ Telegram bot started successfully!");
}
