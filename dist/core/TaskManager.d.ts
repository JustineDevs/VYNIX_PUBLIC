import { Network } from './NetworkManager';
import { Wallet } from 'ethers';
/**
 * Manages the execution of blockchain-related tasks.
 */
export declare class TaskManager {
    private logger;
    constructor();
    /**
     * Placeholder for the token swapping logic.
     */
    swapTokens(network: Network, wallet: Wallet, tokenInAddress: string, tokenOutAddress: string, amount: string): Promise<void>;
    /**
     * Placeholder for the liquidity addition logic.
     */
    addLiquidity(network: Network, wallet: Wallet, tokenAAddress: string, tokenBAddress: string, amountA: string, amountB: string): Promise<void>;
}
