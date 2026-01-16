/**
 * Type declarations for @tosspayments/tosspayments-sdk
 *
 * @see https://docs.tosspayments.com/sdk/v2/js
 */

declare module "@tosspayments/tosspayments-sdk" {
  export type TossPaymentsInstance = {
    payment: (options: { customerKey: string }) => PaymentWidget
    brandpay: (options: { customerKey: string; redirectUrl: string }) => BrandPayWidget
    widgets: (options: { customerKey: string }) => TossPaymentsWidgets
  }

  export type TossPaymentsWidgets = {
    setAmount: (options: { currency: string; value: number }) => Promise<void>
    renderPaymentMethods: (options: { selector: string; variantKey?: string }) => Promise<void>
    renderAgreement: (options: { selector: string; variantKey?: string }) => Promise<void>
    requestPayment: (options: WidgetPaymentRequestOptions) => Promise<void>
    requestBillingAuth: (options: BillingAuthRequestOptions) => Promise<void>
  }

  export type PaymentWidget = {
    requestPayment: (options: PaymentRequestOptions) => Promise<void>
    requestBillingAuth: (options: BillingAuthRequestOptions) => Promise<void>
  }

  export type BrandPayWidget = {
    addPaymentMethod: (method: string, options: object) => Promise<void>
    changeOneTouchPay: (options: object) => Promise<void>
  }

  export type WidgetPaymentRequestOptions = {
    orderId: string
    orderName: string
    successUrl: string
    failUrl: string
    customerEmail?: string
    customerName?: string
    customerMobilePhone?: string
  }

  export type PaymentRequestOptions = {
    method: string
    amount: {
      currency: string
      value: number
    }
    orderId: string
    orderName: string
    successUrl: string
    failUrl: string
    customerEmail?: string
    customerName?: string
    customerMobilePhone?: string
    card?: {
      useEscrow?: boolean
      flowMode?: string
      useCardPoint?: boolean
      useAppCardOnly?: boolean
    }
  }

  export type BillingAuthRequestOptions = {
    method: string
    successUrl: string
    failUrl: string
    customerEmail?: string
    customerName?: string
    customerMobilePhone?: string
  }

  export function loadTossPayments(clientKey: string): Promise<TossPaymentsInstance>
}
