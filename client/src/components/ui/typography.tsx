import * as React from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: "p" | "blockquote" | "lead" | "large" | "small" | "muted";
	children: React.ReactNode;
}

const Typography = React.forwardRef<HTMLDivElement, TypographyProps>(
	({ className, variant = "p", children, ...props }, ref) => {
		const variantClasses = {
			p: "leading-7 [&:not(:first-child)]:mt-6",
			blockquote: "mt-6 border-l-2 pl-6 italic",
			lead: "text-xl text-muted-foreground",
			large: "text-lg font-semibold",
			small: "text-sm font-medium leading-none",
			muted: "text-sm text-muted-foreground",
		};

		return (
			<div
				ref={ref}
				className={cn(
					"whitespace-pre-line break-words",
					variantClasses[variant],
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	},
);

Typography.displayName = "Typography";

export { Typography };
