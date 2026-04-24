/**
 * ZBS WiPay Payment Gateway Integration
 *
 * WiPay is the #1 payment gateway in Trinidad & Tobago and the
 * English-speaking Caribbean. This module provides a SDK class for
 * creating payment orders, verifying payments, generating hosted
 * payment links, and issuing refunds via the WiPay API.
 *
 * Environment variables:
 *   WIPAY_API_KEY     — Your WiPay merchant API key
 *   WIPAY_MERCHANT_ID — Your WiPay merchant ID
 *   WIPAY_ENV         — "production" or "sandbox" (default: sandbox)
 */

// ─── Types ───

export interface WiPayOrderRequest {
  /** Total amount for the order */
  total: number;
  /** 3-letter currency code (e.g. "TTD", "USD", "JMD", "BBD") */
  currency?: string;
  /** Order description shown to customer */
  description?: string;
  /** Unique order ID from your system (e.g. RentPayment ID) */
  orderId?: string;
  /** Customer name */
  customerName?: string;
  /** Customer email — receipt will be sent to this address */
  customerEmail?: string;
  /** Customer phone */
  customerPhone?: string;
  /** URL to redirect to after successful payment */
  returnUrl?: string;
  /** URL to redirect to if payment is cancelled */
  cancelUrl?: string;
  /** URL to receive webhook notifications */
  webhookUrl?: string;
  /** Number of seconds before the payment link expires */
  expiry?: number;
}

export interface WiPayOrderResponse {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  paymentUrl?: string;
  status?: string;
  error?: string;
  raw?: any;
}

export interface WiPayVerifyResponse {
  success: boolean;
  status?: string;
  transactionId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  fee?: number;
  paymentMethod?: string;
  cardType?: string;
  customerName?: string;
  customerEmail?: string;
  paidAt?: string;
  error?: string;
  raw?: any;
}

export interface WiPayRefundRequest {
  transactionId: string;
  amount: number;
  reason?: string;
}

export interface WiPayRefundResponse {
  success: boolean;
  refundId?: string;
  status?: string;
  error?: string;
  raw?: any;
}

export interface WiPayWebhookPayload {
  transactionId: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  fee: number;
  paymentMethod: string;
  cardType?: string;
  customerName: string;
  customerEmail: string;
  paidAt: string;
  signature: string;
  [key: string]: any;
}

// ─── WiPay SDK ───

export class WiPaySDK {
  private readonly apiKey: string;
  private readonly merchantId: string;
  private readonly baseUrl: string;
  private readonly env: string;

  constructor() {
    this.apiKey = process.env.WIPAY_API_KEY || '';
    this.merchantId = process.env.WIPAY_MERCHANT_ID || '';
    this.env = process.env.WIPAY_ENV || 'sandbox';

    if (!this.apiKey) {
      console.warn('[WiPay] WIPAY_API_KEY not configured — WiPay integration is disabled.');
    }
    if (!this.merchantId) {
      console.warn('[WiPay] WIPAY_MERCHANT_ID not configured — WiPay integration is disabled.');
    }

    if (this.env === 'production') {
      this.baseUrl = 'https://prod.wipayfinancial.com/plugins/payments/';
    } else {
      this.baseUrl = 'https://qa.wipayfinancial.com/plugins/payments/';
    }
  }

  /** Check if WiPay is properly configured */
  isConfigured(): boolean {
    return !!(this.apiKey && this.merchantId);
  }

  /**
   * Generate a signature for webhook verification.
   * Uses HMAC-SHA256 of the transaction ID with the API key.
   */
  generateSignature(transactionId: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(transactionId)
      .digest('hex');
  }

  /**
   * Verify a webhook signature.
   */
  verifySignature(transactionId: string, signature: string): boolean {
    const expected = this.generateSignature(transactionId);
    // Timing-safe comparison to prevent timing attacks
    const crypto = require('crypto');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  }

