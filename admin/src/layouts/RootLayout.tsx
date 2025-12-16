import React, { Suspense } from "react"
import { Toaster } from "react-hot-toast"
import { Outlet } from "react-router-dom"

// Loading fallback component
function PageLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}

export default function RootLayout() {
  React.useEffect(() => {
    document.documentElement.lang = "ko"
    document.title = "Rinda AI Email Marketing"
  }, [])

  return (
    <div className="antialiased">
      <Toaster
        containerClassName=""
        containerStyle={{}}
        gutter={8}
        position="top-right"
        reverseOrder={false}
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
      <Suspense fallback={<PageLoadingFallback />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
