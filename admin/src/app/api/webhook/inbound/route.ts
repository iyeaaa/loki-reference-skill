import { Readable } from "node:stream";
import sgMail from "@sendgrid/mail";
import busboy from "busboy";
import { type NextRequest, NextResponse } from "next/server";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

function decodeBase64(str: string): string | null {
	try {
		const cleanStr = str.replace(/[\r\n\s]/g, "");
		const decoded = Buffer.from(cleanStr, "base64").toString("utf-8");
		if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
			return decoded;
		}
		return null;
	} catch {
		return null;
	}
}

async function sendAutoReply(
	_toEmail: string,
	fromEmail: string,
	subject: string,
	emailContent: string,
): Promise<boolean> {
	const now = new Date();
	const formattedTime = now.toLocaleString("ko-KR", {
		timeZone: "Asia/Seoul",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});

	const contentSummary = emailContent
		? emailContent.trim().length > 200
			? emailContent.trim().substring(0, 200) + "..."
			: emailContent.trim()
		: "(내용 없음)";

	const msg = {
		to: fromEmail,
		from: {
			email: "rinda@partners.grinda.ai",
			name: "린다 뷰티 (Rinda Beauty)",
		},
		replyTo: "rinda@partners.grinda.ai",
		subject: `Re: ${subject || "문의 감사합니다"}`,
		text: `안녕하세요,

소중한 문의 주셔서 감사합니다.

[접수 정보]
제목: ${subject || "제목 없음"}
내용: ${contentSummary}

접수시간: ${formattedTime}

고객님의 문의사항을 확인했으며, 담당자가 내용을 검토 중입니다.
24시간 이내 상세한 답변을 드리도록 하겠습니다.

감사합니다.

린다 고객지원팀
rinda@partners.grinda.ai`,
		trackingSettings: {
			clickTracking: {
				enable: true,
				enableText: true,
			},
			openTracking: {
				enable: true,
			},
			subscriptionTracking: {
				enable: false,
			},
		},
	};

	try {
		await sgMail.send(msg);
		console.log(`✅ 자동 답장 이메일 발송 성공: ${fromEmail}`);
		return true;
	} catch (error) {
		if (error instanceof Error) {
			console.error("❌ 자동 답장 이메일 발송 실패:", error.message);
			if ('response' in error && error.response) {
				console.error("에러 상세:", (error.response as { body?: unknown }).body);
			}
		} else {
			console.error("❌ 자동 답장 이메일 발송 실패:", error);
		}
		return false;
	}
}

interface FormData {
	[key: string]: string | undefined;
}

interface FileData {
	fieldname: string;
	originalname: string;
	mimetype: string;
	buffer: Buffer;
	size: number;
}

interface BusboyFileInfo {
	filename: string;
	encoding: string;
	mimeType: string;
}

function parseMultipartFormData(req: NextRequest): Promise<{ formData: FormData; files: FileData[] }> {
	return new Promise((resolve, reject) => {
		const formData: FormData = {};
		const files: FileData[] = [];

		const bb = busboy({
			headers: {
				"content-type": req.headers.get("content-type") || "",
			},
		});

		bb.on("field", (name: string, value: string) => {
			formData[name] = value;
		});

		bb.on("file", (name: string, stream: NodeJS.ReadableStream, info: BusboyFileInfo) => {
			const chunks: Buffer[] = [];

			stream.on("data", (chunk: Buffer) => {
				chunks.push(chunk);
			});

			stream.on("end", () => {
				files.push({
					fieldname: name,
					originalname: info.filename,
					mimetype: info.mimeType,
					buffer: Buffer.concat(chunks),
					size: Buffer.concat(chunks).length,
				});
			});
		});

		bb.on("finish", () => {
			resolve({ formData, files });
		});

		bb.on("error", (err: Error) => {
			reject(err);
		});

		req.arrayBuffer().then((buffer) => {
			const nodeStream = Readable.from(Buffer.from(buffer));
			nodeStream.pipe(bb);
		}).catch(reject);
	});
}

