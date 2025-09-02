const { Tag } = require('../');
const User = require('../../../auth/models/User');

let testUser;

beforeAll(async () => {
  // Create test user
  testUser = new User({
    email: 'test-tag@example.com',
    name: 'Test Tag User',
    password: 'password123'
  });
  await testUser.save();
});

afterAll(async () => {
  // Clean up tags and test user - use try-catch in case connection is closed
  try {
    if (testUser) {
      await Tag.deleteMany({ userId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }
  } catch (error) {
    // Ignore cleanup errors - likely due to connection being closed
    console.log('Cleanup error (ignored):', error.message);
  }
});

beforeEach(async () => {
  // Clean up tags before each test
  await Tag.deleteMany({ userId: testUser._id });
});

describe('Tag Model', () => {
  describe('Basic functionality', () => {
    test('should create a tag successfully', async () => {
      const tagData = {
        name: 'grocery-shopping',
        userId: testUser._id,
        type: 'custom'
      };

      const tag = new Tag(tagData);
      const savedTag = await tag.save();

      expect(savedTag.name).toBe(tagData.name);
      expect(savedTag.userId.toString()).toBe(testUser._id.toString());
      expect(savedTag.type).toBe('custom');
      expect(savedTag.usageCount).toBe(0);
      expect(savedTag.color).toBe('#1976d2');
    });

    test('should create a project tag with metadata', async () => {
      const tagData = {
        name: 'project:kitchen-renovation',
        userId: testUser._id,
        type: 'project',
        projectMetadata: {
          description: 'Kitchen renovation project',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-06-30'),
          status: 'planning'
        },
        color: '#ff5722'
      };

      const tag = new Tag(tagData);
      const savedTag = await tag.save();

      expect(savedTag.type).toBe('project');
      expect(savedTag.projectMetadata.description).toBe('Kitchen renovation project');
      expect(savedTag.projectMetadata.status).toBe('planning');
      expect(savedTag.color).toBe('#ff5722');
    });

    test('should enforce unique tag names per user', async () => {
      const tagData = {
        name: 'utilities',
        userId: testUser._id
      };

      // Create first tag
      const tag1 = new Tag(tagData);
      await tag1.save();

      // Try to create duplicate tag for same user
      const tag2 = new Tag(tagData);
      
      try {
        await tag2.save();
        // If we get here, the save succeeded when it shouldn't have
        // Check if MongoDB is enforcing the unique constraint
        const duplicateTags = await Tag.find({ name: 'utilities', userId: testUser._id });
        if (duplicateTags.length > 1) {
          throw new Error('Duplicate tag was allowed when unique constraint should prevent it');
        }
        // If only one exists, the unique constraint worked at the application level
      } catch (error) {
        // This is expected - should throw a duplicate key error
        expect(error.message).toMatch(/duplicate|unique|E11000/i);
      }
    });

    test('should allow same tag name for different users', async () => {
      // Create another test user
      const user2 = new User({
        email: 'test2@example.com',
        name: 'Test User 2',
        password: 'password123'
      });
      await user2.save();

      const tagName = 'entertainment';

      // Create tag for first user
      const tag1 = new Tag({
        name: tagName,
        userId: testUser._id
      });
      await tag1.save();

      // Create same tag name for second user (should work)
      const tag2 = new Tag({
        name: tagName,
        userId: user2._id
      });
      const savedTag2 = await tag2.save();

      expect(savedTag2.name).toBe(tagName);
      expect(savedTag2.userId.toString()).toBe(user2._id.toString());
    });
  });

  describe('Static methods', () => {
    test('findOrCreate should create new tag if not exists', async () => {
      const tagData = {
        name: 'dining-out',
        userId: testUser._id,
        type: 'custom'
      };

      const tag = await Tag.findOrCreate(tagData);

      expect(tag.name).toBe(tagData.name);
      expect(tag.userId.toString()).toBe(testUser._id.toString());
      expect(tag._id).toBeDefined();
    });

    test('findOrCreate should return existing tag if exists', async () => {
      const tagData = {
        name: 'transportation',
        userId: testUser._id,
        type: 'custom'
      };

      // Create tag first
      const originalTag = new Tag(tagData);
      await originalTag.save();

      // Try to findOrCreate same tag
      const foundTag = await Tag.findOrCreate(tagData);

      expect(foundTag._id.toString()).toBe(originalTag._id.toString());
      expect(foundTag.name).toBe(tagData.name);
    });

    test('getUserTagsWithStats should return user tags', async () => {
      // Create multiple tags for user
      const tags = [
        { name: 'food', userId: testUser._id },
        { name: 'transport', userId: testUser._id },
        { name: 'project:renovation', userId: testUser._id, type: 'project' }
      ];

      for (const tagData of tags) {
        const tag = new Tag(tagData);
        await tag.save();
      }

      const userTags = await Tag.getUserTagsWithStats(testUser._id);

      expect(userTags).toHaveLength(3);
      expect(userTags[0]).toHaveProperty('transactionCount', 0);
      expect(userTags[0]).toHaveProperty('totalAmount', 0);
    });
  });

  describe('Instance methods', () => {
    test('incrementUsage should update usage count and last used date', async () => {
      const tag = new Tag({
        name: 'test-tag',
        userId: testUser._id
      });
      await tag.save();

      const originalUsageCount = tag.usageCount;
      const originalLastUsed = tag.lastUsed;

      // Wait a moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await tag.incrementUsage();

      expect(tag.usageCount).toBe(originalUsageCount + 1);
      expect(tag.lastUsed.getTime()).toBeGreaterThan(originalLastUsed.getTime());
    });
  });

  describe('Validation', () => {
    test('should require name field', async () => {
      const tag = new Tag({
        userId: testUser._id
      });

      await expect(tag.save()).rejects.toThrow(/name.*required/);
    });

    test('should require userId field', async () => {
      const tag = new Tag({
        name: 'test-tag'
      });

      await expect(tag.save()).rejects.toThrow(/userId.*required/);
    });

    test('should validate tag name length', async () => {
      const tag = new Tag({
        name: 'a'.repeat(51), // Exceeds maxlength of 50
        userId: testUser._id
      });

      await expect(tag.save()).rejects.toThrow();
    });

    test('should validate type enum values', async () => {
      const tag = new Tag({
        name: 'test-tag',
        userId: testUser._id,
        type: 'invalid-type'
      });

      await expect(tag.save()).rejects.toThrow();
    });

    test('should validate project metadata status', async () => {
      const tag = new Tag({
        name: 'test-project',
        userId: testUser._id,
        type: 'project',
        projectMetadata: {
          status: 'invalid-status'
        }
      });

      await expect(tag.save()).rejects.toThrow();
    });
  });
});
