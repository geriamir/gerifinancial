/**
 * URL encoding utilities for handling special characters in account numbers and other identifiers
 */

/**
 * Encodes an account number for safe use in URLs
 * Handles special characters like slashes that are common in foreign currency account numbers
 * 
 * @param accountNumber - The account number to encode
 * @returns The URL-encoded account number
 */
export const encodeAccountNumber = (accountNumber: string): string => {
  return encodeURIComponent(accountNumber);
};

/**
 * Decodes a URL-encoded account number
 * 
 * @param encodedAccountNumber - The URL-encoded account number
 * @returns The decoded account number
 */
export const decodeAccountNumber = (encodedAccountNumber: string): string => {
  return decodeURIComponent(encodedAccountNumber);
};

/**
 * Safely encodes any identifier for URL use
 * Can be used for account numbers, transaction IDs, or other identifiers with special characters
 * 
 * @param identifier - The identifier to encode
 * @returns The URL-encoded identifier
 */
export const encodeIdentifier = (identifier: string): string => {
  return encodeURIComponent(identifier);
};

/**
 * Decodes a URL-encoded identifier
 * 
 * @param encodedIdentifier - The URL-encoded identifier
 * @returns The decoded identifier
 */
export const decodeIdentifier = (encodedIdentifier: string): string => {
  return decodeURIComponent(encodedIdentifier);
};
