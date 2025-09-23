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
): Promise<boolean> {
	const now = new Date();
	const formattedTime = now.toLocaleString("ko-KR", {
		timeZone: "Asia/Seoul",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	const emailEndings = [
		"감사합니다.",
		"좋은 하루 보내세요.",
		"연락 주셔서 감사합니다.",
		"빠른 시일 내에 답변 드리겠습니다.",
		"추가 문의사항이 있으시면 언제든지 연락 주세요.",
		"항상 최선을 다하겠습니다.",
		"귀하의 이메일을 잘 받았습니다.",
		"좋은 하루 되시기 바랍니다.",
	];

	const randomEnding =
		emailEndings[Math.floor(Math.random() * emailEndings.length)];

	const autoReplyMessage = {
		to: fromEmail,
		from: "hana.lee@gmail.com",
		subject: `Re: ${subject}`,
		html: `
			<div style="font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
				<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
					<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">자동 응답 메일</h1>
					<p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 14px;">Auto Reply System</p>
				</div>

				<div style="padding: 40px 30px;">
					<div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
						<p style="margin: 0; color: #495057; line-height: 1.6;">
							안녕하세요,<br><br>
							귀하의 이메일을 잘 받았습니다.<br>
							빠른 시일 내에 검토 후 답변 드리도록 하겠습니다.<br><br>
							${randomEnding}
						</p>
					</div>

					<div style="border-top: 2px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
						<h3 style="color: #495057; font-size: 16px; margin-bottom: 15px;">📧 원본 메시지 정보</h3>
						<div style="background-color: #ffffff; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px;">
							<p style="margin: 5px 0; color: #6c757d; font-size: 13px;"><strong>제목:</strong> ${subject}</p>
							<p style="margin: 5px 0; color: #6c757d; font-size: 13px;"><strong>수신 시간:</strong> ${formattedTime}</p>
						</div>
					</div>

					<div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 4px;">
						<p style="color: #6c757d; font-size: 11px; margin: 0; text-align: center;">
							이 메일은 자동으로 발송된 메일입니다.<br>
							This is an automated response email.
						</p>
					</div>
				</div>
			</div>
		`,
	};

	try {
		await sgMail.send(autoReplyMessage);
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
				parsedFormData.subject
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