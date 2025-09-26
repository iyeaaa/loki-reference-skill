export const config = {
  port: process.env.PORT || 3001,
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: 'rinda@partners.grinda.ai',
    fromName: 'Rinda Expert - 그린다에이아이'
  }
}