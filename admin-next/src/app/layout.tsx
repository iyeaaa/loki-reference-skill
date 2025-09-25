import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/lib/auth-provider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '하나 랭커넥트 관리자 시스템',
  description: '하나은행 다국어 번역 서비스 관리 시스템',
  metadataBase: new URL('https://admin.hana-lang-connect.site'),
  openGraph: {
    title: '하나 랭커넥트 관리자 시스템',
    description: '하나은행 다국어 번역 서비스 관리 시스템',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '하나 랭커넥트',
      }
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '하나 랭커넥트 관리자 시스템',
    description: '하나은행 다국어 번역 서비스 관리 시스템',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            containerClassName=""
            containerStyle={{}}
            toastOptions={{
              className: "",
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
              // Success toast styling
              success: {
                duration: 3000,
                style: {
                  background: "#10b981",
                  color: "#fff",
                },
                iconTheme: {
                  primary: "#fff",
                  secondary: "#10b981",
                },
              },
              // Error toast styling
              error: {
                duration: 4000,
                style: {
                  background: "#ef4444",
                  color: "#fff",
                },
                iconTheme: {
                  primary: "#fff",
                  secondary: "#ef4444",
                },
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
