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
