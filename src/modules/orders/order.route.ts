import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { OrderService } from './order.service.js';

export function registerOrderRoute(app: FastifyInstance, orderService: OrderService) {
  app.get(
    '/orders',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: { userId: string } }>) => {
      return orderService.listOrders(request.query.userId);
    }
  );

  app.get(
    '/orders/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return orderService.getOrder(request.params.id);
    }
  );
}
