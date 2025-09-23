import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
	output: "standalone",
	// basePath: '/app',
	compress: true,
	images: {
		unoptimized: true,
		domains: ["tjtenj-s3.s3.ap-northeast-2.amazonaws.com"],
		formats: ["image/webp", "image/avif"],
		minimumCacheTTL: 60 * 60 * 24 * 30, // 30일 캐싱
		dangerouslyAllowSVG: true,
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},
	typescript: {
		ignoreBuildErrors: false,
	},
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
