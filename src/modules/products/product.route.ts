import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ProductService } from './product.service.js';

export function registerProductRoute(app: FastifyInstance, productService: ProductService) {
  app.get('/products', async (request: FastifyRequest<{
    Querystring: { categoryId?: string; limit?: string; offset?: string }
  }>) => {
    const { categoryId, limit, offset } = request.query;
    
    return productService.getProducts({
      categoryId,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    });
  });

  app.get('/products/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const { id } = request.params;
    const product = await productService.getProductById(id);

    if (!product) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Product not found'
      });
    }

    return product;
  });
}
