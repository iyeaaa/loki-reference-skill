import React from "react"
import { Toaster } from "react-hot-toast"
import { Outlet } from "react-router-dom"

export default function RootLayout() {
  React.useEffect(() => {
    document.documentElement.lang = "ko"
    document.title = "sendgrinda"
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
