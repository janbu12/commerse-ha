import { AppError } from '../../shared/errors/app-error.js';
import type { CartRepository } from './cart.repository.js';

export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async getCart(userId: string) {
    const cart = await this.cartRepository.findByUserId(userId);
    return cart ?? { id: null, userId, totalAmount: 0, items: [] };
  }

  async addItem(input: { userId: string; productVariantId: string; quantity: number }) {
    await this.ensureVariantExists(input.productVariantId);
    const item = await this.cartRepository.addItem(input);
    if (!item) {
      throw new AppError('insufficient stock', 409, 'insufficient_stock');
    }

    return item;
  }

  async updateItemQuantity(itemId: string, quantity: number) {
    const item = await this.cartRepository.updateItemQuantity(itemId, quantity);
    if (item) {
      return item;
    }

    const current = await this.cartRepository.findItemById(itemId);
    if (!current) {
      throw new AppError('cart item not found', 404, 'cart_item_not_found');
    }

    throw new AppError('insufficient stock', 409, 'insufficient_stock');
  }

  async deleteItem(itemId: string) {
    const deleted = await this.cartRepository.deleteItem(itemId);
    if (!deleted) {
      throw new AppError('cart item not found', 404, 'cart_item_not_found');
    }
  }

  private async ensureVariantExists(productVariantId: string) {
    const variant = await this.cartRepository.findVariantById(productVariantId);
    if (!variant) {
      throw new AppError('product variant not found', 404, 'product_variant_not_found');
    }

    return variant;
  }
}
