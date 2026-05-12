import crypto from 'node:crypto';
import { AppError } from '../../shared/errors/app-error.js';
import type { SqlDatabase } from '../../shared/database/database.port.js';
import type { QueuePort } from '../../shared/queue/queue.port.js';
import type { AppMetrics } from '../../metrics/prometheus.js';
import type { PaymentRepository } from './payment.repository.js';

export type PaymentWebhookPayload = {
  paymentReference: string;
  transactionStatus: string;
  signature: string;
};

export class PaymentWebhookHandler {
  constructor(
    private readonly database: SqlDatabase,
    private readonly repository: PaymentRepository,
    private readonly queue: QueuePort,
    private readonly webhookSecret: string,
    private readonly metrics?: Pick<
      AppMetrics,
      'recordPaymentWebhookSuccess' | 'recordPaymentWebhookFailure' | 'recordPaymentWebhookIgnored'
    >
  ) {}

  async handle(payload: PaymentWebhookPayload) {
    try {
      this.verifySignature(payload);

      const payment = await this.repository.findByReference(payload.paymentReference);
      if (!payment) {
        throw new AppError('payment not found', 404, 'payment_not_found');
      }

      if (payment.status !== 'pending') {
        this.metrics?.recordPaymentWebhookIgnored('already_processed');
        return { status: 'ok' };
      }

      if (payload.transactionStatus !== 'success') {
        this.metrics?.recordPaymentWebhookIgnored(payload.transactionStatus);
        return { status: 'ok' };
      }

      await this.database.transaction(async () => {
        await this.repository.markPaymentSuccess(payload.paymentReference);
        await this.repository.markOrderPaid(payment.orderId);
      });
      await this.queue.add('payment.success', {
        orderId: payment.orderId,
        paymentReference: payload.paymentReference
      });

      this.metrics?.recordPaymentWebhookSuccess();
      return { status: 'ok' };
    } catch (error) {
      this.metrics?.recordPaymentWebhookFailure(error instanceof AppError ? error.code : 'unexpected_error');
      throw error;
    }
  }

  private verifySignature(payload: PaymentWebhookPayload) {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${payload.paymentReference}:${payload.transactionStatus}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(payload.signature);

    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new AppError('invalid signature', 401, 'invalid_signature');
    }
  }
}