  /**
   * Create a payment order via WiPay API.
   *
   * Returns a payment URL the customer can use to complete payment.
   */
  async createOrder(data: WiPayOrderRequest): Promise<WiPayOrderResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WiPay is not configured' };
    }

    try {
      const payload: Record<string, any> = {
        total: data.total,
        currency: data.currency || 'TTD',
        description: data.description || 'Rent Payment',
        merchant_id: this.merchantId,
        api_key: this.apiKey,
        order_id: data.orderId || '',
        name: data.customerName || '',
        email: data.customerEmail || '',
        phone: data.customerPhone || '',
        return_url: data.returnUrl || '',
        cancel_url: data.cancelUrl || '',
        webhook_url: data.webhookUrl || '',
      };

      if (data.expiry) {
        payload.expiry = data.expiry;
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      // WiPay returns a redirect URL on success
      if (result.url || result.redirect_url || result.payment_url) {
        return {
          success: true,
          paymentUrl: result.url || result.redirect_url || result.payment_url,
          transactionId: result.transaction_id || result.transactionId,
          orderId: result.order_id || data.orderId,
          status: 'pending',
          raw: result,
        };
      }

      // Check for error responses
      if (result.error || result.status === 'error' || result.status === 'failed') {
        return {
          success: false,
          error: result.error || result.message || 'Failed to create WiPay order',
          raw: result,
        };
      }

      // Some WiPay implementations return the URL directly
      if (typeof result === 'string' && result.startsWith('http')) {
        return {
          success: true,
          paymentUrl: result,
          status: 'pending',
        };
      }

      return {
        success: false,
        error: 'Unexpected response from WiPay',
        raw: result,
      };
    } catch (error: any) {
      console.error('[WiPay] createOrder error:', error);
      return {
        success: false,
        error: error.message || 'Network error communicating with WiPay',
      };
    }
  }

  /**
   * Verify a payment using the order ID and transaction ID.
   * Calls the WiPay verification endpoint to confirm payment status.
   */
  async verifyPayment(orderId: string, transactionId: string): Promise<WiPayVerifyResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WiPay is not configured' };
    }

    try {
      const verifyUrl = `${this.baseUrl}verify`;

      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          transaction_id: transactionId,
          merchant_id: this.merchantId,
          api_key: this.apiKey,
        }),
      });

      const result = await response.json();

      if (result.status === 'success' || result.status === 'completed' || result.approved === true) {
        return {
          success: true,
          status: result.status || 'completed',
          transactionId: result.transaction_id || transactionId,
          orderId: result.order_id || orderId,
          amount: parseFloat(result.total || result.amount || '0'),
          currency: result.currency || 'TTD',
          fee: parseFloat(result.fee || '0'),
          paymentMethod: result.method || result.payment_method || 'card',
          cardType: result.card_type || result.cardType,
          customerName: result.name || result.customer_name,
          customerEmail: result.email || result.customer_email,
          paidAt: result.date || result.paid_at || result.created_at,
          raw: result,
        };
      }

      return {
        success: false,
        status: result.status || 'unknown',
        error: result.error || result.message || 'Payment verification failed',
        raw: result,
      };
    } catch (error: any) {
      console.error('[WiPay] verifyPayment error:', error);
      return {
        success: false,
        error: error.message || 'Network error communicating with WiPay',
      };
    }
  }

  /**
   * Generate a hosted payment page URL.
   * This creates a URL the customer can visit to make payment.
   */
  generatePaymentLink(data: WiPayOrderRequest): string {
    if (!this.isConfigured()) {
      return '';
    }

    const params = new URLSearchParams({
      merchant_id: this.merchantId,
      total: String(data.total),
      currency: data.currency || 'TTD',
      description: data.description || 'Rent Payment',
      order_id: data.orderId || '',
      name: data.customerName || '',
      email: data.customerEmail || '',
      phone: data.customerPhone || '',
    });

    if (data.returnUrl) params.set('return_url', data.returnUrl);
    if (data.cancelUrl) params.set('cancel_url', data.cancelUrl);
    if (data.webhookUrl) params.set('webhook_url', data.webhookUrl);

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Issue a refund for a completed payment.
   */
  async refundPayment(transactionId: string, amount: number, reason?: string): Promise<WiPayRefundResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WiPay is not configured' };
    }

    try {
      const refundUrl = `${this.baseUrl}refund`;

      const response = await fetch(refundUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          amount: amount,
          reason: reason || '',
          merchant_id: this.merchantId,
          api_key: this.apiKey,
        }),
      });

      const result = await response.json();

      if (result.status === 'success' || result.status === 'refunded' || result.refunded === true) {
        return {
          success: true,
          refundId: result.refund_id || result.id,
          status: result.status || 'refunded',
          raw: result,
        };
      }

      return {
        success: false,
        status: result.status,
        error: result.error || result.message || 'Refund failed',
        raw: result,
      };
    } catch (error: any) {
      console.error('[WiPay] refundPayment error:', error);
      return {
        success: false,
        error: error.message || 'Network error communicating with WiPay',
      };
    }
  }
}

// ─── Singleton instance ───
let _wipayInstance: WiPaySDK | null = null;

export function getWiPay(): WiPaySDK {
  if (!_wipayInstance) {
    _wipayInstance = new WiPaySDK();
  }
  return _wipayInstance;
}
