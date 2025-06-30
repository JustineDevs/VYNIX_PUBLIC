# Vynix Bot - Testnet Automation

## Overview

Welcome to Vynix Bot! This is a powerful and interactive Testnet Automation Bot designed to simplify your interactions with EVM-compatible testnets. It offers a rich set of features, including automated token swaps, custom contract interactions, and detailed activity tracking, all wrapped in a user-friendly command-line interface.

What makes Vynix Bot unique is its blend of powerful automation and deep customization. With features like **Simulation Mode**, you can dry-run complex interactions without spending real assets. The **Custom Contract Interaction** module allows you to call any function on any contract, providing ultimate flexibility. Finally, its **Smart Swap Logic** and **Centralized Activity Tracking** ensure your testnet tasks are both efficient and transparent.

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
| **Management**       | Network Management           | Add, remove, and view networks with duplicate checks and robust error handling. |
|                  | Token Management             | Add, remove, and view tokens supported by the bot. |
| **Tracking**         | Real Transaction Logs        | Provides the transaction hash and a block explorer link for every on-chain action. |
|                  | Centralized Activity Log     | All bot activities (swaps, transfers, settings changes) are logged to `activityHistory.json` for complete transparency. |
|                  | Categorized History          | View history categorized by Network, Token, ERC20 Swaps, and more. |
| **Configuration**  | Enhanced Settings            | Configure swap intervals, amounts (with randomization), gas limits, and more. |

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

The bot uses a `.env` file to store sensitive information like private keys and RPC URLs.

1.  **Create a `.env` file:**
    Copy the example file to create your own configuration file.
    ```sh
    cp env.example .env
    ```
    *If you are on Windows, you can use `copy env.example .env`*

2.  **Edit the `.env` file:**
    Open the newly created `.env` file and add your wallet's private key(s) and any custom RPC URLs you wish to use.
    
    **IMPORTANT:** This bot is for **testnet use only**. Never use a private key from a wallet containing real assets.

## Usage

Once installed and configured, you can run the bot.

1.  **Compile the TypeScript code:**
    This command compiles the TypeScript files (`.ts`) into JavaScript files (`.js`) in the `dist/` directory.
    ```sh
    npx tsc
    ```

2.  **Run the bot:**
    Execute the compiled code using Node.js.
    ```sh
    node dist/automate.js
    ```
    Alternatively, you can use the provided batch file on Windows, which starts the bot in a new terminal window.
    ```sh
    ./run_bot.bat
    ```

3.  **Follow the interactive prompts** to configure networks, add tokens, and start the automation.

## Troubleshooting

### Dotenv / Environment Issues

If the bot fails to load your private keys or network settings, it's likely an issue with the `.env` file.

-   **Problem**: The bot reports "Private key not found" or "Invalid RPC URL", but you have set them in `.env`.
-   **Solution**:
    1.  **Confirm File Name**: Ensure your environment file is named exactly `.env` (dot-env), with no other extensions. Some editors might save it as `.env.txt`.
    2.  **Confirm File Location**: The `.env` file must be in the root directory of the project (the same folder as `package.json`).
    3.  **Check Formatting**: Make sure there are no extra spaces or characters around the `=` in each line (e.g., `PRIVATE_KEY_1=0x...`). Do not use quotes around the keys or values.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  **Fork the Project**
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request**

## Support the Project

If you find this bot useful, please consider giving the repository a star on GitHub! It helps motivate the developers and provides visibility to the project.

⭐ **[Star the repository on GitHub](https://github.com/JustineDevs/Vynix_Bot)** ⭐

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
