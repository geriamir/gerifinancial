const mongoose = require('mongoose');
const { createTestUser } = require('../../test/testUtils');
const { User, Category, SubCategory, VendorMapping } = require('..');

describe('VendorMapping Model', () => {
  let user;
  let category;
  let subCategory;

  beforeEach(async () => {
    const testData = await createTestUser(User);
    user = testData.user;

    category = await Category.create({
      name: 'Food',
      type: 'Expense',
      userId: user._id
    });

    subCategory = await SubCategory.create({
      name: 'Restaurants',
      keywords: ['restaurant', 'cafe'],
      parentCategory: category._id,
      userId: user._id
    });
  });

  describe('findOrCreate', () => {
    it('should create new vendor mapping', async () => {
      const vendorData = {
        vendorName: 'test cafe',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id,
        language: 'he'
      };

      const mapping = await VendorMapping.findOrCreate(vendorData);

      expect(mapping.vendorName).toBe('test cafe');
      expect(mapping.userId.toString()).toBe(user._id.toString());
      expect(mapping.category.toString()).toBe(category._id.toString());
      expect(mapping.subCategory.toString()).toBe(subCategory._id.toString());
      expect(mapping.matchCount).toBe(1);
      expect(mapping.confidence).toBe(1.0);
    });

    it('should update existing vendor mapping', async () => {
      const vendorData = {
        vendorName: 'test cafe',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id
      };

      const firstMapping = await VendorMapping.findOrCreate(vendorData);
      const updatedMapping = await VendorMapping.findOrCreate(vendorData);

      expect(updatedMapping._id.toString()).toBe(firstMapping._id.toString());
      expect(updatedMapping.matchCount).toBe(2);
    });

    it('should enforce unique vendor names per user', async () => {
      const vendorData = {
        vendorName: 'test cafe',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id
      };

      await VendorMapping.findOrCreate(vendorData);

      // Create another user and try to use the same vendor name
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123'
      });

      const otherVendorData = {
        ...vendorData,
        userId: otherUser._id
      };

      const otherMapping = await VendorMapping.findOrCreate(otherVendorData);
      expect(otherMapping.vendorName).toBe('test cafe');
      expect(otherMapping.userId.toString()).toBe(otherUser._id.toString());
    });
  });

  describe('findMatches', () => {
    it('should find exact matches', async () => {
      const vendorData = {
        vendorName: 'test cafe',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id
      };

      await VendorMapping.findOrCreate(vendorData);
      const matches = await VendorMapping.findMatches('test cafe', user._id);

      expect(matches).toHaveLength(1);
      expect(matches[0].vendorName).toBe('test cafe');
    });

    it('should handle no matches', async () => {
      const matches = await VendorMapping.findMatches('nonexistent vendor', user._id);
      expect(matches).toHaveLength(0);
    });
  });

  describe('suggestMapping', () => {
    it('should find similar vendors', async () => {
      const vendorData = {
        vendorName: 'coffee shop tel aviv',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id
      };

      await VendorMapping.findOrCreate(vendorData);
      const suggestion = await VendorMapping.suggestMapping('coffee shop jerusalem', user._id);

      expect(suggestion).toBeTruthy();
      expect(suggestion.vendorName).toBe('coffee shop tel aviv');
    });

    it('should return null for no similar vendors', async () => {
      const suggestion = await VendorMapping.suggestMapping('completely different', user._id);
      expect(suggestion).toBeNull();
    });
  });
});
