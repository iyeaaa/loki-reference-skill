import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// For now, just use internationalization middleware
// Authentication will be handled client-side via NextAuth hooks
export default createMiddleware(routing);

export const config = {
	matcher: [
		// Match all routes except static files and API routes
		"/((?!api|_next/static|_next/image|favicon.ico|images).*)",
	],
};
