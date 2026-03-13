import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { config } from '../config/env.config.js';
import YAML from 'yaml';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a dedicated child logger for ResourceManager
const resourceLogger = logger.child({ component: 'ResourceManager' });

interface ResourceConfig {
  mode: 'local' | 'github';
  localPath?: string;
  githubConfig?: {
    REPO_OWNER: string;
    REPO_NAME: string;
    BRANCH: string;
    BASE_PATH?: string;
    TOKEN?: string;
  };
}

export interface ResourceMetadata {
  etag?: string;
  lastModified?: string;
  source: 'local' | 'github';
}

export interface ResourceWithMetadata<T = any> {
  data?: T;
  metadata: ResourceMetadata;
  notModified?: boolean; // True when upstream returns 304 (data will be undefined)
}

export interface ConditionalHeaders {
  ifNoneMatch?: string;
  ifModifiedSince?: string;
}

export class ResourceManager {
  private config: ResourceConfig;

  constructor() {
    this.config = {
      mode: config.resources.MODE,
      localPath: config.resources.LOCAL_PATH,
      githubConfig: config.github,
    };
  }

  /**
   * Get the content of a resource file
   * @param filePath - Relative path to the file (e.g., 'image/registry.json')
   */
  async getResource(filePath: string): Promise<any> {
    if (this.config.mode === 'local') {
      return this.getLocalResource(filePath);
    } else {
      return this.getGithubResource(filePath);
    }
  }

  /**
   * Get the content of a resource file with metadata (etag, last-modified)
   * Supports conditional requests for GitHub mode to avoid unnecessary downloads
   * @param filePath - Relative path to the file (e.g., 'image/registry.json')
   * @param conditionalHeaders - Optional If-None-Match/If-Modified-Since headers for conditional requests
   */
  async getResourceWithMetadata(filePath: string, conditionalHeaders?: ConditionalHeaders): Promise<ResourceWithMetadata> {
    if (this.config.mode === 'local') {
      return this.getLocalResourceWithMetadata(filePath);
    } else {
      return this.getGithubResourceWithMetadata(filePath, conditionalHeaders);
    }
  }

  /**
   * Get raw content of a resource file (no parsing)
   * @param filePath - Relative path to the file (e.g., 'image/registry.json')
   */
  async getResourceRaw(filePath: string): Promise<string> {
    if (this.config.mode === 'local') {
      return this.getLocalResourceRaw(filePath);
    } else {
      return this.getGithubResourceRaw(filePath);
    }
  }

  /**
   * Get raw content of a resource file with metadata (no parsing)
   * Supports conditional requests for GitHub mode to avoid unnecessary downloads
   * @param filePath - Relative path to the file (e.g., 'image/registry.json')
   * @param conditionalHeaders - Optional If-None-Match/If-Modified-Since headers for conditional requests
   */
  async getResourceRawWithMetadata(filePath: string, conditionalHeaders?: ConditionalHeaders): Promise<ResourceWithMetadata<string>> {
    if (this.config.mode === 'local') {
      return this.getLocalResourceRawWithMetadata(filePath);
    } else {
      return this.getGithubResourceRawWithMetadata(filePath, conditionalHeaders);
    }
  }

