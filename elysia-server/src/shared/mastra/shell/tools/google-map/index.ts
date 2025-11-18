// import { createTool } from "@mastra/core";
// import pRetry from "p-retry";
// import { z } from "zod";
// import { config } from "../../../../../config"

// const googleMapSearch = async (params: {
// 	googleMapQuery: string;
// 	page?: number;
// }) => {
// 	const url = new URL("https://api.hasdata.com/scrape/google-maps/search");
// 	url.searchParams.append("q", params.googleMapQuery);

// 	if (params.page && params.page > 1) {
// 		url.searchParams.append("page", params.page.toString());
// 	}

// 	const response = await pRetry(
// 		async () => {
// 			const res = await fetch(url, {
// 				method: "GET",
// 				headers: {
// 					"Content-Type": "application/json",
// 					"x-api-key": config.apis.hasdata.apiKey,
// 				},
// 			});

// 			if (!res.ok) {
// 				throw new Error(`HTTP error! Status: ${res.status}.`);
// 			}

// 			const data = await res.json();
// 			return data;
// 		},
// 		{
// 			onFailedAttempt: (error) => {
// 				console.error(
// 					`Google Map Search Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
// 				);
// 			},
// 		},
// 	);

// 	return response;
// };

// export const googleMapSearchTool = createTool({
// 	id: "google-map-search",
// 	description: "Search for businesses using Google Maps",
// 	inputSchema: z.object({
// 		googleMapSearchQuery: z
// 			.string()
// 			.describe(
// 				"Search query for Google Maps, use business name or location or industry",
// 			),
// 		page: z.number().optional().describe("Page number for pagination"),
// 	}),
// 	outputSchema: z.object({
// 		results: z.array(
// 			z.object({
// 				name: z.string(),
// 				location: z.string(),
// 				distance: z.string(),
// 			}),
// 		),
// 	}),
// 	execute: async ({ context }) => {
// 		return await googleMapSearch({
// 			googleMapQuery: context.googleMapSearchQuery,
// 			page: context.page,
// 		});
// 	},
// });
