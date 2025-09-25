import React from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'


export default function RootLayout() {
  React.useEffect(() => {
    document.documentElement.lang = 'ko'
    document.title = '하나 랭커넥트 관리자 시스템'
  }, [])

  return (
    <div className="antialiased">
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
      <Outlet />
    </div>
  )
}
