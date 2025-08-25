import TelegramBot = require("node-telegram-bot-api");
import { isCommand } from "../utils/validation";
import {
  createWallet,
  getWalletBalance,
  walletExists,
  buyTokens,
} from "../controllers";
import { calculatePaymentAmount } from "./PriceService";

let bot: TelegramBot;

export function initializeBot(token: string): void {
  bot = new TelegramBot(token, { polling: true });
  setupEventHandlers();
  setupBotMenu();
  console.log(
    "Telegram bot is running (polling mode). Ready to receive messages!"
  );
}

function setupEventHandlers(): void {
  bot.onText(/\/start/, handleStart);
  bot.onText(/\/help/, handleHelp);
  bot.onText(/\/balance/, handleBalance);
  bot.onText(/\/createwallet/, handleCreateWallet);
  bot.onText(/\/buy (\d+) (sol|usdc)/, handleBuyTokens);
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
        command: "balance",
        description: "💰 Check your wallet balance",
      },
      {
        command: "createwallet",
        description: "🔐 Create a new Solana wallet",
      },
      {
        command: "buy",
        description: "🪙 Buy VS tokens (amount currency)",
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

🪙 <b>VS Token Trading Bot</b>

<b>Available Commands:</b>
• /createwallet - Create a new Solana wallet
• /balance - Check your wallet balance
• /buy [amount] [currency] - Buy VS tokens
• /help - Show help information

<b>Supported Currencies:</b>
• SOL - Solana
• USDC - USD Coin

💰 <b>VS Token Price:</b> $0.000002 USD (2×10⁻⁶)

Ready to start trading VS tokens!`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "HTML",
  });
}

function handleHelp(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;

  const helpMessage = `📖 <b>VS Token Trading Bot Help</b>

<b>Getting Started:</b>
1. Create a wallet with /createwallet
2. Check your balance with /balance
3. Buy VS tokens with /buy

<b>Buy Command Format:</b>
/buy [token_amount] [currency]

<b>Examples:</b>
• /buy 100000 sol - Buy 100,000 VS tokens with SOL
• /buy 50000 usdc - Buy 50,000 VS tokens with USDC

<b>Token Information:</b>
• Price: $0.000002 USD per VS token (2×10⁻⁶)
• Real-time SOL prices from CoinGecko
• USDC payments at 1:1 USD ratio

<b>Supported Currencies:</b>
• SOL - Solana (dynamic pricing)
• USDC - USD Coin (1:1 USD)

<b>Features:</b>
• ✅ Real-time balance monitoring
• ✅ Automatic payment calculation
• ✅ Secure Solana transactions
• ✅ Live price updates

Need more help? Contact support!`;

  bot.sendMessage(chatId, helpMessage, {
    parse_mode: "HTML",
  });
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
        `💰 <b>Wallet Balance</b>\n\n` +
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
      `🪙 Amount: ${vsTokenAmount.toLocaleString()} VS Tokens\n` +
      priceInfo +
      `💳 Payment: ${paymentAmount.toFixed(6)} ${paymentCurrency.toUpperCase()}\n\n` +
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
      let successPriceInfo = `💰 Total Price: <b>$${totalUsd.toFixed(6)} USD</b>\n`;
      if (solPrice) {
        successPriceInfo += `📈 SOL Price: <b>$${solPrice.toFixed(2)} USD</b>\n`;
      }

      const successMessage =
        `✅ <b>VS Token Purchase Completed!</b>\n\n` +
        `🪙 Amount: <b>${vsTokenAmount.toLocaleString()} VS Tokens</b>\n` +
        successPriceInfo +
        `💳 Payment: <b>${paymentAmount.toFixed(6)} ${paymentCurrency.toUpperCase()}</b>\n\n` +
        `🎉 <b>Transaction successful!</b>\n` +
        `Your VS tokens have been sent to your wallet.\n\n` +
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

export function startBot(token: string): void {
  initializeBot(token);
}
