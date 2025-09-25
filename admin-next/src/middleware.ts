import { withAuth } from "next-auth/middleware";

export default withAuth({
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page without authentication
        if (req.nextUrl.pathname === "/login") {
          return true;
        }

        // For all other pages, require authentication and allowed roles
        const allowedRoles = ["admin", "internal_reviewer", "external_reviewer"];
        return !!(token && token.user && allowedRoles.includes(token.user.user_role) && token.user.is_active);
      },
    },
});

export const config = {
  matcher: [
    // Match all pages except static files and API routes
    "/((?!api|_next/static|_next/image|favicon.ico|images|icons).*)",
  ],
};