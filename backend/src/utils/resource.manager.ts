import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a dedicated child logger for ResourceManager
const resourceLogger = logger.child({ component: 'ResourceManager' });

interface ResourceConfig {
  mode: 'local' | 'github';
  localPath?: string;
  githubConfig?: {
    owner: string;
    repo: string;
    branch: string;
    basePath?: string;
    token?: string;
  };
}

export class ResourceManager {
  private config: ResourceConfig;

  constructor() {
    this.config = {
      mode: (process.env.RESOURCES_MODE as 'local' | 'github') || 'local',
      localPath: process.env.LOCAL_RESOURCES_PATH || '../../../ressources',
      githubConfig: {
        owner: process.env.GITHUB_REPO_OWNER || '',
        repo: process.env.GITHUB_REPO_NAME || '',
        branch: process.env.GITHUB_BRANCH || 'main',
        basePath: process.env.GITHUB_BASE_PATH || '',
        token: process.env.GITHUB_TOKEN,
      },
    };
  }

  /**
   * Get the content of a resource file
   * @param filePath - Relative path to the file (e.g., 'service/registry.json')
   */
  async getResource(filePath: string): Promise<any> {
    if (this.config.mode === 'local') {
      return this.getLocalResource(filePath);
    } else {
      return this.getGithubResource(filePath);
    }
  }

  /**
   * Read resource from local file system
   */
  private getLocalResource(filePath: string): any {
    const fullPath = path.join(__dirname, this.config.localPath!, filePath);
    
    resourceLogger.debug({ 
      mode: this.config.mode,
      dirname: __dirname,
      localPath: this.config.localPath,
      filePath,
      fullPath 
    }, 'Reading local resource');
    
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      resourceLogger.info({ filePath, fullPath }, 'Local resource read successfully');
      return JSON.parse(content);
    } catch (error: any) {
      resourceLogger.error({ filePath, fullPath, error: error.message }, 'Failed to read local resource');
      throw new Error(`Unable to read local resource: ${filePath} (Full path: ${fullPath})`);
    }
  }

  /**
   * Fetch resource from GitHub repository
   */
  private async getGithubResource(filePath: string): Promise<any> {
    const { owner, repo, branch, basePath, token } = this.config.githubConfig!;
    
    if (!owner || !repo) {
      throw new Error('GitHub configuration is incomplete');
    }

    // Construct the full path with basePath if provided
    const fullPath = basePath ? `${basePath}/${filePath}` : filePath;
    
    // GitHub raw content URL
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}`;
    
    resourceLogger.debug({ mode: this.config.mode, url }, 'Fetching resource from GitHub');

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          resourceLogger.error({ filePath, url }, 'File not found on GitHub');
          throw new Error(`File not found on GitHub: ${filePath}`);
        }
        resourceLogger.error({ status: response.status, url }, 'HTTP error fetching from GitHub');
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      resourceLogger.info({ filePath, url }, 'Successfully fetched from GitHub');
      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        resourceLogger.error({ error: error.message, url }, 'Failed to fetch from GitHub');
        throw new Error(`Unable to fetch from GitHub: ${error.message} (URL: ${url})`);
      }
      throw new Error('Unable to fetch resource from GitHub');
    }
  }

  /**
   * Get current configuration mode
   */
  getMode(): string {
    return this.config.mode;
  }
}
