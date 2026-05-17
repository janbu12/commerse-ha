import { AppError } from '../../shared/errors/app-error.js';
import type { OrderRepository } from './order.repository.js';

export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async listOrders(userId: string) {
    return {
      userId,
      orders: await this.orderRepository.findManyByUserId(userId)
    };
  }

  async getOrder(id: string) {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new AppError('order not found', 404, 'order_not_found');
    }

    return order;
  }
}
