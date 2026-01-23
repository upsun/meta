/**
 * Utilities exports
 * Centralized export point for all utilities
 */

export { logger, configureLogger } from './logger.js';
export { ResourceManager } from './resource.manager.js';

export function escapeHtml(unsafe: string): string {
  return unsafe.replaceAll(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}