export async function POST(request: NextRequest) {
	console.log("\n========================================");
	console.log("         새 이메일 수신 알림");
	console.log("========================================");
	console.log("📅 수신 시간:", new Date().toISOString());

	try {
		const { formData: body, files } = await parseMultipartFormData(request);

		console.log("\n📧 [이메일 기본 정보]");
		console.log("├─ From:", body.from || "없음");
		console.log("├─ To:", body.to || "없음");
		console.log("├─ CC:", body.cc || "없음");
		console.log("└─ Subject:", body.subject || "없음");

		console.log("\n🌐 [발신자 정보]");
		console.log("├─ Sender IP:", body.sender_ip || "없음");
		console.log(
			"└─ Envelope From:",
			(() => {
				try {
					const envelope = JSON.parse(body.envelope || "{}");
					return envelope.from || "없음";
				} catch {
					return "파싱 실패";
				}
			})(),
		);

		console.log("\n📄 [이메일 내용]");
		if (body.text) {
			const textPreview = body.text.slice(0, 200);
			console.log("├─ Text 내용:");
			console.log(
				`│  ${textPreview}${body.text.length > 200 ? "..." : ""}`,
			);
			console.log(`│  (총 ${body.text.length}자)`);
		}
		if (body.html) {
			console.log(`└─ HTML 내용: ${body.html.length}자`);
		}

		const parsedFormData: FormData = {
			to: body.to || "",
			from: body.from || "",
			subject: body.subject || "",
			text: body.text || "",
			html: body.html || "",
			attachments: body.attachments || "[]",
			charsets: body.charsets || "{}",
			sender_ip: body.sender_ip || "",
			envelope: body.envelope || "{}",
			"attachment-info": body["attachment-info"] || "{}",
			"content-ids": body["content-ids"] || "{}",
		};

		let parsedAttachments: { filename: string; content: string }[] = [];

		console.log("\n📎 [첨부파일 정보]");
		console.log("├─ attachment-info:", body["attachment-info"] || "없음");

		interface Attachment {
			filename: string;
			type: string;
			content?: string;
		}

		if (body["attachment-info"]) {
			try {
				const attachmentInfo = JSON.parse(body["attachment-info"]);
				console.log("├─ 파싱된 attachment-info:");
				Object.entries(attachmentInfo).forEach(([key, value]) => {
					console.log(`│  └─ ${key}:`, value);
				});
			} catch {
				console.log("├─ attachment-info 파싱 실패");
			}
		}

		try {
			const attachments = JSON.parse(parsedFormData.attachments || "[]") as Attachment[];
			const decodedAttachments = attachments.map((attachment: Attachment) => {
				console.log(`├─ 첨부파일: ${attachment.filename}`);
				console.log(`│  └─ 타입: ${attachment.type}`);
				console.log(
					`│  └─ 크기: ${attachment.content ? attachment.content.length : 0}자`,
				);

				const decodedContent = attachment.content
					? decodeBase64(attachment.content)
					: null;

				return {
					...attachment,
					content: decodedContent,
				};
			});

			parsedAttachments = decodedAttachments.filter(
				(att) => att.content !== null,
			) as { filename: string; content: string }[];

			if (parsedAttachments.length > 0) {
				console.log(
					`└─ ✅ 디코딩 성공: ${parsedAttachments.length}/${attachments.length}개 파일`,
				);
			}
		} catch {
			console.log("└─ ❌ 첨부파일 처리 중 오류 발생");
		}

		if (files && files.length > 0) {
			console.log("\n📁 [업로드된 파일 (Multipart)]");
			files.forEach((file) => {
				console.log(`├─ 파일명: ${file.originalname}`);
				console.log(`│  ├─ 필드명: ${file.fieldname}`);
				console.log(`│  ├─ MIME 타입: ${file.mimetype}`);
				console.log(`│  └─ 크기: ${file.size} bytes`);
			});
		}

		console.log("\n📝 [추가 메타데이터]");
		if (body.charsets) {
			try {
				const charsets = JSON.parse(body.charsets);
				console.log("├─ 문자 인코딩:");
				Object.entries(charsets).forEach(([key, value]) => {
					console.log(`│  └─ ${key}: ${value}`);
				});
			} catch {
				console.log("├─ charsets 파싱 실패");
			}
		}

		if (body["content-ids"]) {
			try {
				const contentIds = JSON.parse(body["content-ids"]);
				if (Object.keys(contentIds).length > 0) {
					console.log("├─ Content-IDs:");
					Object.entries(contentIds).forEach(([key, value]) => {
						console.log(`│  └─ ${key}: ${value}`);
					});
				}
			} catch {
				console.log("├─ content-ids 파싱 실패");
			}
		}

		console.log("\n🔍 [전체 수신 데이터 키 목록]");
		const allKeys = Object.keys(body);
		console.log(`├─ 총 ${allKeys.length}개 필드`);
		allKeys.forEach((key, index) => {
			const isLast = index === allKeys.length - 1;
			const value = body[key];
			const preview = value
				? value.length > 50
					? `${value.substring(0, 50)}...`
					: value
				: "빈 값";
			console.log(`${isLast ? "└─" : "├─"} ${key}: ${preview}`);
		});

		const emailData = {
			id: Date.now().toString(),
			from: parsedFormData.from || "Unknown",
			to: parsedFormData.to || "Unknown",
			subject: parsedFormData.subject || "No subject",
			text: parsedFormData.text,
			html: parsedFormData.html,
			attachments: parsedAttachments,
			timestamp: new Date().toISOString(),
		};

		const { emails } = await import("@/lib/email-storage");
		emails.push(emailData);

		if (parsedFormData.from && parsedFormData.subject) {
			console.log("\n📤 자동 답장 발송 시도 중...");
			const autoReplySuccess = await sendAutoReply(
				parsedFormData.to || "",
				parsedFormData.from,
				parsedFormData.subject,
				parsedFormData.text || parsedFormData.html || ""
			);

			if (autoReplySuccess) {
				console.log("✅ 자동 답장 발송 완료!");
			} else {
				console.log("❌ 자동 답장 발송 실패!");
			}
		}

		console.log("\n========================================");
		console.log("         이메일 처리 완료");
		console.log("========================================\n");

		return NextResponse.json({ status: "OK" }, { status: 200 });
	} catch (error) {
		console.error("Error processing webhook:", error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}