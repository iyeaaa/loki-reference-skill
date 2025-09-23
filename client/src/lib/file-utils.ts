// File type utilities for client-side
export type MediaType =
	| "image"
	| "video"
	| "document"
	| "audio"
	| "archive"
	| "cad"
	| "spreadsheet"
	| "presentation"
	| "text"
	| "other";

// File extension to media type mapping
const FILE_TYPE_MAPPING: Record<string, MediaType> = {
	// Image formats
	".jpg": "image",
	".jpeg": "image",
	".png": "image",
	".gif": "image",
	".bmp": "image",
	".webp": "image",
	".svg": "image",
	".ico": "image",
	".tiff": "image",
	".tif": "image",

	// Video formats
	".mp4": "video",
	".avi": "video",
	".mov": "video",
	".wmv": "video",
	".flv": "video",
	".webm": "video",
	".mkv": "video",
	".m4v": "video",
	".3gp": "video",
	".ogv": "video",

	// Document formats
	".pdf": "document",
	".doc": "document",
	".docx": "document",
	".odt": "document",
	".rtf": "document",

	// Audio formats
	".mp3": "audio",
	".wav": "audio",
	".flac": "audio",
	".aac": "audio",
	".ogg": "audio",
	".wma": "audio",
	".m4a": "audio",

	// Archive formats
	".zip": "archive",
	".rar": "archive",
	".7z": "archive",
	".tar": "archive",
	".gz": "archive",
	".bz2": "archive",
	".xz": "archive",

	// CAD formats
	".dwg": "cad",
	".dxf": "cad",
	".step": "cad",
	".stp": "cad",
	".iges": "cad",
	".igs": "cad",
	".stl": "cad",

	// Spreadsheet formats
	".xls": "spreadsheet",
	".xlsx": "spreadsheet",
	".csv": "spreadsheet",
	".ods": "spreadsheet",

	// Presentation formats
	".ppt": "presentation",
	".pptx": "presentation",
	".odp": "presentation",

	// Text formats
	".txt": "text",
	".md": "text",
	".log": "text",
};

// Content type to media type mapping
const CONTENT_TYPE_MAPPING: Record<string, MediaType> = {
	// Image types
	"image/jpeg": "image",
	"image/jpg": "image",
	"image/png": "image",
	"image/gif": "image",
	"image/bmp": "image",
	"image/webp": "image",
	"image/svg+xml": "image",
	"image/tiff": "image",

	// Video types
	"video/mp4": "video",
	"video/avi": "video",
	"video/quicktime": "video",
	"video/x-msvideo": "video",
	"video/webm": "video",
	"video/x-flv": "video",

	// Document types
	"application/pdf": "document",
	"application/msword": "document",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"document",

	// Audio types
	"audio/mpeg": "audio",
	"audio/mp3": "audio",
	"audio/wav": "audio",
	"audio/x-wav": "audio",
	"audio/flac": "audio",
	"audio/aac": "audio",
	"audio/ogg": "audio",

	// Archive types
	"application/zip": "archive",
	"application/x-rar": "archive",
	"application/x-7z-compressed": "archive",
	"application/x-tar": "archive",
	"application/gzip": "archive",

	// Spreadsheet types
	"application/vnd.ms-excel": "spreadsheet",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		"spreadsheet",
	"text/csv": "spreadsheet",

	// Presentation types
	"application/vnd.ms-powerpoint": "presentation",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation":
		"presentation",

	// Text types
	"text/plain": "text",
	"text/markdown": "text",
	"application/rtf": "text",
};

/**
 * Get media type from filename extension
 */
export function getMediaTypeFromFilename(filename: string): MediaType {
	const ext = getFileExtension(filename).toLowerCase();
	return FILE_TYPE_MAPPING[ext] || "other";
}

/**
 * Get media type from MIME content type
 */
export function getMediaTypeFromContentType(contentType: string): MediaType {
	if (!contentType) return "other";

	// Remove charset and other parameters from content type
	const cleanContentType = contentType.split(";")[0].trim().toLowerCase();
	return CONTENT_TYPE_MAPPING[cleanContentType] || "other";
}

/**
 * Get media type from both filename and content type
 * Content type takes precedence over filename extension
 */
export function getMediaType(
	filename: string,
	contentType?: string,
): MediaType {
	// First try content type
	if (contentType) {
		const mediaType = getMediaTypeFromContentType(contentType);
		if (mediaType !== "other") {
			return mediaType;
		}
	}

	// Fallback to filename extension
	return getMediaTypeFromFilename(filename);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
	const lastDotIndex = filename.lastIndexOf(".");
	if (lastDotIndex === -1) return "";
	return filename.substring(lastDotIndex);
}

/**
 * Check if file type can be previewed as image
 */
export function isImageFile(filename: string, contentType?: string): boolean {
	return getMediaType(filename, contentType) === "image";
}

/**
 * Check if file type can be previewed as video
 */
export function isVideoFile(filename: string, contentType?: string): boolean {
	return getMediaType(filename, contentType) === "video";
}

/**
 * Check if file type can be previewed as audio
 */
export function isAudioFile(filename: string, contentType?: string): boolean {
	return getMediaType(filename, contentType) === "audio";
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / k ** i).toFixed(2)) + " " + sizes[i];
}

/**
 * Get appropriate icon class for file type
 */
export function getFileTypeIcon(
	filename: string,
	contentType?: string,
): string {
	const mediaType = getMediaType(filename, contentType);

	switch (mediaType) {
		case "image":
			return "lucide-image";
		case "video":
			return "lucide-video";
		case "audio":
			return "lucide-music";
		case "document":
			return "lucide-file-text";
		case "spreadsheet":
			return "lucide-table";
		case "presentation":
			return "lucide-presentation";
		case "archive":
			return "lucide-archive";
		case "cad":
			return "lucide-box";
		case "text":
			return "lucide-file-text";
		default:
			return "lucide-file";
	}
}

/**
 * Get file type display name
 */
export function getFileTypeDisplayName(
	filename: string,
	contentType?: string,
): string {
	const mediaType = getMediaType(filename, contentType);

	switch (mediaType) {
		case "image":
			return "이미지";
		case "video":
			return "비디오";
		case "audio":
			return "오디오";
		case "document":
			return "문서";
		case "spreadsheet":
			return "스프레드시트";
		case "presentation":
			return "프레젠테이션";
		case "archive":
			return "압축파일";
		case "cad":
			return "CAD 파일";
		case "text":
			return "텍스트";
		default:
			return "파일";
	}
}
