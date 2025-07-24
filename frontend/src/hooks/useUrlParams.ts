/**
 * NAVIGATION SIMPLIFICATION - Hook Status
 * 
 * Status: ⏳ IN PROGRESS
 * Phase: 1.3
 * Last Updated: July 23, 2025
 * 
 * Implementation Notes:
 * - URL parameter management hook for query-based routing
 * - Type-safe parameter validation and conversion
 * - Default value handling with fallbacks
 * - URL synchronization for navigation state persistence
 * - Testing status: Pending
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Type definitions for URL parameter handling
export interface UrlParamConfig<T = string> {
  key: string;
  defaultValue?: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  validate?: (value: T) => boolean;
}

export interface UrlParamsOptions {
  replaceState?: boolean;
  preserveOtherParams?: boolean;
}

// Common parameter types
export type ParamValue = string | number | boolean | string[] | null | undefined;

// Serialization utilities
const serialize = {
  string: (value: string): string => value,
  number: (value: number): string => value.toString(),
  boolean: (value: boolean): string => value.toString(),
  stringArray: (value: string[]): string => value.join(','),
  date: (value: Date): string => value.toISOString().split('T')[0] // YYYY-MM-DD format
};

const deserialize = {
  string: (value: string): string => value,
  number: (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  },
  boolean: (value: string): boolean => value === 'true',
  stringArray: (value: string): string[] => value ? value.split(',').filter(Boolean) : [],
  date: (value: string): Date => new Date(value)
};

// Validation utilities
const validate = {
  string: (value: string): boolean => typeof value === 'string',
  number: (value: number): boolean => typeof value === 'number' && !isNaN(value),
  boolean: (value: boolean): boolean => typeof value === 'boolean',
  stringArray: (value: string[]): boolean => Array.isArray(value),
  date: (value: Date): boolean => value instanceof Date && !isNaN(value.getTime())
};

/**
 * Hook for managing URL query parameters with type safety
 * 
 * @example
 * const { getParam, setParam, setParams, getAllParams, clearParam } = useUrlParams();
 * 
 * // Get a string parameter
 * const category = getParam('category', 'all');
 * 
 * // Get a typed parameter
 * const page = getParam('page', 1, { deserialize: deserialize.number });
 * 
 * // Set a parameter
 * setParam('category', 'food');
 * 
 * // Set multiple parameters
 * setParams({ category: 'food', page: 2 });
 */
