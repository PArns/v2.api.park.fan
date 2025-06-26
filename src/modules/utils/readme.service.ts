import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ReadmeService {
	private readonly readmePath: string;
	private readmeContent!: string;
	private readmeHtml!: string;
	private lastReadTime: number = 0;

	constructor() {
		// Get the path to the README.md file (root directory of the project)
		this.readmePath = join(process.cwd(), 'README.md');
		this.loadReadme();
	}

	/**
	 * Get the README content as HTML
	 * @returns README content as HTML
	 */
	getReadmeAsHtml(): string {
		// Check if README was modified since last read (every minute)
		const currentTime = Date.now();
		if (currentTime - this.lastReadTime > 60000) {
			this.loadReadme();
		}

		return this.readmeHtml;
	}

	/**
	 * Get the README content as raw markdown
	 * @returns README content as raw markdown
	 */
	getReadmeAsMarkdown(): string {
		// Check if README was modified since last read (every minute)
		const currentTime = Date.now();
		if (currentTime - this.lastReadTime > 60000) {
			this.loadReadme();
		}

		return this.readmeContent;
	}

	/**
	 * Load the README content from the file
	 * @private
	 */
	private loadReadme(): void {
		try {
			this.readmeContent = readFileSync(this.readmePath, 'utf8');
			this.readmeHtml = this.convertMarkdownToHtml(this.readmeContent);
			this.lastReadTime = Date.now();
		} catch {
			this.readmeContent = '# Error\nCould not load README.md';
			this.readmeHtml = '<h1>Error</h1><p>Could not load README.md</p>';
		}
	}

	/**
	 * Convert markdown to simple HTML
	 * @param markdown Markdown content
	 * @returns HTML content
	 * @private
	 */
	private convertMarkdownToHtml(markdown: string): string {
		// Simple HTML conversion - escape HTML and preserve line breaks
		const escapedMarkdown = markdown
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/\n/g, '<br>');

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Park.Fan API - Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f6f8fa;
        }
        
        .content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #0066cc;
            border-bottom: 2px solid #eaecef;
            padding-bottom: 0.3em;
            margin-bottom: 2rem;
        }
        
        .readme-content {
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 1.5rem;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid #d0d7de;
        }

        .api-info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            text-align: center;
        }

        .api-info h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
        }

        .api-info p {
            margin: 0;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="content">
        <div class="api-info">
            <h2>🎢 Park.Fan API v2.0</h2>
            <p>Theme Park Data & Analytics API</p>
        </div>
        
        <h1>📖 Documentation</h1>
        <div class="readme-content">${escapedMarkdown}</div>
    </div>
</body>
</html>
`;
	}
}
