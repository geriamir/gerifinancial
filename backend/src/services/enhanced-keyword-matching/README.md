# Enhanced Keyword Matching System

## Overview

The Enhanced Keyword Matching system provides intelligent, multilingual keyword matching with Hebrew Unicode support and false positive prevention. It replaces simple substring matching with sophisticated word boundary detection.

## Features

- **Hebrew Unicode Support**: Proper handling of Hebrew characters (U+0590-U+05FF)
- **False Positive Prevention**: Prevents "מסעדות" from matching "מס" keywords
- **Multi-Strategy Matching**: Exact phrase → Hebrew word → Stemmed word → AI
- **Performance Optimized**: Regex caching and efficient algorithms
- **Comprehensive Testing**: 50 tests with 100% pass rate

## Dependencies

### Required Dependencies

The following dependencies are **required** and must be installed:

```json
{
  "natural": "^6.12.0",
  "winston": "^3.11.0"
}
```

### Installation

Ensure all dependencies are installed before using this system:

```bash
npm install natural winston
```

### Dependency Error Handling

If you encounter errors related to missing dependencies, install them explicitly:

```bash
# Install natural language processing library
npm install natural

# Install winston logger
npm install winston
```

## Usage

```javascript
const { enhancedKeywordMatcher } = require('./enhanced-keyword-matching');

// Basic usage
const result = await enhancedKeywordMatcher.matchKeywords(
  'מסעדות טעימות', // Original text
  'delicious restaurants', // Translated text (optional)
  ['מס', 'מיסים', 'מע"מ'] // Keywords to match
);

console.log(result.hasMatches); // false (prevents false positive)
console.log(result.confidence); // 0
console.log(result.reasoning); // "No valid keyword matches found"
```

## API Reference

### `matchKeywords(text, translatedText, keywords, options)`

**Parameters:**
- `text` (string): Original text to search in
- `translatedText` (string): Translated version (optional)
- `keywords` (Array<string>): Keywords to match against
- `options` (Object): Optional matching configuration

**Returns:**
- `hasMatches` (boolean): Whether valid matches were found
- `matches` (Array): Array of match objects
- `confidence` (number): Overall confidence score (0-1)
- `reasoning` (string): Human-readable explanation
- `matchType` (string): Primary match type
- `processingTime` (number): Processing time in milliseconds

## Error Handling

### Dependency Errors

```javascript
try {
  const { enhancedKeywordMatcher } = require('./enhanced-keyword-matching');
  // Use the matcher...
} catch (error) {
  if (error.message.includes('Cannot find module')) {
    console.error('Missing dependency. Please run: npm install natural winston');
    process.exit(1);
  }
  throw error;
}
```

### Runtime Error Handling

```javascript
try {
  const result = await enhancedKeywordMatcher.matchKeywords(text, translatedText, keywords);
  // Process result...
} catch (error) {
  console.error('Keyword matching failed:', error.message);
  // Fallback to basic matching or return empty result
  return { hasMatches: false, confidence: 0, reasoning: 'Matching failed' };
}
```

## Hebrew Unicode Support

### Correct Patterns
- **Hebrew Detection**: `/[\u0590-\u05FF]+/` (U+0590-U+05FF)
- **Word Boundaries**: Uses Unicode word boundaries for proper matching
- **False Positive Prevention**: Built-in database of problematic patterns

### Example Usage
```javascript
// This will NOT match (prevents false positive)
const result1 = await enhancedKeywordMatcher.matchKeywords(
  'מסעדות', // restaurants
  '', 
  ['מס'] // tax
);
console.log(result1.hasMatches); // false

// This WILL match (legitimate case)
const result2 = await enhancedKeywordMatcher.matchKeywords(
  'תשלום מס הכנסה', // income tax payment
  '', 
  ['מס', 'מס הכנסה'] // tax keywords
);
console.log(result2.hasMatches); // true
console.log(result2.confidence); // 0.95
```

## Performance Considerations

- **Regex Caching**: Compiled patterns are cached for performance
- **Memory Management**: Use `clearCache()` to free memory if needed
- **Processing Time**: Typical processing time < 50ms per request

## Testing

Run the comprehensive test suite:

```bash
npm test -- enhanced-keyword-matching
```

Expected output:
```
✅ Enhanced Keyword Matcher: 50/50 tests passing (100%)
```

## Troubleshooting

### Common Issues

1. **Module Not Found Error**
   ```
   Error: Cannot find module 'natural'
   ```
   **Solution**: `npm install natural`

2. **Hebrew Characters Not Detected**
   - Ensure text encoding is UTF-8
   - Verify Hebrew Unicode range U+0590-U+05FF

3. **False Positives**
   - Check the false positive database in `isHebrewSubstringFalsePositive()`
   - Add new patterns as needed

### Debug Mode

Enable debug logging:

```javascript
const logger = require('../../utils/logger');
logger.level = 'debug';

// Enhanced keyword matcher will now log detailed matching steps
```

## Production Deployment

### Pre-deployment Checklist

- [ ] All dependencies installed (`npm install`)
- [ ] Tests passing (`npm test`)
- [ ] Hebrew Unicode patterns verified
- [ ] Error handling implemented
- [ ] Logging configured

### Monitoring

Monitor these metrics in production:
- Processing time (should be < 200ms)
- False positives blocked count
- Match accuracy rates
- Memory usage (clear cache periodically)

## Support

For issues or questions:
1. Check this README
2. Run the test suite
3. Review error logs
4. Verify dependencies are installed

---

**Note**: This system requires Node.js >=22.0.0 and proper UTF-8 encoding for Hebrew text processing.