export const useUrlParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * Get a parameter value with optional type conversion and validation
   */
  const getParam = useCallback(<T extends ParamValue>(
    key: string,
    defaultValue?: T,
    config?: {
      deserialize?: (value: string) => T;
      validate?: (value: T) => boolean;
    }
  ): T => {
    const rawValue = searchParams.get(key);
    
    if (rawValue === null) {
      return defaultValue as T;
    }

    let value: T;
    
    if (config?.deserialize) {
      try {
        value = config.deserialize(rawValue);
      } catch {
        return defaultValue as T;
      }
    } else {
      value = rawValue as T;
    }

    if (config?.validate && !config.validate(value)) {
      return defaultValue as T;
    }

    return value;
  }, [searchParams]);

  /**
   * Get multiple parameters as an object
   */
  const getParams = useCallback(<T extends Record<string, ParamValue>>(
    configs: { [K in keyof T]: UrlParamConfig<T[K]> }
  ): T => {
    const result = {} as T;
    
    for (const [key, config] of Object.entries(configs)) {
      result[key as keyof T] = getParam(
        config.key,
        config.defaultValue,
        {
          deserialize: config.deserialize,
          validate: config.validate
        }
      );
    }
    
    return result;
  }, [getParam]);

  /**
   * Set a single parameter
   */
  const setParam = useCallback(<T extends ParamValue>(
    key: string,
    value: T,
    options: UrlParamsOptions & {
      serialize?: (value: T) => string;
    } = {}
  ) => {
    const { replaceState = false, preserveOtherParams = true, serialize: customSerialize } = options;
    
    const newParams = preserveOtherParams ? new URLSearchParams(searchParams) : new URLSearchParams();
    
    if (value === null || value === undefined || value === '') {
      newParams.delete(key);
    } else {
      let serializedValue: string;
      
      if (customSerialize) {
        serializedValue = customSerialize(value);
      } else if (typeof value === 'string') {
        serializedValue = value;
      } else if (Array.isArray(value)) {
        serializedValue = value.join(',');
      } else {
        serializedValue = String(value);
      }
      
      newParams.set(key, serializedValue);
    }
    
    setSearchParams(newParams, { replace: replaceState });
  }, [searchParams, setSearchParams]);

  /**
   * Set multiple parameters at once
   */
  const setParams = useCallback(<T extends Record<string, ParamValue>>(
    params: Partial<T>,
    options: UrlParamsOptions = {}
  ) => {
    const { replaceState = false, preserveOtherParams = true } = options;
    
    const newParams = preserveOtherParams ? new URLSearchParams(searchParams) : new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') {
        newParams.delete(key);
      } else {
        let serializedValue: string;
        
        if (typeof value === 'string') {
          serializedValue = value;
        } else if (Array.isArray(value)) {
          serializedValue = value.join(',');
        } else {
          serializedValue = String(value);
        }
        
        newParams.set(key, serializedValue);
      }
    }
    
    setSearchParams(newParams, { replace: replaceState });
  }, [searchParams, setSearchParams]);

  /**
   * Clear a specific parameter
   */
  const clearParam = useCallback((key: string, options: UrlParamsOptions = {}) => {
    const { replaceState = false } = options;
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    setSearchParams(newParams, { replace: replaceState });
  }, [searchParams, setSearchParams]);

  /**
   * Clear all parameters
   */
  const clearAllParams = useCallback((options: UrlParamsOptions = {}) => {
    const { replaceState = false } = options;
    setSearchParams(new URLSearchParams(), { replace: replaceState });
  }, [setSearchParams]);

  /**
   * Get all current parameters as an object
   */
  const getAllParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {};
    Array.from(searchParams.entries()).forEach(([key, value]) => {
      params[key] = value;
    });
    return params;
  }, [searchParams]);

  /**
   * Check if a parameter exists
   */
  const hasParam = useCallback((key: string): boolean => {
    return searchParams.has(key);
  }, [searchParams]);

  /**
   * Navigate to a new URL with parameters
   */
  const navigateWithParams = useCallback(<T extends Record<string, ParamValue>>(
    path: string,
    params?: Partial<T>,
    options: { replace?: boolean } = {}
  ) => {
    const { replace = false } = options;
    
    if (params && Object.keys(params).length > 0) {
      const urlParams = new URLSearchParams();
      
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') {
          let serializedValue: string;
          
          if (typeof value === 'string') {
            serializedValue = value;
          } else if (Array.isArray(value)) {
            serializedValue = value.join(',');
          } else {
            serializedValue = String(value);
          }
          
          urlParams.set(key, serializedValue);
        }
      }
      
      const queryString = urlParams.toString();
      const fullPath = queryString ? `${path}?${queryString}` : path;
      navigate(fullPath, { replace });
    } else {
      navigate(path, { replace });
    }
  }, [navigate]);

  // Memoized return object
  return useMemo(() => ({
    // Parameter getters
    getParam,
    getParams,
    getAllParams,
    hasParam,
    
    // Parameter setters
    setParam,
    setParams,
    clearParam,
    clearAllParams,
    
    // Navigation helpers
    navigateWithParams,
    
    // Common serializers/deserializers for convenience
    serialize,
    deserialize,
    validate,
    
    // Raw search params access for advanced use cases
    searchParams
  }), [
    getParam,
    getParams,
    getAllParams,
    hasParam,
    setParam,
    setParams,
    clearParam,
    clearAllParams,
    navigateWithParams,
    searchParams
  ]);
};

// Convenience hooks for common parameter types
export const useStringParam = (key: string, defaultValue = '') => {
  const { getParam, setParam } = useUrlParams();
  return [
    getParam(key, defaultValue),
    (value: string) => setParam(key, value)
  ] as const;
};

export const useNumberParam = (key: string, defaultValue = 0) => {
  const { getParam, setParam } = useUrlParams();
  return [
    getParam(key, defaultValue, { deserialize: deserialize.number, validate: validate.number }),
    (value: number) => setParam(key, value, { serialize: serialize.number })
  ] as const;
};

export const useBooleanParam = (key: string, defaultValue = false) => {
  const { getParam, setParam } = useUrlParams();
  return [
    getParam(key, defaultValue, { deserialize: deserialize.boolean, validate: validate.boolean }),
    (value: boolean) => setParam(key, value, { serialize: serialize.boolean })
  ] as const;
};

export const useArrayParam = (key: string, defaultValue: string[] = []) => {
  const { getParam, setParam } = useUrlParams();
  return [
    getParam(key, defaultValue, { deserialize: deserialize.stringArray, validate: validate.stringArray }),
    (value: string[]) => setParam(key, value, { serialize: serialize.stringArray })
  ] as const;
};

export default useUrlParams;
