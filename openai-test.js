import { OpenAI } from "openai";
import dotenv from 'dotenv';

// .env 파일에서 환경변수 로드
dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // .env 파일의 OPENAI_API_KEY 사용
});

async function testOpenAI() {
    try {
        const completion = await client.chat.completions.create({
            model: "gpt-5-mini", // GPT-5 mini 모델 사용
            messages: [
                {
                    role: "user",
                    content: "who are you?",
                },
            ],
        });

        console.log("Response:");
        console.log(completion.choices[0].message.content);

        // 추가 정보 출력
        console.log("\n--- Usage Info ---");
        console.log(`Prompt tokens: ${completion.usage.prompt_tokens}`);
        console.log(`Completion tokens: ${completion.usage.completion_tokens}`);
        console.log(`Total tokens: ${completion.usage.total_tokens}`);

    } catch (error) {
        if (error.code === 'insufficient_quota') {
            console.error("\n❌ API 사용량 한도 초과!");
            console.error("OpenAI 대시보드에서 결제 정보를 확인하세요:");
            console.error("https://platform.openai.com/account/billing");
        } else if (error.status === 401) {
            console.error("\n❌ API 키 인증 실패!");
            console.error(".env 파일의 OPENAI_API_KEY를 확인하세요.");
        } else {
            console.error("Error:", error.message);
        }
    }
}

// 실행
testOpenAI();