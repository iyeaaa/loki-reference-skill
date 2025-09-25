import { Readable } from "node:stream";
import busboy from "busboy";
import { type NextRequest, NextResponse } from "next/server";
import { emails } from "@/lib/email-storage";

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
	try {
		const { formData: body, files } = await parseMultipartFormData(request);

		const email = {
			id: Date.now().toString(),
			timestamp: new Date().toISOString(),
			from: body.from || "",
			to: body.to || "",
			subject: body.subject || "",
			text: body.text || "",
			html: body.html || "",
			attachments: files
				? files.map((f: FileData) => ({
						filename: f.originalname,
						size: f.size,
						mimetype: f.mimetype,
					}))
				: [],
		};

		emails.push(email);
		console.log(`이메일 저장됨: ${email.subject} (ID: ${email.id})`);

		return NextResponse.json({ status: "OK" }, { status: 200 });
	} catch (error) {
		console.error("Error storing email:", error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}

// Removed export { emails } - not valid for Next.js route
