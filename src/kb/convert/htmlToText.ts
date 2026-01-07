import { convert } from 'html-to-text';

/**
 * Convert HTML to clean text/markdown
 */
export function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      // Remove scripts and styles
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'noscript', format: 'skip' },
      // Keep links as markdown
      {
        selector: 'a',
        options: {
          linkBrackets: ['[', ']'],
        },
      },
      // Format headings
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'h3', options: { uppercase: false } },
      // Format code blocks
      { selector: 'pre', format: 'block' },
      { selector: 'code', format: 'inline' },
      // Skip navigation and footer
      { selector: 'nav', format: 'skip' },
      { selector: 'footer', format: 'skip' },
      { selector: 'header', format: 'skip' },
      // Skip images (we can't process them)
      { selector: 'img', format: 'skip' },
    ],
  });
}

/**
 * Clean up extracted text
 */
export function cleanText(text: string): string {
  return (
    text
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace from lines
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Remove empty lines at start/end
      .trim()
  );
}

export default htmlToText;
