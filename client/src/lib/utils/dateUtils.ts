/**
 * Date utility functions for handling date/time data
 * optimized for backend communication
 */

export const dateUtils = {
	/**
	 * Converts a Date object to ISO 8601 string
	 * @param date - Date object or date string
	 * @returns ISO 8601 formatted string
	 */
	toISOString: (date: Date | string): string => {
		return new Date(date).toISOString();
	},

	/**
	 * Converts local date/time to UTC ISO string
	 * @param localDate - Local date string or Date object
	 * @returns UTC ISO string
	 */
	toUTC: (localDate: Date | string): string => {
		const date = new Date(localDate);
		return new Date(
			date.getTime() - date.getTimezoneOffset() * 60000,
		).toISOString();
	},

	/**
	 * Gets current timezone offset in hours
	 * @returns Timezone offset (e.g., "+09:00" for KST)
	 */
	getCurrentTimezoneOffset: (): string => {
		const offset = new Date().getTimezoneOffset();
		const hours = Math.floor(Math.abs(offset) / 60);
		const minutes = Math.abs(offset) % 60;
		const sign = offset <= 0 ? "+" : "-";
		return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
	},

	/**
	 * Gets current timezone name
	 * @returns Timezone name (e.g., "Asia/Seoul")
	 */
	getCurrentTimezoneName: (): string => {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	},

	/**
	 * Converts UTC time to local time
	 * @param utcDate - UTC date string or Date object
	 * @returns Local Date object
	 */
	utcToLocal: (utcDate: Date | string): Date => {
		const date = new Date(utcDate);
		return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
	},

	/**
	 * Formats ISO string for user display
	 * @param isoString - ISO 8601 string
	 * @param locale - Locale for formatting (default: 'ko-KR')
	 * @returns Formatted date string
	 */
	formatForDisplay: (isoString: string, locale: string = "ko-KR"): string => {
		return new Date(isoString).toLocaleString(locale, {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			timeZone: "Asia/Seoul",
		});
	},

	/**
	 * Combines date and time into UTC ISO string
	 * @param date - Date object
	 * @param time - Time string in HH:MM format
	 * @param treatAsUTC - Whether to treat the input time as UTC (true) or local time (false)
	 * @returns ISO 8601 UTC string
	 */
	combineDateTime: (
		date: Date,
		time: string,
		treatAsUTC: boolean = false,
	): string => {
		const [hours, minutes] = time.split(":");
		const dateStr = date.toISOString().split("T")[0];

		if (treatAsUTC) {
			// Input time is already UTC, create UTC ISO string directly
			return `${dateStr}T${time}:00.000Z`;
		} else {
			// Input time is local time, convert to UTC
			const dateTime = new Date(date);
			dateTime.setHours(Number(hours), Number(minutes), 0, 0);
			return dateTime.toISOString();
		}
	},

	/**
	 * Validates if a date is in the future
	 * @param date - Date to validate
	 * @returns True if date is in the future
	 */
	isFutureDate: (date: Date | string): boolean => {
		return new Date(date) > new Date();
	},

	/**
	 * Parses various date formats
	 * @param dateString - Date string in various formats
	 * @returns Date object or null if invalid
	 */
	parseFlexible: (dateString: string): Date | null => {
		try {
			// Try direct parsing first
			const direct = new Date(dateString);
			if (!Number.isNaN(direct.getTime())) {
				return direct;
			}

			// Try different formats
			const formats = [
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.?\d*Z?$/, // ISO 8601
				/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // SQL timestamp
				/^\d{4}-\d{2}-\d{2}$/, // Date only
			];

			for (const format of formats) {
				if (format.test(dateString)) {
					const parsed = new Date(dateString);
					if (!Number.isNaN(parsed.getTime())) {
						return parsed;
					}
				}
			}

			return null;
		} catch {
			return null;
		}
	},
};

export type DateTimeSlot = {
	id: string;
	date: Date | undefined;
	time: string;
};

export type TimezoneMode = "local" | "utc" | "custom";

export interface TimezoneInfo {
	value: string;
	label: string;
	offset: string;
	country: string;
	city: string;
}

