import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.resolve(packageRoot, '.env') });

export interface NetworkConfig {
  nodeUrl: string;
  l1RpcUrl: string;
  l1ChainId: number;
}

export interface TimeoutConfig {
  deployTimeout: number;
  txTimeout: number;
  waitTimeout: number;
}

export interface EnvironmentConfig {
  name: string;
  environment: 'local' | 'testnet' | 'devnet' | 'mainnet';
  network: NetworkConfig;
  settings: {
    skipLocalNetwork: boolean;
    version: string;
  };
  timeouts?: TimeoutConfig;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config!: EnvironmentConfig;
  private configPath: string;

  private constructor() {
    const env = process.env.AZTEC_ENV || 'local-network';
    this.configPath = path.resolve(packageRoot, `config/${env}.json`);
    this.loadConfig();
    console.log(`Loaded configuration: ${this.config.name} environment`);
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): void {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error(`Failed to load config from ${this.configPath}:`, error);
      throw new Error('Configuration file not found or invalid');
    }
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public getNetworkConfig(): NetworkConfig {
    return this.config.network;
  }

  public isDevnet(): boolean {
    return this.config.environment === 'devnet';
  }

  public isLocalNetwork(): boolean {
    return this.config.environment === 'local';
  }

  public getNodeUrl(): string {
    return this.config.network.nodeUrl;
  }

  public getL1RpcUrl(): string {
    return this.config.network.l1RpcUrl;
  }

  public getTimeouts(): TimeoutConfig {
    if (this.config.timeouts) {
      return this.config.timeouts;
    }
    if (this.isDevnet()) {
      return {
        deployTimeout: 1200000,
        txTimeout: 180000,
        waitTimeout: 60000,
      };
    }
    return {
      deployTimeout: 120000,
      txTimeout: 60000,
      waitTimeout: 30000,
    };
  }
}

const configManager = ConfigManager.getInstance();

export function getAztecNodeUrl(): string {
  return configManager.getNodeUrl();
}

export function getL1RpcUrl(): string {
  return configManager.getL1RpcUrl();
}

export function getL1ChainId(): number {
  return configManager.getNetworkConfig().l1ChainId;
}

export function getEnv(): string {
  return configManager.getConfig().name;
}

export function getTimeouts(): TimeoutConfig {
  return configManager.getTimeouts();
}

export default configManager;
