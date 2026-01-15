declare module "@portone/browser-sdk/v2" {
  export type PaymentRequest = {
    storeId: string
    paymentId: string
    orderName: string
    totalAmount: number
    currency: string
    channelKey: string
    payMethod: string
    customer?: {
      fullName?: string
      email?: string
      phoneNumber?: string
    }
    redirectUrl?: string
    windowType?: {
      pc?: string
      mobile?: string
    }
    customData?: Record<string, unknown>
  }

  export type PaymentResponse = {
    code?: string
    message?: string
    paymentId?: string
    transactionType?: string
  }

  export type LoadPaymentUIOptions = {
    uiType: string
    storeId?: string
    channelKey?: string
    pg?: {
      name: string
    }
    paymentId: string
    orderName: string
    totalAmount: number
    currency: string
    payMethod?: string
    customer?: {
      fullName?: string
      email?: string
      phoneNumber?: string
    }
    amount?: {
      value: number
      currency: string
    }
    customData?: Record<string, unknown>
  }

  export type PaymentUICallbacks = {
    onPaymentSuccess?: () => void | Promise<void>
    onPaymentFail?: (error: unknown) => void
  }

  export function requestPayment(request: PaymentRequest): Promise<PaymentResponse>
  export function loadPaymentUI(options: LoadPaymentUIOptions, callbacks: PaymentUICallbacks): void
}
