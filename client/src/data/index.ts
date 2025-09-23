import type { Category, Product } from "@/lib/api/types";

// Dynamic import function to load locale-specific product data
export async function getProductData(locale: string = "ko"): Promise<{
	mockProducts: Product[];
	mockCategories: Category[];
}> {
	try {
		switch (locale) {
			case "en": {
				const enData = await import("./products.en");
				return {
					mockProducts: enData.mockProducts,
					mockCategories: enData.mockCategories,
				};
			}
			case "ja": {
				const jaData = await import("./products.ja");
				return {
					mockProducts: jaData.mockProducts,
					mockCategories: jaData.mockCategories,
				};
			}
			case "zh": {
				const zhData = await import("./products.zh");
				return {
					mockProducts: zhData.mockProducts,
					mockCategories: zhData.mockCategories,
				};
			}
			default: {
				const koData = await import("./products.ko");
				return {
					mockProducts: koData.mockProducts,
					mockCategories: koData.mockCategories,
				};
			}
		}
	} catch (error) {
		console.error(`Failed to load products data for locale ${locale}:`, error);
		// Fallback to Korean data
		const koData = await import("./products.ko");
		return {
			mockProducts: koData.mockProducts,
			mockCategories: koData.mockCategories,
		};
	}
}

// Legacy export for backward compatibility - defaults to Korean
export { mockCategories, mockProducts } from "./products.ko";