  /**
   * Read resource from local file system
   */
  private getLocalResource(filePath: string): any {
    // Go up three levels from backend/src/utils to the project root
    const projectRoot = path.resolve(__dirname, '../../..');
    const resourcesBase = path.resolve(projectRoot, 'resources');
    const fullPath = this.resolveLocalPath(resourcesBase, filePath);

    resourceLogger.debug({
      mode: this.config.mode,
      dirname: __dirname,
      filePath,
      fullPath
    }, 'Reading local resource');

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      resourceLogger.info({ filePath, fullPath }, 'Local resource read successfully');

      const ext = path.extname(fullPath).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        return YAML.parse(content);
      }
      return JSON.parse(content);
    } catch (error: any) {
      resourceLogger.error({ filePath, fullPath, error: error.message }, 'Failed to read local resource');
      throw new Error(`Unable to read local resource: ${filePath}`);
    }
  }

  /**
   * Read resource from local file system with metadata
   */
  private getLocalResourceWithMetadata(filePath: string): ResourceWithMetadata {
    const projectRoot = path.resolve(__dirname, '../../..');
    const resourcesBase = path.resolve(projectRoot, 'resources');
    const fullPath = this.resolveLocalPath(resourcesBase, filePath);

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const stats = fs.statSync(fullPath);
      
      const ext = path.extname(fullPath).toLowerCase();
      const data = (ext === '.yaml' || ext === '.yml') ? YAML.parse(content) : JSON.parse(content);
      
      // Generate etag from file stats (mtime + size)
      const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
      
      resourceLogger.info({ filePath, fullPath, etag }, 'Local resource with metadata read successfully');
      
      return {
        data,
        metadata: {
          etag,
          lastModified: stats.mtime.toUTCString(),
          source: 'local'
        }
      };
    } catch (error: any) {
      resourceLogger.error({ filePath, fullPath, error: error.message }, 'Failed to read local resource with metadata');
      throw new Error(`Unable to read local resource: ${filePath}`);
    }
  }

  /**
   * Read raw resource content from local file system
   */
  private getLocalResourceRaw(filePath: string): string {
    const localBase = path.resolve(__dirname, this.config.localPath!);
    const fullPath = this.resolveLocalPath(localBase, filePath);

    resourceLogger.debug({
      mode: this.config.mode,
      dirname: __dirname,
      localPath: this.config.localPath,
      filePath,
      fullPath
    }, 'Reading local raw resource');

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      resourceLogger.info({ filePath, fullPath }, 'Local raw resource read successfully');
      return content;
    } catch (error: any) {
      resourceLogger.error({ filePath, fullPath, error: error.message }, 'Failed to read local raw resource');
      throw new Error(`Unable to read local raw resource: ${filePath}`);
    }
  }

  /**
   * Read raw resource content from local file system with metadata
   */
  private getLocalResourceRawWithMetadata(filePath: string): ResourceWithMetadata<string> {
    const localBase = path.resolve(__dirname, this.config.localPath!);
    const fullPath = this.resolveLocalPath(localBase, filePath);

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const stats = fs.statSync(fullPath);
      
      // Generate etag from file stats (mtime + size)
      const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
      
      resourceLogger.info({ filePath, fullPath, etag }, 'Local raw resource with metadata read successfully');
      
      return {
        data: content,
        metadata: {
          etag,
          lastModified: stats.mtime.toUTCString(),
          source: 'local'
        }
      };
    } catch (error: any) {
      resourceLogger.error({ filePath, fullPath, error: error.message }, 'Failed to read local raw resource with metadata');
      throw new Error(`Unable to read local raw resource: ${filePath}`);
    }
  }

  /**
   * Normalize and validate a requested local resource path.
   */
  private resolveLocalPath(baseDir: string, filePath: string): string {
    if (this.config.mode !== 'local' && path.isAbsolute(filePath)) {
      throw new Error(`Absolute paths are not allowed: ${filePath}`);
    }

    const normalizedPath = path.normalize(filePath);
    const fullPath = path.resolve(baseDir, normalizedPath);
    const relative = path.relative(baseDir, fullPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Resource path escapes the allowed directory: ${filePath}`);
    }

    return fullPath;
  }

  /**
   * Fetch resource from GitHub repository
   */
  private async getGithubResource(filePath: string): Promise<any> {
    const { REPO_OWNER: owner, REPO_NAME: repo, BRANCH: branch, BASE_PATH: basePath, TOKEN: token } = this.config.githubConfig!;

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

      // Choose parser based on extension
      const ext = path.extname(filePath).toLowerCase();
      const text = await response.text();
      if (ext === '.yaml' || ext === '.yml') {
        return YAML.parse(text);
      }
      return JSON.parse(text);
    } catch (error) {
      if (error instanceof Error) {
        resourceLogger.error({ error: error.message, url }, 'Failed to fetch from GitHub');
        throw new Error(`Unable to fetch from GitHub: ${error.message} (URL: ${url})`);
      }
      throw new Error('Unable to fetch resource from GitHub');
    }
  }

  /**
   * Fetch resource from GitHub repository with metadata (etag, last-modified)
   * Supports conditional requests to avoid unnecessary downloads
   */
  private async getGithubResourceWithMetadata(filePath: string, conditionalHeaders?: ConditionalHeaders): Promise<ResourceWithMetadata> {
    const { REPO_OWNER: owner, REPO_NAME: repo, BRANCH: branch, BASE_PATH: basePath, TOKEN: token } = this.config.githubConfig!;

    if (!owner || !repo) {
      throw new Error('GitHub configuration is incomplete');
    }

    const fullPath = basePath ? `${basePath}/${filePath}` : filePath;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}`;

    resourceLogger.debug({ mode: this.config.mode, url, conditionalHeaders }, 'Fetching resource with metadata from GitHub');

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      // Add conditional request headers if provided
      if (conditionalHeaders?.ifNoneMatch) {
        headers['If-None-Match'] = conditionalHeaders.ifNoneMatch;
      }
      if (conditionalHeaders?.ifModifiedSince) {
        headers['If-Modified-Since'] = conditionalHeaders.ifModifiedSince;
      }

      const response = await fetch(url, { headers });

      // Handle 304 Not Modified from GitHub
      if (response.status === 304) {
        resourceLogger.info({ filePath, url }, 'GitHub returned 304 Not Modified - cache still valid');
        return {
          data: undefined as any, // Data not needed when notModified is true
          metadata: {
            etag: conditionalHeaders?.ifNoneMatch,
            lastModified: conditionalHeaders?.ifModifiedSince,
            source: 'github'
          },
          notModified: true
        };
      }

      if (!response.ok) {
        if (response.status === 404) {
          resourceLogger.error({ filePath, url }, 'File not found on GitHub');
          throw new Error(`File not found on GitHub: ${filePath}`);
        }
        resourceLogger.error({ status: response.status, url }, 'HTTP error fetching from GitHub');
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Extract metadata from GitHub response headers
      const etag = response.headers.get('etag') || undefined;
      const lastModified = response.headers.get('last-modified') || undefined;

      const ext = path.extname(filePath).toLowerCase();
      const text = await response.text();
      const data = (ext === '.yaml' || ext === '.yml') ? YAML.parse(text) : JSON.parse(text);

      resourceLogger.info({ filePath, url, etag, lastModified }, 'Successfully fetched from GitHub with metadata');

      return {
        data,
        metadata: {
          etag,
          lastModified,
          source: 'github'
        },
        notModified: false
      };
    } catch (error) {
      if (error instanceof Error) {
        resourceLogger.error({ error: error.message, url }, 'Failed to fetch from GitHub with metadata');
        throw new Error(`Unable to fetch from GitHub: ${error.message} (URL: ${url})`);
      }
      throw new Error('Unable to fetch resource from GitHub');
    }
  }

  /**
   * Fetch raw resource content from GitHub repository
   */
  private async getGithubResourceRaw(filePath: string): Promise<string> {
    const { REPO_OWNER: owner, REPO_NAME: repo, BRANCH: branch, BASE_PATH: basePath, TOKEN: token } = this.config.githubConfig!;

    if (!owner || !repo) {
      throw new Error('GitHub configuration is incomplete');
    }

    const fullPath = basePath ? `${basePath}/${filePath}` : filePath;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}`;

    resourceLogger.debug({ mode: this.config.mode, url }, 'Fetching raw resource from GitHub');

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
        resourceLogger.error({ status: response.status, url }, 'HTTP error fetching raw from GitHub');
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      resourceLogger.info({ filePath, url }, 'Successfully fetched raw from GitHub');
      return await response.text();
    } catch (error) {
      if (error instanceof Error) {
        resourceLogger.error({ error: error.message, url }, 'Failed to fetch raw from GitHub');
        throw new Error(`Unable to fetch raw from GitHub: ${error.message} (URL: ${url})`);
      }
      throw new Error('Unable to fetch raw resource from GitHub');
    }
  }

  /**
   * Fetch raw resource content from GitHub repository with metadata
   * Supports conditional requests to avoid unnecessary downloads
   */
  private async getGithubResourceRawWithMetadata(filePath: string, conditionalHeaders?: ConditionalHeaders): Promise<ResourceWithMetadata<string>> {
    const { REPO_OWNER: owner, REPO_NAME: repo, BRANCH: branch, BASE_PATH: basePath, TOKEN: token } = this.config.githubConfig!;

    if (!owner || !repo) {
      throw new Error('GitHub configuration is incomplete');
    }

    const fullPath = basePath ? `${basePath}/${filePath}` : filePath;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}`;

    resourceLogger.debug({ mode: this.config.mode, url, conditionalHeaders }, 'Fetching raw resource with metadata from GitHub');

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      // Add conditional request headers if provided
      if (conditionalHeaders?.ifNoneMatch) {
        headers['If-None-Match'] = conditionalHeaders.ifNoneMatch;
      }
      if (conditionalHeaders?.ifModifiedSince) {
        headers['If-Modified-Since'] = conditionalHeaders.ifModifiedSince;
      }

      const response = await fetch(url, { headers });

      // Handle 304 Not Modified from GitHub
      if (response.status === 304) {
        const etag = response.headers.get('etag') || conditionalHeaders?.ifNoneMatch;
        const lastModified = response.headers.get('last-modified') || conditionalHeaders?.ifModifiedSince;

        resourceLogger.info({ filePath, url, etag, lastModified }, 'GitHub returned 304 Not Modified for raw resource - cache still valid');
        return {
          data: undefined as any, // Data not needed when notModified is true
          metadata: {
            etag,
            lastModified,
            source: 'github'
          },
          notModified: true
        };
      }

      if (!response.ok) {
        if (response.status === 404) {
          resourceLogger.error({ filePath, url }, 'File not found on GitHub');
          throw new Error(`File not found on GitHub: ${filePath}`);
        }
        resourceLogger.error({ status: response.status, url }, 'HTTP error fetching raw from GitHub');
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Extract metadata from GitHub response headers
      const etag = response.headers.get('etag') || undefined;
      const lastModified = response.headers.get('last-modified') || undefined;

      const data = await response.text();

      resourceLogger.info({ filePath, url, etag, lastModified }, 'Successfully fetched raw from GitHub with metadata');

      return {
        data,
        metadata: {
          etag,
          lastModified,
          source: 'github'
        },
        notModified: false
      };
    } catch (error) {
      if (error instanceof Error) {
        resourceLogger.error({ error: error.message, url }, 'Failed to fetch raw from GitHub with metadata');
        throw new Error(`Unable to fetch raw from GitHub: ${error.message} (URL: ${url})`);
      }
      throw new Error('Unable to fetch raw resource from GitHub');
    }
  }

  /**
   * Get current configuration mode
   */
  getMode(): string {
    return this.config.mode;
  }
}