// 주요 국가별 시간대 정의
export const TIMEZONE_OPTIONS: TimezoneInfo[] = [
	// 아시아
	{
		value: "Asia/Seoul",
		label: "한국 (서울)",
		offset: "+09:00",
		country: "KR",
		city: "Seoul",
	},
	{
		value: "Asia/Tokyo",
		label: "일본 (도쿄)",
		offset: "+09:00",
		country: "JP",
		city: "Tokyo",
	},
	{
		value: "Asia/Shanghai",
		label: "중국 (상하이)",
		offset: "+08:00",
		country: "CN",
		city: "Shanghai",
	},
	{
		value: "Asia/Hong_Kong",
		label: "홍콩",
		offset: "+08:00",
		country: "HK",
		city: "Hong Kong",
	},
	{
		value: "Asia/Singapore",
		label: "싱가포르",
		offset: "+08:00",
		country: "SG",
		city: "Singapore",
	},
	{
		value: "Asia/Bangkok",
		label: "태국 (방콕)",
		offset: "+07:00",
		country: "TH",
		city: "Bangkok",
	},
	{
		value: "Asia/Kolkata",
		label: "인도 (뉴델리)",
		offset: "+05:30",
		country: "IN",
		city: "Delhi",
	},
	{
		value: "Asia/Dubai",
		label: "아랍에미리트 (두바이)",
		offset: "+04:00",
		country: "AE",
		city: "Dubai",
	},

	// 유럽
	{
		value: "Europe/London",
		label: "영국 (런던)",
		offset: "+00:00",
		country: "GB",
		city: "London",
	},
	{
		value: "Europe/Paris",
		label: "프랑스 (파리)",
		offset: "+01:00",
		country: "FR",
		city: "Paris",
	},
	{
		value: "Europe/Berlin",
		label: "독일 (베를린)",
		offset: "+01:00",
		country: "DE",
		city: "Berlin",
	},
	{
		value: "Europe/Rome",
		label: "이탈리아 (로마)",
		offset: "+01:00",
		country: "IT",
		city: "Rome",
	},
	{
		value: "Europe/Madrid",
		label: "스페인 (마드리드)",
		offset: "+01:00",
		country: "ES",
		city: "Madrid",
	},
	{
		value: "Europe/Moscow",
		label: "러시아 (모스크바)",
		offset: "+03:00",
		country: "RU",
		city: "Moscow",
	},

	// 아메리카
	{
		value: "America/New_York",
		label: "미국 동부 (뉴욕)",
		offset: "-05:00",
		country: "US",
		city: "New York",
	},
	{
		value: "America/Chicago",
		label: "미국 중부 (시카고)",
		offset: "-06:00",
		country: "US",
		city: "Chicago",
	},
	{
		value: "America/Denver",
		label: "미국 산지 (덴버)",
		offset: "-07:00",
		country: "US",
		city: "Denver",
	},
	{
		value: "America/Los_Angeles",
		label: "미국 서부 (LA)",
		offset: "-08:00",
		country: "US",
		city: "Los Angeles",
	},
	{
		value: "America/Toronto",
		label: "캐나다 (토론토)",
		offset: "-05:00",
		country: "CA",
		city: "Toronto",
	},
	{
		value: "America/Sao_Paulo",
		label: "브라질 (상파울루)",
		offset: "-03:00",
		country: "BR",
		city: "São Paulo",
	},

	// 오세아니아
	{
		value: "Australia/Sydney",
		label: "호주 (시드니)",
		offset: "+10:00",
		country: "AU",
		city: "Sydney",
	},
	{
		value: "Pacific/Auckland",
		label: "뉴질랜드 (오클랜드)",
		offset: "+12:00",
		country: "NZ",
		city: "Auckland",
	},

	// UTC
	{
		value: "UTC",
		label: "UTC (협정 세계시)",
		offset: "+00:00",
		country: "UTC",
		city: "UTC",
	},
];

/**
 * Converts DateTimeSlot array to UTC ISO string array for API
 * Always returns UTC timestamps for consistent backend storage
 * @param slots - Array of DateTimeSlot objects
 * @param timezoneMode - Timezone mode ('local' | 'utc' | 'custom')
 * @param customTimezone - Custom timezone (when mode is 'custom')
 * @returns Array of ISO 8601 UTC strings
 */
export const convertSlotsToISOStrings = (
	slots: DateTimeSlot[],
	timezoneMode: TimezoneMode = "local",
	customTimezone?: string,
): string[] => {
	return slots
		.filter((slot) => slot.date && slot.time)
		.map((slot) => {
			if (!slot.date) return "";

			// All conversions result in UTC timestamps for backend consistency
			switch (timezoneMode) {
				case "utc":
					// User selected UTC time - treat input as UTC
					return dateUtils.combineDateTime(slot.date, slot.time, true);

				case "custom":
					// User selected a specific timezone - convert to UTC
					if (customTimezone) {
						return convertWithCustomTimezone(
							slot.date,
							slot.time,
							customTimezone,
						);
					}
					// Fallback to local if no custom timezone
					return dateUtils.combineDateTime(slot.date, slot.time, false);

				default:
					// User selected local time - convert local to UTC
					return dateUtils.combineDateTime(slot.date, slot.time, false);
			}
		})
		.filter(Boolean);
};

/**
 * Converts date/time with custom timezone to UTC
 * @param date - Date object
 * @param time - Time string in HH:MM format
 * @param timezone - Timezone string (e.g., 'Asia/Seoul')
 * @returns ISO 8601 UTC string
 */
