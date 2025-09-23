"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Activity {
	id: string;
	user: {
		name: string;
		email: string;
		avatar?: string;
	};
	action: string;
	timestamp: number;
	unit: "minutes" | "hours" | "days";
}

interface RecentActivityProps {
	activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
	const getTimeAgo = (
		timestamp: number,
		unit: "minutes" | "hours" | "days",
	) => {
		const unitLabels = {
			minutes: "분 전",
			hours: "시간 전",
			days: "일 전",
		};
		return `${timestamp} ${unitLabels[unit]}`;
	};

	const getActionLabel = (action: string) => {
		const actionLabels: Record<string, string> = {
			createdCampaign: "새로운 이메일 캠페인을 생성했습니다",
			sentEmails: "대량 이메일 발송을 완료했습니다",
			updatedGroup: "사용자 그룹을 업데이트했습니다",
			editedTemplate: "이메일 템플릿을 수정했습니다",
		};
		return actionLabels[action] || action;
	};

	return (
		<div className="space-y-8">
			{activities.map((activity) => (
				<div key={activity.id} className="flex items-center">
					<Avatar className="h-9 w-9">
						<AvatarImage src={activity.user.avatar} alt={activity.user.name} />
						<AvatarFallback>
							{activity.user.name
								.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="ml-4 space-y-1">
						<p className="text-sm font-medium leading-none">
							{activity.user.name}
						</p>
						<p className="text-sm text-muted-foreground">
							{getActionLabel(activity.action)}
						</p>
					</div>
					<div className="ml-auto font-medium text-sm text-muted-foreground">
						{getTimeAgo(activity.timestamp, activity.unit)}
					</div>
				</div>
			))}
		</div>
	);
}
