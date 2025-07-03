/**
 * Category Icons Module
 * 
 * This module provides a mapping between subcategory names and their corresponding Material-UI icons.
 * It supports automatic fallback to text display for unmapped or custom categories.
 * 
 * Usage:
 * ```typescript
 * import { getIconForSubcategory } from './categoryIcons';
 * 
 * const iconMapping = getIconForSubcategory('Mortgage');
 * if (iconMapping) {
 *   const Icon = iconMapping.icon;
 *   return <Icon fontSize="small" />;
 * }
 * ```
 * 
 * @module categoryIcons
 */

import {
  Home,
  Build,
  Receipt,
  LocalLaundryService,
  Wifi,
  Security,
  Power,
  Yard,
  Chair,
  Tv,
  ShoppingCart,
  Checkroom,
  Event,
  Pets,
  School,
  Toys,
  Group,
  LocalPharmacy,
  FitnessCenter,
  HealthAndSafety,
  ContentCut,
  LocalHospital,
  Healing,
  Visibility,
  MedicalServices,
  CarRepair,
  DirectionsBus,
  LocalGasStation,
  Toll,
  LocalParking,
  DirectionsCar,
  Restaurant,
  TakeoutDining,
  Fastfood,
  LocalMovies,
  LibraryMusic,
  Attractions,
  AccountBalance,
  Payments,
  Flight,
  Hotel,
  BeachAccess,
  DirectionsTransit,
  TravelExplore
} from '@mui/icons-material';
import { SvgIcon } from '@mui/material';

/**
 * Represents a mapping between a subcategory and its Material-UI icon.
 */
interface IconMapping {
  /** The Material-UI icon component to use */
  icon: typeof SvgIcon;
  /** Text to display in the tooltip when hovering over the icon */
  tooltip: string;
}

/**
 * Dictionary mapping subcategory names to their corresponding icons and tooltips.
 */
interface CategoryIconMappings {
  /** Each key is a subcategory name that maps to an IconMapping */
  [subcategoryName: string]: IconMapping;
}

export const categoryIcons: CategoryIconMappings = {
  // Household
  'Mortgage': { icon: Home, tooltip: 'Mortgage' },
  'Maintenance and Repairs': { icon: Build, tooltip: 'Maintenance and Repairs' },
  'Property Tax': { icon: Receipt, tooltip: 'Property Tax' },
  'Cleaning and Laundry': { icon: LocalLaundryService, tooltip: 'Cleaning and Laundry' },
  'Communication': { icon: Wifi, tooltip: 'Communication' },
  'Home Insurance': { icon: Security, tooltip: 'Home Insurance' },
  'Utilities': { icon: Power, tooltip: 'Utilities' },
  'Gardening': { icon: Yard, tooltip: 'Gardening' },

  // Shopping
  'Furniture and Decorations': { icon: Chair, tooltip: 'Furniture and Decorations' },
  'Appliances and Electronics': { icon: Tv, tooltip: 'Appliances and Electronics' },
  'Groceries': { icon: ShoppingCart, tooltip: 'Groceries' },
  'Apparel and Accessories': { icon: Checkroom, tooltip: 'Apparel and Accessories' },

  // Family
  'Activities': { icon: Event, tooltip: 'Activities' },
  'Pets': { icon: Pets, tooltip: 'Pets' },
  'School': { icon: School, tooltip: 'School' },
  'Toys': { icon: Toys, tooltip: 'Toys' },
  'Family Miscellaneous': { icon: Group, tooltip: 'Family Miscellaneous' },

  // Health
  'Pharm': { icon: LocalPharmacy, tooltip: 'Pharmacy' },
  'Fitness': { icon: FitnessCenter, tooltip: 'Fitness' },
  'Health Insurance': { icon: HealthAndSafety, tooltip: 'Health Insurance' },
  'Grooming': { icon: ContentCut, tooltip: 'Grooming' },
  'Health Services': { icon: LocalHospital, tooltip: 'Health Services' },
  'Dental': { icon: Healing, tooltip: 'Dental' },
  'Optometry': { icon: Visibility, tooltip: 'Optometry' },
  'Health Miscellaneous': { icon: MedicalServices, tooltip: 'Health Miscellaneous' },

  // Cars and Transportation
  'Car Services': { icon: CarRepair, tooltip: 'Car Services' },
  'Public Transportation': { icon: DirectionsBus, tooltip: 'Public Transportation' },
  'Fuel': { icon: LocalGasStation, tooltip: 'Fuel' },
  'Toll Roads': { icon: Toll, tooltip: 'Toll Roads' },
  'Parking': { icon: LocalParking, tooltip: 'Parking' },
  'Cars Miscellaneous': { icon: DirectionsCar, tooltip: 'Cars Miscellaneous' },

  // Eating Out
  'Coffee shops, Restaurant and Pubs': { icon: Restaurant, tooltip: 'Coffee shops, Restaurant and Pubs' },
  'Take Away': { icon: TakeoutDining, tooltip: 'Take Away' },
  'Eating Out - Miscellaneous': { icon: Fastfood, tooltip: 'Eating Out - Miscellaneous' },

  // Entertainment
  'Movies and Shows': { icon: LocalMovies, tooltip: 'Movies and Shows' },
  'Music and Reading': { icon: LibraryMusic, tooltip: 'Music and Reading' },
  'Entertainment - Miscellaneous': { icon: Attractions, tooltip: 'Entertainment - Miscellaneous' },

  // Miscellaneous and Financial
  'Taxes and Government': { icon: AccountBalance, tooltip: 'Taxes and Government' },
  'Fees': { icon: Payments, tooltip: 'Fees' },

  // Travel
  'Flights': { icon: Flight, tooltip: 'Flights' },
  'Hotels': { icon: Hotel, tooltip: 'Hotels' },
  'Recreation': { icon: BeachAccess, tooltip: 'Recreation' },
  'Travel Transportation': { icon: DirectionsTransit, tooltip: 'Travel Transportation' },
  'Travel - Miscellaneous': { icon: TravelExplore, tooltip: 'Travel - Miscellaneous' },
};

/**
 * Get the icon mapping for a given subcategory name.
 * 
 * This function looks up the subcategory name in the predefined icon mappings.
 * If no mapping is found, it returns null, allowing the UI to fall back to
 * displaying the subcategory name as text.
 * 
 * @param subcategoryName - The name of the subcategory to look up
 * @returns The icon mapping if found, null otherwise
 * 
 * @example
 * const mapping = getIconForSubcategory('Mortgage');
 * if (mapping) {
 *   return <mapping.icon fontSize="small" />;
 * } else {
 *   return <span>Mortgage</span>;
 * }
 */
export const getIconForSubcategory = (subcategoryName: string): IconMapping | null => {
  return categoryIcons[subcategoryName] || null;
};
