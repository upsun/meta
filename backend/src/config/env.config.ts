import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Centralized environment configuration
 * All environment variables are validated and typed here
 */
class EnvironmentConfig {
  // Server Configuration
  readonly server: {
    PORT: number;
    NODE_ENV: string;
    BASE_URL: string;
  };

  // Logging Configuration
  readonly logging: {
    LOG_LEVEL: string;
  };

  // CORS Configuration
  readonly cors: {
    ORIGINS: string;
  };

  // Rate Limiting Configuration
  readonly rateLimit: {
    WINDOW_MS: number;
    MAX_REQUESTS: number;
    STRICT_WINDOW_MS: number;
    STRICT_MAX_REQUESTS: number;
  };

  // Resources Configuration
  readonly resources: {
    MODE: 'local' | 'github';
    LOCAL_PATH: string;
  };

  // GitHub Configuration
  readonly github: {
    REPO_OWNER: string;
    REPO_NAME: string;
    BRANCH: string;
    BASE_PATH: string;
    TOKEN?: string;
  };

  constructor() {
    // Server Configuration
    this.server = {
      PORT: this.getNumber('PORT', 3000),
      NODE_ENV: this.getString('NODE_ENV', 'development'),
      BASE_URL: this.getString('BASE_URL', 'http://localhost:3000'),
    };

    // Logging Configuration
    this.logging = {
      LOG_LEVEL: this.getString('LOG_LEVEL', 'info'),
    };

    // CORS Configuration
    this.cors = {
      ORIGINS: this.getString('CORS_ORIGINS', 'https://meta.upsun.com,http://meta.upsun.com'),
    };

    // Rate Limiting Configuration
    this.rateLimit = {
      WINDOW_MS: this.getNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
      MAX_REQUESTS: this.getNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      STRICT_WINDOW_MS: this.getNumber('STRICT_RATE_LIMIT_WINDOW_MS', 60000), // 1 minute
      STRICT_MAX_REQUESTS: this.getNumber('STRICT_RATE_LIMIT_MAX_REQUESTS', 10),
    };

    // Resources Configuration
    this.resources = {
      MODE: this.getString('RESOURCES_MODE', 'local') as 'local' | 'github',
      LOCAL_PATH: this.getString('LOCAL_RESOURCES_PATH', '../../../resources'),
    };

    // GitHub Configuration
    this.github = {
      REPO_OWNER: this.getString('GITHUB_REPO_OWNER', 'upsun'),
      REPO_NAME: this.getString('GITHUB_REPO_NAME', 'upsun-docs'),
      BRANCH: this.getString('GITHUB_BRANCH', 'main'),
      BASE_PATH: this.getString('GITHUB_BASE_PATH', 'shared/data'),
      TOKEN: process.env.GITHUB_TOKEN,
    };

    // Validate configuration
    this.validate();
  }

  /**
   * Get string value from environment
   */
  private getString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Get number value from environment
   */
  private getNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
    }
    return parsed;
  }

  /**
   * Get boolean value from environment
   */
  private getBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    // Validate NODE_ENV
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(this.server.NODE_ENV)) {
      throw new Error(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
    }

    // Validate RESOURCES_MODE
    if (!['local', 'github'].includes(this.resources.MODE)) {
      throw new Error(`RESOURCES_MODE must be 'local' or 'github'`);
    }

    // Validate GitHub config if mode is github
    if (this.resources.MODE === 'github') {
      if (!this.github.REPO_OWNER || !this.github.REPO_NAME) {
        throw new Error('GITHUB_REPO_OWNER and GITHUB_REPO_NAME are required when RESOURCES_MODE is "github"');
      }
    }

    // Validate port range
    if (this.server.PORT < 1 || this.server.PORT > 65535) {
      throw new Error('PORT must be between 1 and 65535');
    }
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.server.NODE_ENV === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.server.NODE_ENV === 'production';
  }

  /**
   * Check if running in test mode
   */
  isTest(): boolean {
    return this.server.NODE_ENV === 'test';
  }

  /**
   * Get all configuration as object (for debugging)
   */
  toObject(): Record<string, any> {
    return {
      server: this.server,
      logging: this.logging,
      cors: this.cors,
      rateLimit: this.rateLimit,
      resources: this.resources,
      github: {
        ...this.github,
        TOKEN: this.github.TOKEN ? '***' : undefined,
      },
    };
  }
}

// Export singleton instance
export const config = new EnvironmentConfig();
