import { NextResponse } from "next/server";
import { emails } from "@/lib/email-storage";

export async function GET() {
	return NextResponse.json({
		count: emails.length,
		emails: emails.slice(-50),
	});
}