const convertWithCustomTimezone = (
	date: Date,
	time: string,
	timezone: string,
): string => {
	// Parse time components (not used in current implementation)
	time.split(":");

	// Create date string in YYYY-MM-DD format
	const dateStr = date.toISOString().split("T")[0];

	if (timezone === "UTC") {
		// If UTC is selected, create UTC datetime directly
		return `${dateStr}T${time}:00.000Z`;
	}

	// For other timezones, create a Date object assuming the time is in that timezone
	// Then convert to UTC
	const timezoneOffset = getTimezoneOffset(timezone);

	// Create a temporary date object
	const tempDateTime = new Date(`${dateStr}T${time}:00`);

	// Subtract the timezone offset to get UTC time
	const utcTime = tempDateTime.getTime() - timezoneOffset * 3600000;

	return new Date(utcTime).toISOString();
};

/**
 * Gets timezone offset in hours
 * @param timezone - Timezone string
 * @returns Offset in hours
 */
const getTimezoneOffset = (timezone: string): number => {
	const timezoneMap: Record<string, number> = {
		"Asia/Seoul": 9,
		"Asia/Tokyo": 9,
		"Asia/Shanghai": 8,
		"Asia/Hong_Kong": 8,
		"Asia/Singapore": 8,
		"Asia/Bangkok": 7,
		"Asia/Kolkata": 5.5,
		"Asia/Dubai": 4,
		"Europe/London": 0,
		"Europe/Paris": 1,
		"Europe/Berlin": 1,
		"Europe/Rome": 1,
		"Europe/Madrid": 1,
		"Europe/Moscow": 3,
		"America/New_York": -5,
		"America/Chicago": -6,
		"America/Denver": -7,
		"America/Los_Angeles": -8,
		"America/Toronto": -5,
		"America/Sao_Paulo": -3,
		"Australia/Sydney": 10,
		"Pacific/Auckland": 12,
		UTC: 0,
	};

	return timezoneMap[timezone] || 0;
};

/**
 * Gets timezone display info
 * @param mode - Timezone mode ('local' | 'utc' | 'custom')
 * @param customTimezone - Custom timezone (when mode is 'custom')
 * @returns Display information for the timezone
 */
export const getTimezoneDisplayInfo = (
	mode: TimezoneMode,
	customTimezone?: string,
) => {
	if (mode === "utc") {
		return {
			label: "UTC",
			offset: "+00:00",
			description: "Coordinated Universal Time",
		};
	}

	if (mode === "custom" && customTimezone) {
		const timezoneInfo = TIMEZONE_OPTIONS.find(
			(tz) => tz.value === customTimezone,
		);
		if (timezoneInfo) {
			return {
				label: timezoneInfo.city,
				offset: timezoneInfo.offset,
				description: timezoneInfo.label,
			};
		}
	}

	const timezoneName = dateUtils.getCurrentTimezoneName();
	const offset = dateUtils.getCurrentTimezoneOffset();

	return {
		label: timezoneName.split("/").pop() || "Local",
		offset,
		description: `${timezoneName} (${offset})`,
	};
};

/**
 * Gets current time in specified timezone
 * @param timezone - Timezone string
 * @returns Current time string in HH:MM format
 */
export const getCurrentTimeInTimezone = (timezone: string): string => {
	const now = new Date();
	const options: Intl.DateTimeFormatOptions = {
		timeZone: timezone,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	};

	try {
		return new Intl.DateTimeFormat("en-US", options).format(now);
	} catch {
		return now.toTimeString().slice(0, 5);
	}
};

/**
 * Formats time display with timezone information
 * @param time - Time string in HH:MM format
 * @param mode - Timezone mode
 * @param customTimezone - Custom timezone (when mode is 'custom')
 * @returns Formatted time with timezone info
 */
export const formatTimeWithTimezone = (
	time: string,
	mode: TimezoneMode,
	customTimezone?: string,
): string => {
	const info = getTimezoneDisplayInfo(mode, customTimezone);
	return `${time} (${info.label} ${info.offset})`;
};

/**
 * Validates DateTimeSlot array
 * @param slots - Array of DateTimeSlot objects
 * @returns Validation result with error messages
 */
export const validateDateTimeSlots = (
	slots: DateTimeSlot[],
): {
	isValid: boolean;
	errors: string[];
} => {
	const errors: string[] = [];
	const validSlots = slots.filter((slot) => slot.date && slot.time);

	if (validSlots.length === 0) {
		errors.push("At least one meeting date is required");
	}

	for (const slot of validSlots) {
		if (slot.date && !dateUtils.isFutureDate(slot.date)) {
			errors.push("Meeting dates must be in the future");
			break;
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};
