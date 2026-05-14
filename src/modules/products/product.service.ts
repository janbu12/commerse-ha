import type { ProductRepository } from './product.repository.js';
import type { RedisPort } from '../../shared/redis/redis.port.js';

export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly redis: RedisPort
  ) {}

  async getProducts(params: { categoryId?: string; limit?: number; offset?: number }) {
    const cacheKey = `products:list:${params.categoryId || 'all'}:${params.limit || 20}:${params.offset || 0}`;
    
    // Try to get from cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Get from database
    const products = await this.productRepository.findMany(params);

    // Save to cache (TTL 5 minutes = 300 seconds)
    await this.redis.set(cacheKey, JSON.stringify(products), 300);

    return products;
  }

  async getProductById(id: string) {
    const cacheKey = `products:detail:${id}`;

    // Try to get from cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Get from database
    const product = await this.productRepository.findById(id);

    if (product) {
      // Save to cache (TTL 10 minutes = 600 seconds)
      await this.redis.set(cacheKey, JSON.stringify(product), 600);
    }

    return product;
  }
}
