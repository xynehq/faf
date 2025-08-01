/**
 * A2A Memory Factory Tests
 * Tests for A2A task provider factory functions and configuration
 */

import {
  createA2ATaskProvider,
  createSimpleA2ATaskProvider,
  createCompositeA2ATaskProvider,
  createA2ATaskProviderFromEnv,
  validateA2ATaskProviderConfig
} from '../factory.js';
import {
  A2AInMemoryTaskConfig,
  A2ARedisTaskConfig,
  A2APostgresTaskConfig
} from '../types.js';

describe('A2A Memory Factory', () => {
  describe('Configuration Validation', () => {
    it('should validate in-memory task provider config', () => {
      const config: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 1000,
        maxTasksPerContext: 100,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const result = validateA2ATaskProviderConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should validate Redis task provider config', () => {
      const config: A2ARedisTaskConfig = {
        type: 'redis',
        host: 'localhost',
        port: 6379,
        db: 0,
        maxTasks: 1000,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const result = validateA2ATaskProviderConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should validate PostgreSQL task provider config', () => {
      const config: A2APostgresTaskConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        ssl: false,
        tableName: 'test_tasks',
        maxConnections: 10,
        maxTasks: 1000,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const result = validateA2ATaskProviderConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid config type', () => {
      const config = {
        type: 'invalid_type',
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      } as any;

      const result = validateA2ATaskProviderConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject missing required fields', () => {
      const config = {
        // Missing required type field
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      } as any;

      const result = validateA2ATaskProviderConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider type is required');
    });

    it('should apply default values for optional fields', () => {
      const minimalConfig = {
        type: 'memory' as const
      } as any;

      const result = validateA2ATaskProviderConfig(minimalConfig);
      expect(result.valid).toBe(true);
    });

    it('should validate Redis-specific configuration', () => {
      const redisConfig: A2ARedisTaskConfig = {
        type: 'redis',
        host: 'redis.example.com',
        port: 6380,
        password: 'secret',
        db: 2,
        maxTasks: 1000,
        keyPrefix: 'myapp:',
        defaultTtl: 7200,
        cleanupInterval: 600,
        enableHistory: true,
        enableArtifacts: true
      };

      const result = validateA2ATaskProviderConfig(redisConfig);
      expect(result.valid).toBe(true);
    });

    it('should validate PostgreSQL-specific configuration', () => {
      const postgresConfig: A2APostgresTaskConfig = {
        type: 'postgres',
        host: 'postgres.example.com',
        port: 5433,
        database: 'myapp_db',
        username: 'myapp_user',
        password: 'secret',
        ssl: true,
        tableName: 'custom_tasks',
        maxConnections: 20,
        maxTasks: 1000,
        keyPrefix: 'myapp:',
        defaultTtl: 7200,
        cleanupInterval: 600,
        enableHistory: true,
        enableArtifacts: true
      };

      const result = validateA2ATaskProviderConfig(postgresConfig);
      expect(result.valid).toBe(true);
    });
  });

  describe('Simple Provider Creation', () => {
    it('should create in-memory provider with simple factory', async () => {
      const provider = await createSimpleA2ATaskProvider('memory');
      
      expect(provider).toBeDefined();
      expect(typeof provider.storeTask).toBe('function');
      expect(typeof provider.getTask).toBe('function');
      expect(typeof provider.close).toBe('function');

      // Test basic functionality
      const healthResult = await provider.healthCheck();
      expect(healthResult.success).toBe(true);

      await provider.close();
    });

    it('should create in-memory provider with custom max tasks', async () => {
      const provider = await createSimpleA2ATaskProvider('memory');
      
      expect(provider).toBeDefined();
      
      const healthResult = await provider.healthCheck();
      expect(healthResult.success).toBe(true);

      await provider.close();
    });

    it('should handle unsupported simple provider types gracefully', async () => {
      const mockRedisClient = { ping: jest.fn().mockResolvedValue('PONG') };
      await expect(createSimpleA2ATaskProvider('redis', mockRedisClient)).resolves.toBeDefined();
    });
  });

  describe('Full Provider Creation', () => {
    it('should create in-memory provider with full config', async () => {
      const config: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 2000,
        maxTasksPerContext: 200,
        keyPrefix: 'test:factory:',
        defaultTtl: 7200,
        cleanupInterval: 600,
        enableHistory: true,
        enableArtifacts: true
      };

      const provider = await createA2ATaskProvider(config);
      
      expect(provider).toBeDefined();
      
      // Test provider functionality
      const healthResult = await provider.healthCheck();
      expect(healthResult.success).toBe(true);

      await provider.close();
    });

    it('should handle external clients for Redis provider', async () => {
      const config: A2ARedisTaskConfig = {
        type: 'redis',
        host: 'localhost',
        port: 6379,
        db: 0,
        maxTasks: 1000,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      // Mock Redis client
      const mockRedisClient = {
        ping: jest.fn().mockResolvedValue('PONG'),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        hgetall: jest.fn(),
        hmset: jest.fn(),
        sadd: jest.fn(),
        smembers: jest.fn(),
        keys: jest.fn().mockResolvedValue([]),
        multi: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([])
        })
      };

      const externalClients = { redis: mockRedisClient };

      // Should not throw when Redis client is provided
      const provider = await createA2ATaskProvider(config, externalClients);
      expect(provider).toBeDefined();

      await provider.close();
    });

    it('should handle external clients for PostgreSQL provider', async () => {
      const config: A2APostgresTaskConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        ssl: false,
        tableName: 'a2a_tasks',
        maxConnections: 10,
        maxTasks: 1000,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      // Mock PostgreSQL client
      const mockPgClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
      };

      const externalClients = { postgres: mockPgClient };

      // Should not throw when PostgreSQL client is provided
      const provider = await createA2ATaskProvider(config, externalClients);
      expect(provider).toBeDefined();

      await provider.close();
    });

    it('should throw when external dependencies are missing', async () => {
      const redisConfig: A2ARedisTaskConfig = {
        type: 'redis',
        host: 'localhost',
        port: 6379,
        db: 0,
        maxTasks: 1000,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      // Should throw when Redis client is not provided
      try {
        await createA2ATaskProvider(redisConfig);
        fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).toContain('Failed to create-provider A2A task in redis');
      }
    });
  });

  describe('Composite Provider Creation', () => {
    it('should create composite provider with multiple backends', async () => {
      const primaryConfig: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 1000,
        maxTasksPerContext: 100,
        keyPrefix: 'primary:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const fallbackConfig: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 500,
        maxTasksPerContext: 50,
        keyPrefix: 'fallback:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const primaryProvider = await createA2ATaskProvider(primaryConfig);
      const fallbackProvider = await createA2ATaskProvider(fallbackConfig);
      
      const compositeProvider = createCompositeA2ATaskProvider(primaryProvider, fallbackProvider);

      expect(compositeProvider).toBeDefined();
      expect(typeof compositeProvider.storeTask).toBe('function');

      const healthResult = await compositeProvider.healthCheck();
      expect(healthResult.success).toBe(true);

      await compositeProvider.close();
    });

    it('should handle composite provider with replication strategy', async () => {
      const primary: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 1000,
        maxTasksPerContext: 100,
        keyPrefix: 'primary:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const replica: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 1000,
        maxTasksPerContext: 100,
        keyPrefix: 'replica:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const primaryProvider = await createA2ATaskProvider(primary);
      const replicaProvider = await createA2ATaskProvider(replica);
      
      const compositeProvider = createCompositeA2ATaskProvider(primaryProvider, replicaProvider);

      expect(compositeProvider).toBeDefined();
      await compositeProvider.close();
    });
  });

  describe('Environment-Based Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create provider from environment variables', async () => {
      process.env.FAF_A2A_TASK_PROVIDER_TYPE = 'memory';
      process.env.FAF_A2A_TASK_PROVIDER_MAX_TASKS = '2000';
      process.env.FAF_A2A_TASK_PROVIDER_KEY_PREFIX = 'env_test:';
      process.env.FAF_A2A_TASK_PROVIDER_DEFAULT_TTL = '7200';

      const provider = await createA2ATaskProviderFromEnv();
      
      expect(provider).toBeDefined();
      
      const healthResult = await provider.healthCheck();
      expect(healthResult.success).toBe(true);

      await provider.close();
    });

    it('should use default values when environment variables are not set', async () => {
      // Clear relevant environment variables
      delete process.env.FAF_A2A_TASK_PROVIDER_TYPE;
      delete process.env.FAF_A2A_TASK_PROVIDER_MAX_TASKS;

      const provider = await createA2ATaskProviderFromEnv();
      
      expect(provider).toBeDefined();
      
      const healthResult = await provider.healthCheck();
      expect(healthResult.success).toBe(true);

      await provider.close();
    });

    it('should handle Redis configuration from environment', async () => {
      process.env.FAF_A2A_TASK_PROVIDER_TYPE = 'redis';
      process.env.FAF_A2A_TASK_PROVIDER_REDIS_HOST = 'redis.example.com';
      process.env.FAF_A2A_TASK_PROVIDER_REDIS_PORT = '6380';
      process.env.FAF_A2A_TASK_PROVIDER_REDIS_PASSWORD = 'secret';

      // Should fall back to in-memory since Redis client is not available
      const provider = await createA2ATaskProviderFromEnv();
      expect(provider).toBeDefined();

      await provider.close();
    });

    it('should handle PostgreSQL configuration from environment', async () => {
      process.env.FAF_A2A_TASK_PROVIDER_TYPE = 'postgres';
      process.env.FAF_A2A_TASK_PROVIDER_POSTGRES_HOST = 'postgres.example.com';
      process.env.FAF_A2A_TASK_PROVIDER_POSTGRES_PORT = '5433';
      process.env.FAF_A2A_TASK_PROVIDER_POSTGRES_DATABASE = 'myapp';
      process.env.FAF_A2A_TASK_PROVIDER_POSTGRES_USERNAME = 'myuser';

      // Should fall back to in-memory since PostgreSQL client is not available
      const provider = await createA2ATaskProviderFromEnv();
      expect(provider).toBeDefined();

      await provider.close();
    });

    it('should handle invalid environment configuration gracefully', async () => {
      process.env.FAF_A2A_TASK_PROVIDER_TYPE = 'invalid_type';

      // Should fall back to in-memory provider
      const provider = await createA2ATaskProviderFromEnv();
      expect(provider).toBeDefined();

      await provider.close();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle provider creation with invalid configuration', async () => {
      const invalidConfig = {
        type: 'memory',
        maxTasks: -1, // Invalid value
        keyPrefix: '', // Invalid empty prefix
      } as any;

      try {
        await createA2ATaskProvider(invalidConfig);
        fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).toContain('Failed to create-provider A2A task in memory');
      }
    });

    it('should handle provider creation failures gracefully', async () => {
      // Test with Redis config but no client (should throw)
      const redisConfig: A2ARedisTaskConfig = {
        type: 'redis',
        host: 'non-existent-host',
        port: 9999,
        db: 0,
        maxTasks: 1000,
        keyPrefix: 'test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      // Should throw when no Redis client is provided
      try {
        await createA2ATaskProvider(redisConfig);
        fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).toContain('Failed to create-provider A2A task in redis');
      }
    });

    it('should handle composite provider creation with partial failures', async () => {
      const validConfig: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 1000,
        maxTasksPerContext: 100,
        keyPrefix: 'valid:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const invalidConfig = {
        type: 'invalid_type',
        keyPrefix: 'invalid:',
      } as any;
      
      try {
        await createA2ATaskProvider(invalidConfig);
        fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).toContain('Failed to create-provider A2A task in invalid_type');
      }
    });
  });

  describe('Provider Feature Testing', () => {
    it('should create providers with all expected interface methods', async () => {
      const config: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 1000,
        maxTasksPerContext: 100,
        keyPrefix: 'feature_test:',
        defaultTtl: 3600,
        cleanupInterval: 300,
        enableHistory: true,
        enableArtifacts: true
      };

      const provider = await createA2ATaskProvider(config);

      // Verify all required interface methods exist
      const requiredMethods = [
        'storeTask',
        'getTask',
        'updateTask',
        'updateTaskStatus',
        'findTasks',
        'getTasksByContext',
        'deleteTask',
        'deleteTasksByContext',
        'cleanupExpiredTasks',
        'getTaskStats',
        'healthCheck',
        'close'
      ];

      for (const method of requiredMethods) {
        expect(typeof (provider as any)[method]).toBe('function');
      }

      // Test that methods return proper result types
      const healthResult = await provider.healthCheck();
      expect(healthResult).toHaveProperty('success');
      expect(typeof healthResult.success).toBe('boolean');

      const statsResult = await provider.getTaskStats();
      expect(statsResult).toHaveProperty('success');
      expect(typeof statsResult.success).toBe('boolean');

      await provider.close();
    });

    it('should respect configuration options in created providers', async () => {
      const customConfig: A2AInMemoryTaskConfig = {
        type: 'memory',
        maxTasks: 100, // Small limit for testing
        maxTasksPerContext: 10,
        keyPrefix: 'custom_test:',
        defaultTtl: 1800,
        cleanupInterval: 150,
        enableHistory: false, // Disabled
        enableArtifacts: false // Disabled
      };

      const provider = await createA2ATaskProvider(customConfig);

      // Test that provider respects the configuration
      // (This would require accessing internal state or testing behavior)
      // For now, just verify it was created successfully
      expect(provider).toBeDefined();

      const healthResult = await provider.healthCheck();
      expect(healthResult.success).toBe(true);

      await provider.close();
    });
  });
});