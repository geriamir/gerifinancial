/**
 * Icon Helper Utilities
 * 
 * This module provides utility functions for working with category icons,
 * including image loading, caching, and fallback logic.
 * 
 * @module iconHelpers
 */

/**
 * Cache for loaded images to avoid re-loading
 */
const imageCache = new Map<string, boolean>();

/**
 * Cache for failed images to avoid re-trying
 */
const imageErrorCache = new Set<string>();

/**
 * Preload an image and cache the result
 * @param src - The image source URL
 * @returns Promise that resolves when image is loaded or rejects on error
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check cache first
    if (imageCache.has(src)) {
      resolve();
      return;
    }
    
    if (imageErrorCache.has(src)) {
      reject(new Error(`Image previously failed to load: ${src}`));
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      imageCache.set(src, true);
      resolve();
    };
    
    img.onerror = () => {
      imageErrorCache.add(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
    
    img.src = src;
  });
};

/**
 * Preload multiple images in parallel
 * @param srcs - Array of image source URLs
 * @returns Promise that resolves when all images are loaded
 */
export const preloadImages = (srcs: string[]): Promise<void[]> => {
  return Promise.all(srcs.map(src => preloadImage(src)));
};

/**
 * Check if an image is already cached
 * @param src - The image source URL
 * @returns True if image is cached, false otherwise
 */
export const isImageCached = (src: string): boolean => {
  return imageCache.has(src);
};

/**
 * Check if an image has previously failed to load
 * @param src - The image source URL
 * @returns True if image has failed before, false otherwise
 */
export const hasImageFailed = (src: string): boolean => {
  return imageErrorCache.has(src);
};

/**
 * Clear the image cache (useful for testing or memory management)
 */
export const clearImageCache = (): void => {
  imageCache.clear();
  imageErrorCache.clear();
};

/**
 * Get the size of the image cache
 * @returns Number of cached images
 */
export const getImageCacheSize = (): number => {
  return imageCache.size;
};

/**
 * Get the size of the error cache
 * @returns Number of failed images
 */
export const getImageErrorCacheSize = (): number => {
  return imageErrorCache.size;
};

/**
 * Generate a fallback character for a given text
 * @param text - The text to generate fallback for
 * @returns Single character fallback
 */
export const generateFallbackChar = (text: string): string => {
  if (!text || text.length === 0) return 'M';
  
  // Try to get first letter of first word
  const firstWord = text.trim().split(' ')[0];
  if (firstWord.length > 0) {
    return firstWord[0].toUpperCase();
  }
  
  return 'M';
};

/**
 * Generate a fallback color based on text
 * @param text - The text to generate color for
 * @returns Hex color string
 */
export const generateFallbackColor = (text: string): string => {
  if (!text) return '#6b7280'; // gray-500
  
  // Simple hash function to generate consistent colors
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to hex color
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
};

/**
 * Debounce function for performance optimization
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Check if a URL is a valid image URL
 * @param url - URL to check
 * @returns True if URL appears to be an image
 */
export const isImageUrl = (url: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowercaseUrl = url.toLowerCase();
  
  return imageExtensions.some(ext => lowercaseUrl.includes(ext));
};

/**
 * Get the file extension from a URL
 * @param url - URL to extract extension from
 * @returns File extension or empty string
 */
export const getFileExtension = (url: string): string => {
  const match = url.match(/\.([^.?]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : '';
};

/**
 * Validate if a category icon path exists
 * @param iconPath - Path to the icon
 * @returns Promise that resolves if icon exists
 */
export const validateIconPath = (iconPath: string): Promise<boolean> => {
  return preloadImage(iconPath)
    .then(() => true)
    .catch(() => false);
};

/**
 * Get optimal image size based on device pixel ratio
 * @param baseSize - Base size in pixels
 * @returns Optimal size for current device
 */
export const getOptimalImageSize = (baseSize: number): number => {
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.ceil(baseSize * pixelRatio);
};

/**
 * Create a throttled image loader for better performance
 * @param maxConcurrent - Maximum number of concurrent loads
 * @returns Throttled image loader function
 */
export const createThrottledImageLoader = (maxConcurrent: number = 5) => {
  let currentLoads = 0;
  const queue: (() => void)[] = [];

  const processQueue = () => {
    if (queue.length > 0 && currentLoads < maxConcurrent) {
      const nextLoad = queue.shift()!;
      nextLoad();
    }
  };

  return (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const loadImage = () => {
        currentLoads++;
        preloadImage(src)
          .then(() => {
            currentLoads--;
            processQueue();
            resolve();
          })
          .catch((error) => {
            currentLoads--;
            processQueue();
            reject(error);
          });
      };

      if (currentLoads < maxConcurrent) {
        loadImage();
      } else {
        queue.push(loadImage);
      }
    });
  };
};
