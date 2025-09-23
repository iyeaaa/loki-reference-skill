import {
	Archive,
	Box,
	File,
	FileText,
	Image as ImageIcon,
	Music,
	Presentation,
	Table,
	Video,
} from "lucide-react";
import Image from "next/image";
import type React from "react";
import {
	formatFileSize,
	getFileExtension,
	getMediaType,
} from "@/lib/file-utils";

interface FilePreviewProps {
	fileName: string;
	fileUrl: string;
	contentType?: string;
	fileSize?: number;
	className?: string;
	showFileName?: boolean;
	showFileSize?: boolean;
}

const FileIcon: React.FC<{ mediaType: string; className?: string }> = ({
	mediaType,
	className = "w-8 h-8",
}) => {
	const iconProps = { className };

	switch (mediaType) {
		case "image":
			return <ImageIcon {...iconProps} />;
		case "video":
			return <Video {...iconProps} />;
		case "audio":
			return <Music {...iconProps} />;
		case "document":
			return <FileText {...iconProps} />;
		case "spreadsheet":
			return <Table {...iconProps} />;
		case "presentation":
			return <Presentation {...iconProps} />;
		case "archive":
			return <Archive {...iconProps} />;
		case "cad":
			return <Box {...iconProps} />;
		case "text":
			return <FileText {...iconProps} />;
		default:
			return <File {...iconProps} />;
	}
};

export const FilePreview: React.FC<FilePreviewProps> = ({
	fileName,
	fileUrl,
	contentType,
	fileSize,
	className = "",
	showFileName = true,
	showFileSize = true,
}) => {
	const mediaType = getMediaType(fileName, contentType);
	const fileExtension = getFileExtension(fileName)
		.toUpperCase()
		.replace(".", "");

	const renderPreview = () => {
		if (mediaType === "image") {
			return (
				<div className="relative w-full h-full">
					<Image
						src={fileUrl}
						alt={fileName}
						fill
						className="object-cover rounded"
						onError={(e) => {
							// Fallback to icon if image fails to load
							const target = e.target as HTMLImageElement;
							target.style.display = "none";
							target.parentElement?.classList.add(
								"bg-gray-100",
								"flex",
								"items-center",
								"justify-center",
							);
							if (target.parentElement) {
								target.parentElement.innerHTML = `
                  <div class="text-gray-400 text-center">
                    <svg class="w-8 h-8 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
                    </svg>
                    <span class="text-xs">${fileExtension}</span>
                  </div>
                `;
							}
						}}
					/>
				</div>
			);
		}

		if (mediaType === "video") {
			return (
				<div className="relative w-full h-full bg-gray-100 rounded flex items-center justify-center">
					<video
						src={fileUrl}
						className="max-w-full max-h-full rounded"
						controls={false}
						preload="metadata"
						onError={() => {
							// Show fallback icon if video fails to load
						}}
					>
						<track kind="captions" label="Captions" />
					</video>
					{/* Video overlay icon */}
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div className="bg-black bg-opacity-50 rounded-full p-2">
							<Video className="w-6 h-6 text-white" />
						</div>
					</div>
				</div>
			);
		}

		// For non-previewable files, show icon with file type
		return (
			<div className="w-full h-full bg-gray-50 dark:bg-gray-800 rounded flex flex-col items-center justify-center p-4">
				<FileIcon
					mediaType={mediaType}
					className="w-12 h-12 text-gray-400 mb-2"
				/>
				<span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">
					{fileExtension || mediaType}
				</span>
			</div>
		);
	};

	return (
		<div className={`relative ${className}`}>
			{/* Preview Area */}
			<div className="aspect-square w-full">{renderPreview()}</div>

			{/* File Info */}
			{(showFileName || showFileSize) && (
				<div className="mt-2 space-y-1">
					{showFileName && (
						<p
							className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate"
							title={fileName}
						>
							{fileName}
						</p>
					)}
					{showFileSize && fileSize && (
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{formatFileSize(fileSize)}
						</p>
					)}
				</div>
			)}
		</div>
	);
};

// Component for grid layout
export const FilePreviewCard: React.FC<
	FilePreviewProps & {
		onRemove?: () => void;
		isPrimary?: boolean;
	}
> = ({
	fileName,
	fileUrl,
	contentType,
	fileSize,
	onRemove,
	isPrimary = false,
	className = "",
}) => {
	const mediaType = getMediaType(fileName, contentType);

	return (
		<div className={`relative group ${className}`}>
			{/* Primary badge */}
			{isPrimary && (
				<div className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-xs px-2 py-1 rounded">
					대표
				</div>
			)}

			{/* File preview */}
			<FilePreview
				fileName={fileName}
				fileUrl={fileUrl}
				contentType={contentType}
				fileSize={fileSize}
				showFileName={false}
				showFileSize={false}
				className="w-full"
			/>

			{/* Remove button */}
			{onRemove && (
				<button
					type="button"
					onClick={onRemove}
					className="absolute top-2 right-2 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
				>
					×
				</button>
			)}

			{/* File info overlay */}
			<div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b">
				<p className="text-xs font-medium truncate" title={fileName}>
					{fileName}
				</p>
				{fileSize && (
					<p className="text-xs opacity-80">{formatFileSize(fileSize)}</p>
				)}
			</div>
		</div>
	);
};

export default FilePreview;
