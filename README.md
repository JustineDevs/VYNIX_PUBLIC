# Testnet Automation Bot

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

## Key Features

| Category         | Feature/Option                | Description |
|------------------|------------------------------|-------------|
| User Experience  | Username prompt & welcome    | Personalized greeting on startup |
| Main Menu        | Start Automation             | Begin automated swaps |
|                  | Network Options              | Add, remove, view history for networks |
|                  | Token Options                | Add, remove, view history for tokens |
|                  | Show Info & History          | Submenu for all history types |
|                  | Custom Contract Interactions | Add, view, and execute arbitrary contract calls per network |
|                  | Simulation/Dry Run Mode      | Toggle to simulate all actions without sending real transactions |
|                  | Exit                         | Exit the bot |
| Network Options  | Add Network                  | Add a new network with duplicate check |
|                  | Remove Network               | Remove a network with confirmation |
|                  | Network History              | View swap history for a selected network |
| Token Options    | Add Token                    | Add a new token with duplicate check |
|                  | Remove Token                 | Remove a token with confirmation |
|                  | Token History                | View swap history for a selected token |
| Info & History   | Swap History (ERC20)         | View all ERC20 swap events |
|                  | Liquidity History (ERC721)   | Placeholder for future ERC721 events |
|                  | Custom Deploy History        | Placeholder for future deploy events |
| Automation       | Randomized Swaps             | Swaps between random token pairs at random intervals |
|                  | Contract Existence Check     | Skips swaps if contract does not exist |
|                  | Real Tx Hash & Explorer Link | Shows proof of each swap |
|                  | Error Handling               | Handles all user and contract errors gracefully |
|                  | Back/Continue Everywhere     | All menus and errors allow returning or retrying |
| Automation       | Automatic Token Approval     | Approves tokens as needed for all contract interactions |

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

## Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Compile TypeScript:
   ```sh
   npx tsc
   ```
3. Run the bot:
   Open a new Command Prompt window titled "**Testnet Automation Bot**"
   Run your bot (```npx ts-node automate.ts```)
   ```sh
   node dist/automate.js
   ```
4. Follow the interactive prompts to configure and use the bot.

---

### To Enable Simulation/Dry Run Mode

After starting the bot, select **"Enable Simulation Mode"** from the main menu. All actions will be simulated and logged, not sent to the blockchain.
1. Start your bot as usual 
   ```sh
   npx ts-node automate.ts
   ```
   or, if you have a build step:
      ```sh
   npm run start
      ```
   or 
   ```sh
   node dist/automate.js
      ```
   Use the Bot Normally
   [SIMULATION] Would perform: Swap ...
   [SIMULATION] Would approve ...
   [SIMULATION] Would call ...

2. To Disable Simulation Mode
   Go back to the main menu and select:   **Disable Simulation Mode**
---

**Made by JustineDevs**
