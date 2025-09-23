// client/src/app/lib/channeltalk.ts
"use client";

// Define the ChannelIO type
declare global {
	interface Window {
		ChannelIO?: {
			(
				command: "boot",
				settings: {
					pluginKey: string;
				},
			): void;
			(command: "shutdown"): void;
			(command: "showMessenger"): void;
			(command: "hideMessenger"): void;
			(command: "openChat", chatId?: string, message?: string): void;
		};
		ChannelIOInitialized?: boolean;
	}
}

// Function to open ChannelTalk chat window
export const openChannelTalk = (): void => {
	if (typeof window !== "undefined" && window.ChannelIO) {
		window.ChannelIO("showMessenger");
	}
};
