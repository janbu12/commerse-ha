import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from './product.service.js';
import type { ProductRepository } from './product.repository.js';
import type { RedisPort } from '../../shared/redis/redis.port.js';

describe('ProductService', () => {
  let productService: ProductService;
  let mockRepo: ProductRepository;
  let mockRedis: RedisPort;

  beforeEach(() => {
    mockRepo = {
      findMany: vi.fn(),
      findById: vi.fn(),
    } as unknown as ProductRepository;

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    } as unknown as RedisPort;

    productService = new ProductService(mockRepo, mockRedis);
  });

  describe('getProducts', () => {
    it('should return products from cache if available', async () => {
      const mockProducts = [{ id: '1', name: 'Test Product', price: 100 }];
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockProducts));

      const result = await productService.getProducts({});

      expect(result).toEqual(mockProducts);
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRepo.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from repo and save to cache if not in cache', async () => {
      const mockProducts = [{ id: '1', name: 'Test Product', price: 100 }];
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockRepo.findMany).mockResolvedValue(mockProducts as any);

      const result = await productService.getProducts({});

      expect(result).toEqual(mockProducts);
      expect(mockRepo.findMany).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('products:list'),
        JSON.stringify(mockProducts),
        300
      );
    });
  });

  describe('getProductById', () => {
    it('should return product from cache if available', async () => {
      const mockProduct = { id: '1', name: 'Test Product', price: 100 };
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockProduct));

      const result = await productService.getProductById('1');

      expect(result).toEqual(mockProduct);
      expect(mockRedis.get).toHaveBeenCalledWith('products:detail:1');
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('should fetch from repo and save to cache if not in cache', async () => {
      const mockProduct = { id: '1', name: 'Test Product', price: 100 };
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockRepo.findById).mockResolvedValue(mockProduct as any);

      const result = await productService.getProductById('1');

      expect(result).toEqual(mockProduct);
      expect(mockRepo.findById).toHaveBeenCalledWith('1');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'products:detail:1',
        JSON.stringify(mockProduct),
        600
      );
    });
  });
});
