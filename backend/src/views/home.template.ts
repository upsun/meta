interface Endpoint {
  method: string;
  path: string;
  description: string;
  example: string;
}

import { escapeHtml } from '../utils/index.js';

export function generateHomePage(endpoints: Endpoint[], baseUrl: string, version: string): string {
  const endpointListHTML = endpoints.map(endpoint => `
                <div class="endpoint">
                    <div>
                        <span class="endpoint-method">${escapeHtml(endpoint.method)}</span>
                        <span class="endpoint-path">${escapeHtml(endpoint.path)}</span>
                    </div>
                    <div class="endpoint-desc">
                        ${escapeHtml(endpoint.description)}
                    </div>
                    <div class="endpoint-example">
                        curl ${escapeHtml(baseUrl)}${escapeHtml(endpoint.path.replace(/\{[^}]+\}/g, match => {
                          // Replace {name} with example value
                          if (match === '{name}') return 'nodejs';
                          if (match === '{regionId}') return 'eu-5.platform';
                          return match;
                        }))}
                    </div>
                </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upsun Meta Registry</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: rgb(255, 255, 255);
            background: rgb(14, 17, 19);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            max-width: 800px;
            width: 100%;
            padding: 40px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
        }

        .logo {
            font-size: 48px;
            margin-bottom: 10px;
        }

        h1 {
            color: rgb(213, 248, 0);
            font-size: 32px;
            margin-bottom: 10px;
        }

        .subtitle {
            color: rgba(255, 255, 255, 0.7);
            font-size: 16px;
        }

        .version {
            display: inline-block;
            background: rgba(213, 248, 0, 0.2);
            color: rgb(213, 248, 0);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
        }

        .main-link {
            display: block;
            background: rgb(96, 70, 255);
            color: white;
            text-decoration: none;
            padding: 20px 30px;
            border-radius: 12px;
            text-align: center;
            font-size: 18px;
            font-weight: 600;
            margin: 30px 0;
            transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
            box-shadow: 0 4px 12px rgba(96, 70, 255, 0.3);
        }

        .main-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(96, 70, 255, 0.5);
            background: rgba(96, 70, 255, 0.9);
        }

        .main-link .icon {
            font-size: 24px;
            margin-right: 10px;
        }

        .endpoints {
            margin-top: 30px;
        }

        .endpoints h2 {
            color: rgb(255, 255, 255);
            font-size: 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .endpoint-list {
            display: grid;
            gap: 12px;
        }

        .endpoint {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 16px;
            transition: border-color 0.2s, background 0.2s;
        }

        .endpoint:hover {
            border-color: rgb(213, 248, 0);
            background: rgba(255, 255, 255, 0.05);
        }

        .endpoint-method {
            display: inline-block;
            background: rgb(213, 248, 0);
            color: rgb(14, 17, 19);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
        }

        .endpoint-path {
            font-family: 'Courier New', monospace;
            color: rgb(213, 248, 0);
            font-weight: 600;
        }

        .endpoint-desc {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            margin-top: 8px;
        }

        .endpoint-example {
            background: rgba(255, 255, 255, 0.05);
            border-left: 3px solid rgb(96, 70, 255);
            padding: 8px 12px;
            margin-top: 8px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            border-radius: 4px;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin: 30px 0;
        }

        .feature {
            text-align: center;
            padding: 20px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            transition: border-color 0.2s;
        }

        .feature:hover {
            border-color: rgba(213, 248, 0, 0.3);
        }

        .feature-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .feature-title {
            font-weight: 600;
            color: rgb(255, 255, 255);
            margin-bottom: 4px;
        }

        .feature-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.6);
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
        }

        .footer a {
            color: rgb(213, 248, 0);
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        @media (max-width: 640px) {
            .container {
                padding: 24px;
            }

            h1 {
                font-size: 24px;
            }

            .features {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀</div>
            <h1>Upsun Meta Registry</h1>
            <p class="subtitle">Upsun Service Registry API</p>
            <span class="version">v${version}</span>
            <p><strong>Disclaimer:</strong> This tool is in a BETA version. While we strive for accuracy, data may not be complete or up-to-date. Use at your own discretion.</p>
        </div>

        <a href="/api-docs" class="main-link">
            <span class="icon">📚</span>
            Access Interactive Documentation (Scalar)
        </a>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">🖼️</div>
                <div class="feature-title">Container Images</div>
                <div class="feature-desc">Complete registry of available images</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🌍</div>
                <div class="feature-title">Regions</div>
                <div class="feature-desc">Global infrastructure locations</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📦</div>
                <div class="feature-title">Versions</div>
                <div class="feature-desc">Detailed version information</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🔗</div>
                <div class="feature-title">Endpoints</div>
                <div class="feature-desc">Registry access points</div>
            </div>
        </div>

        <div class="endpoints">
            <h2>🔌 API Endpoints</h2>
            <div class="endpoint-list">
${endpointListHTML}
            </div>
        </div>

        <div class="footer">
            <p>
                Powered by <strong>Express</strong> + <strong>Zod</strong> + <strong>Scalar</strong>
                <br>
                Upsun © ${new Date().getFullYear()} All rights reserved.
                <br>
                <a href="https://docs.upsun.com" target="_blank">Upsun Docs</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}
