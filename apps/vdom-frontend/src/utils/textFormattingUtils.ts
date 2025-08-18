import { h, ComponentChildren } from "preact";

/**
 * Utility functions for text formatting, particularly for processing markdown-style formatting
 * while preserving single asterisks used for bullet points
 */

/**
 * Converts text with **bold** markdown syntax to JSX elements with bold formatting
 * Preserves single * characters used for bullet points
 * @param text - The text to format
 * @returns Array of JSX elements with bold formatting applied
 */
export function formatTextWithBold(text: string): ComponentChildren[] {
  if (!text) return [text];

  // More precise regex that matches **text** but not single * or *** patterns
  // This regex looks for ** followed by non-* characters, then **
  const parts = text.split(/(\*\*[^*\s][^*]*[^*\s]\*\*|\*\*[^*\s]\*\*)/g);
  
  return parts.map((part, index) => {
    // Check if this part is bold text (wrapped in ** with content that's not just *)
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const content = part.slice(2, -2);
      // Additional check to ensure it's not just asterisks or whitespace
      if (content.trim() && !content.match(/^\*+$/)) {
        return h('strong', { key: index }, content);
      }
    }
    // Regular text - return as is (preserves single * for bullet points)
    return part;
  });
}

/**
 * Converts text with basic markdown formatting to JSX elements
 * Currently supports:
 * - **bold text** (preserves single * for bullet points)
 * @param text - The text to format
 * @returns Array of JSX elements with formatting applied
 */
export function formatMarkdownText(text: string): ComponentChildren[] {
  return formatTextWithBold(text);
}
