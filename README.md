<!-- First Published by JustineDevs -->
# Vynix Bot - Testnet Automation

## Overview

Welcome to Vynix Bot! This is a powerful and interactive Testnet Automation Bot designed to simplify your interactions with EVM-compatible testnets. It offers a rich set of features, including automated token swaps, custom contract interactions, and detailed activity tracking, all wrapped in a user-friendly command-line interface.

What makes Vynix Bot unique is its blend of powerful automation and deep customization. With features like **Simulation Mode**, you can dry-run complex interactions without spending real assets. The **Custom Contract Interaction** module allows you to call any function on any contract, providing ultimate flexibility. Finally, its **Smart Swap Logic** and **Centralized Activity Tracking** ensure your testnet tasks are both efficient and transparent.

## Support the Project

If you find this bot useful, please consider giving the repository a star on GitHub! It helps motivate the developers and provides visibility to the project.

⭐ **[Star the repository on GitHub](https://github.com/JustineDevs/Vynix_Bot)** ⭐
---

### **Table of Contents**
1. [Key Features](#key-features)
2. [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Configuration](#configuration)
3. [Usage](#usage)
4. [Troubleshooting](#troubleshooting)
    - [Dotenv/Environment Issues](#dotenv--environment-issues)
5. [Contributing](#contributing)
6. [Support the Project](#support-the-project)

---

## Key Features

| Category         | Feature/Option                | Description |
|------------------|------------------------------|-------------|
| **User Experience**  | Interactive CLI & Username   | A user-friendly, menu-driven interface with a personalized welcome. |
| **Core Automation**  | Automated Swaps              | Executes swaps between random token pairs at randomized intervals. Checks for contract existence and handles errors gracefully. |
|                  | Smart Swap Logic             | Alternates swap directions (e.g., A→B, then B→A) and checks balances before swapping. |
|                  | Automatic Token Approval     | Automatically checks and approves token allowances as needed for all contract interactions, saving you a manual step. |
| **Flexibility**      | **Simulation/Dry Run Mode**  | **(Unique Feature)** Toggle a mode to simulate all actions (swaps, deploys, custom calls) without sending real transactions. All simulated actions are logged for review. |
|                  | **Custom Contract Interactions** | **(Unique Feature)** Add, view, and execute arbitrary contract calls for any network. Supports custom ABIs, methods, and parameters. |
| **Management**       | **Multiple Wallet Management** | **(New)** Interactive management of up to 1000 wallets with overwrite protection, balance display, and automatic detection. |
|                  | Network Management           | Add, remove, and view networks with duplicate checks and robust error handling. |
|                  | Token Management             | Add, remove, and view tokens supported by the bot. |
| **Tracking**         | Real Transaction Logs        | Provides the transaction hash and a block explorer link for every on-chain action. |
|                  | Centralized Activity Log     | All bot activities (swaps, transfers, settings changes) are logged to `activityHistory.json` for complete transparency. |
|                  | Categorized History          | View history categorized by Network, Token, ERC20 Swaps, and more. |
| **Configuration**  | **Smart Environment System** | **(New)** Priority-based environment loading with `env.example` as primary config, `.env` as overrides, and smart file management. |
|                  | Enhanced Settings            | Configure swap intervals, amounts (with randomization), gas limits, and more. |

## Getting Started

Follow these steps to get the Vynix Bot up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en) (v18 or higher recommended)
- [Git](https://git-scm.com/)

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/JustineDevs/Vynix_Bot.git
    cd Vynix_Bot
    ```

2.  **Install dependencies:**
    This command installs all the necessary packages defined in `package.json`.
    ```sh
    npm install
    ```

### Configuration

The bot uses a **priority-based environment system** with `env.example` as the primary configuration file and `.env` as optional overrides.

#### **Environment File Priority:**
1. **`env.example`** (Primary) - Main configuration file
2. **`.env`** (Optional) - Override settings if needed
3. **Environment Variables** - System-level overrides

#### **Multiple Wallet Support:**
The bot now supports **up to 1000 wallets** using the following format:
- **Legacy Support**: `PRIVATE_KEY` (single key)
- **Multiple Support**: `PRIVATE_KEY_1`, `PRIVATE_KEY_2`, ..., `PRIVATE_KEY_1000`

#### **Setup Options:**

**Option 1: Manual Configuration (Traditional)**
1. **Copy the example file:**
   ```sh
   cp env.example .env
   ```
   *If you are on Windows, you can use `copy env.example .env`*

2. **Edit the `env.example` file:**
   Open `env.example` and add your wallet's private key(s):
   ```env
   PRIVATE_KEY_1=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   PRIVATE_KEY_2=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
   # Add more keys as needed (up to PRIVATE_KEY_1000)
   ```

**Option 2: Interactive Wallet Management (Recommended)**
1. **Start the bot** without any private keys
2. **Navigate to**: `Modify Settings` → `Private Key Management`
3. **Choose**: `Add New Wallets` to import your private keys interactively
4. **The bot will automatically** save them to `env.example` and detect them

**IMPORTANT:** This bot is for **testnet use only**. Never use a private key from a wallet containing real assets.

## Usage

### **Quick Start Guide (From Scratch)**

1. **Install Dependencies:**
   ```sh
   npm install
   ```

2. **Run the Bot:**
   ```sh
   npx ts-node automate.ts
   ```
   *Alternatively, compile and run:*
   ```sh
   npx tsc
   node dist/automate.js
   ```

3. **Set Up Your Wallets (First Time):**
   - Navigate to: `Modify Settings` → `Private Key Management`
   - Choose: `Add New Wallets`
   - Enter your private keys one by one
   - The bot automatically saves them to `env.example`

4. **Configure Networks & Tokens:**
   - Add your preferred testnet networks
   - Add tokens you want to trade
   - Set up automation parameters

5. **Start Automation:**
   - Choose `Start Automation` from the main menu
   - Select your preferred networks and functions
   - The bot will use all your imported wallets automatically

### **Multiple Wallet Management**

The bot now features a comprehensive **Multiple Wallet Management System**:

#### **Available Options:**
- **View All Wallets**: See all wallets with balances across networks
- **Add New Wallets**: Import multiple private keys with overwrite protection
- **Remove Wallet**: Remove specific wallets from the system
- **Replace All Wallets**: Complete wallet replacement

#### **Key Features:**
- **Overwrite Protection**: Warns if private key already exists, offers overwrite option
- **Sequential Numbering**: Automatically numbers wallets as `PRIVATE_KEY_1`, `PRIVATE_KEY_2`, etc.
- **Balance Display**: Shows wallet balances across all configured networks
- **Activity Logging**: Tracks all wallet management actions
- **Automatic Detection**: Bot automatically detects and uses all imported wallets

#### **How It Works:**
1. **Import Wallets**: Use the interactive menu to add your private keys
2. **Automatic Detection**: Bot detects all wallets on startup
3. **Balance Checking**: Shows balances across all networks
4. **Smart Rotation**: Bot rotates through all wallets with sufficient balance
5. **Activity Tracking**: All wallet operations are logged

### **Environment Configuration**

The bot uses a **smart environment loading system**:

#### **File Priority:**
1. **`env.example`** (Primary) - Main configuration, contains all settings
2. **`.env`** (Optional) - Overrides, can override any setting
3. **Environment Variables** - System-level overrides

#### **Smart File Management:**
- **Preserves Settings**: All non-private-key variables are maintained
- **Updates Only Keys**: Only private key sections are modified
- **Maintains Structure**: File structure and comments are preserved
- **Automatic Reload**: Environment is reloaded after changes

## Troubleshooting

### Environment & Private Key Issues

If the bot fails to load your private keys or network settings, it's likely an issue with the environment configuration.

#### **Common Problems & Solutions:**

**Problem 1**: Bot reports "No private keys found" or "No wallets loaded"
- **Solution**:
  1. **Check `env.example` file**: Ensure your private keys are in `env.example` (primary file)
  2. **Use Interactive Import**: Go to `Modify Settings` → `Private Key Management` → `Add New Wallets`
  3. **Verify Format**: Keys should be `PRIVATE_KEY_1=0x...` format (no quotes, no extra spaces)

**Problem 2**: Bot doesn't detect newly added private keys
- **Solution**:
  1. **Restart the bot** after adding keys to `env.example`
  2. **Check file encoding**: Ensure `env.example` is saved as UTF-8 (no BOM)
  3. **Verify syntax**: No extra characters or line breaks in private keys

**Problem 3**: Environment variables not loading correctly
- **Solution**:
  1. **File Priority**: Bot loads `env.example` first, then `.env` (if exists)
  2. **File Location**: Both files must be in the root directory (same folder as `package.json`)
  3. **File Names**: Ensure exact names: `env.example` and `.env` (no extensions)

**Problem 4**: Private key validation errors
- **Solution**:
  1. **Format Check**: Keys must start with `0x` and be exactly 64 characters long
  2. **Character Check**: Only hexadecimal characters (0-9, a-f, A-F) allowed
  3. **Length Check**: Total length should be 66 characters (`0x` + 64 hex chars)

#### **File Structure Example:**
```env
# env.example (Primary Configuration)
PRIVATE_KEY_1=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
PRIVATE_KEY_2=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
PHAROS_RPC=https://testnet.dplabs-internal.com
PHAROS_CHAIN_ID=688688

# .env (Optional Overrides)
# Add any overrides here if needed
```

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  **Fork the Project**
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request**

## MVP (Minimum Viable Product)

| Feature                | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| Interactive CLI        | User-friendly menu for all actions, including add/remove/view for tokens and networks |
| Username & Welcome     | Asks for username on startup and displays a personalized welcome message     |
| Network Management     | Add, remove, and view networks with duplicate checks and error handling      |
| Token Management       | Add, remove, and view tokens with duplicate checks and error handling        |
| Automated Swaps        | Randomized interval swaps between user-uploaded token pairs, with contract existence check |
| Real Transaction Logs  | Shows transaction hash and explorer link for each swap                      |
| History & Info         | Categorized history: Network, Token, ERC20 Swap, ERC721 Liquidity, Deploy   |
| Error Handling         | Handles missing/invalid contracts, duplicate entries, and user interruptions |
| Menu Navigation        | All submenus have 'Back' options, confirmations, and clear guidance         |

## Recent Changes

### **Major Updates (Latest)**
- **Multiple Wallet Management System**: Support for up to 1000 wallets with interactive management
- **Environment Priority System**: `env.example` as primary config, `.env` as optional overrides
- **Smart File Management**: Preserves all settings while updating only private keys
- **Overwrite Protection**: Warns and offers overwrite option for duplicate private keys
- **Automatic Wallet Detection**: Bot automatically detects and uses all imported wallets
- **Balance Display**: Shows wallet balances across all configured networks
- **Activity Logging**: Tracks all wallet management actions

### **Previous Updates**
- Added Simulation/Dry Run Mode: simulate all actions without sending real transactions
- Added Custom Contract Interactions: add, view, and execute arbitrary contract calls per network
- Generalized Automatic Token Approval: bot checks and approves tokens as needed for all networks and contracts
- Added interactive username prompt and welcome message
- Main menu is now the default entry point (no forced token pair prompt)
- All menus are categorized (Network Options, Token Options, Info & History)
- Duplicate checks and error handling for adding tokens/networks
- All submenus have 'Back' options and confirmations
- History menu is categorized: Network, Token, ERC20, ERC721, Deploy
- Automated swaps now check contract existence and randomize token pairs/intervals
- Real transaction hash and explorer link shown for each swap
- Clear error messages and user guidance throughout

## New Features

### Simulation/Dry Run Mode
- Toggle from the main menu to simulate all actions (swap, liquidity, custom, etc.) without sending real transactions. All actions are logged for review.

### Custom Contract Interactions
- Add, view, and execute arbitrary contract calls per network. Supports custom ABI, method, and parameters. Works with simulation mode.

### Automatic Token Approval
- The bot automatically checks and approves tokens as needed before any contract interaction, for all networks and contracts.

## Enhanced Settings & Configuration

### Modify Settings Menu
- **Swap Settings**: Configure swap intervals (random/fixed), swap amounts with optional range for randomization
- **Transfer Settings**: Set default receiver address and transfer amounts with optional range
- **Liquidity Settings**: Placeholder for future liquidity management features
- **Network Options**: Manage networks with enhanced history tracking
- **Token Options**: Manage tokens with enhanced settings and history
- **Deploy Options**: Contract deployment and interaction management

### Smart Swap Logic
- **Alternating Swap Pairs**: Bot remembers last swap direction and alternates (e.g., WPHRS→USDT, then USDT→WPHRS)
- **Balance Checking**: Automatically checks token balances before swapping, tries alternative pairs if insufficient
- **Random Pair Selection**: After completing a round-trip swap, picks new random pairs
- **Amount Randomization**: Optional range setting for randomized swap amounts between min and max values

### Connected Activity Tracking
- **Centralized Activity Log**: All bot activities (swaps, transfers, settings changes) logged to `activityHistory.json`
- **Real-time History**: Info & History menu shows all activities with timestamps and details
- **Network-specific History**: View all activities for specific networks including settings changes
- **Settings Integration**: All settings changes are logged and immediately reflected in automation

## Advanced Features (Coming Soon)

### Profit/Loss Tracking
- Track all swaps, transfers, and calculate net profit/loss per token and overall
- Historical performance analysis and reporting
- Real-time P&L dashboard

### Automatic Token Approval
- **Current Status**: Toggle between enabled/disabled
- **Future Features**: Per-token approval status, auto-approve on swap/transfer, approval history tracking
- **Smart Approval**: Automatic approval management for all contract interactions

### Health Checks & Self-Healing
- **Network Health Monitoring**: Check RPC/network status and performance
- **Auto-retry Logic**: Automatically retry failed operations with exponential backoff
- **Self-healing**: Auto-recover from common errors and network issues
- **Alert System**: Notifications for persistent issues and performance degradation

## Complete Setup Guide (From Scratch)

### **Step-by-Step Setup for New Users**

#### **Step 1: Installation**
```bash
# Clone the repository
git clone https://github.com/JustineDevs/Vynix_Bot.git
cd Vynix_Bot

# Install dependencies
npm install
```

#### **Step 2: First Run**
```bash
# Run the bot
npx ts-node automate.ts
```

#### **Step 3: Set Up Wallets (Interactive Method - Recommended)**
1. **Start the bot** - You'll see the main menu
2. **Navigate to**: `Modify Settings` → `Private Key Management`
3. **Choose**: `Add New Wallets`
4. **Enter your private keys** one by one:
   - Each key should start with `0x` and be 64 characters long
   - The bot will validate each key automatically
   - You can add multiple keys in one session
5. **The bot automatically saves** all keys to `env.example`

#### **Step 4: Configure Networks**
1. **Go to**: `Modify Settings` → `Network Options`
2. **Choose**: `Add Network`
3. **Enter network details**:
   - **Name**: e.g., "Pharos Testnet"
   - **RPC URL**: e.g., "https://testnet.dplabs-internal.com"
   - **Chain ID**: e.g., "688688"
   - **Native Currency**: e.g., "PHRS"

#### **Step 5: Add Tokens**
1. **Go to**: `Modify Settings` → `Token Options`
2. **Choose**: `Add Token`
3. **Enter token details**:
   - **Name**: e.g., "Wrapped PHRS"
   - **Symbol**: e.g., "WPHRS"
   - **Address**: e.g., "0x..."
   - **Decimals**: e.g., "18"

#### **Step 6: Start Automation**
1. **From main menu**: Choose `Start Automation`
2. **Select networks**: Choose which networks to use
3. **Select functions**: Choose what to automate (Swap, Transfer, Faucet, etc.)
4. **Configure settings**: Set amounts, intervals, etc.
5. **Start**: The bot will use all your wallets automatically

### **Advanced Usage**

#### **Multiple Wallet Management**
- **View All Wallets**: See balances across all networks
- **Add More Wallets**: Import additional private keys anytime
- **Remove Wallets**: Remove specific wallets if needed
- **Replace All**: Complete wallet replacement

#### **Environment Management**
- **Primary Config**: `env.example` contains all your settings
- **Overrides**: Use `.env` for temporary overrides
- **Automatic Loading**: Bot loads `env.example` first, then `.env`

#### **Automation Features**
- **Smart Rotation**: Bot rotates through all wallets with balance
- **Balance Checking**: Skips wallets with insufficient funds
- **Activity Logging**: All actions are logged to `activityHistory.json`
- **Simulation Mode**: Test without real transactions

### **Troubleshooting Quick Guide**

| Problem | Solution |
|---------|----------|
| "No private keys found" | Use `Modify Settings` → `Private Key Management` → `Add New Wallets` |
| "Invalid private key" | Ensure key starts with `0x` and is exactly 64 characters long |
| "Network not found" | Add network via `Modify Settings` → `Network Options` |
| "Token not found" | Add token via `Modify Settings` → `Token Options` |
| "Insufficient balance" | Add funds to wallet or check minimum balance settings |

## Future SaaS Platform Roadmap

### Multi-Network, Multi-Wallet Orchestration
- Support for multiple testnet networks (Pharos, Monad, etc.) simultaneously
- Multi-wallet management with secure key storage
- Parallel execution across all wallets and networks
- Network-specific task customization

### Web Dashboard & User Management
- **User Interface**: React/Next.js web dashboard for easy management
- **User Accounts**: Supabase integration for user authentication and data storage
- **Subscription Management**: Monthly subscription tiers with Stripe integration
- **Real-time Monitoring**: Live activity feeds and status updates

### Advanced Task Automation
- **Custom Task Scripting**: Allow users to create custom tasks per network/project
- **Social Media Integration**: Automated Galxe, Twitter, Discord interactions
- **Scheduling System**: Cron-like scheduling for recurring tasks
- **Notification System**: Email, Telegram, Discord notifications for events

### Technical Architecture
- **Backend**: Node.js/TypeScript API with Express/Fastify
- **Database**: Supabase (PostgreSQL) for persistent storage
- **Task Queue**: BullMQ for parallel task execution
- **Cloud Deployment**: 24/7 VPS operation with monitoring
- **Security**: Encrypted wallet storage and user-side signing options

### Development Phases

#### Phase 1: MVP Enhancement
- Modularize current bot into services (network, wallet, task modules)
- Build basic web dashboard for user management
- Integrate Supabase for user and activity storage
- Implement parallel execution for multiple wallets/networks

#### Phase 2: Advanced Features
- Profit/loss tracking and analytics
- Health checks and self-healing systems
- Social media and Galxe-like activity automation
- Custom task scripting and notification systems

#### Phase 3: Scaling & Security
- Enhanced wallet security and encryption
- Horizontal scaling and load balancing
- Advanced analytics and reporting
- Enterprise features and API access
