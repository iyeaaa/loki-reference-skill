#!/bin/bash

# Gemini Search 기능 설치 스크립트

echo "🚀 Gemini Search 기능 설치 시작..."

# 1. 패키지 설치
echo ""
echo "📦 Google Generative AI SDK 설치 중..."
bun add @google/generative-ai

# 2. 환경 변수 확인
echo ""
echo "🔑 환경 변수 설정 확인..."
if grep -q "GEMINI_API_KEY" .env 2>/dev/null; then
    echo "✅ GEMINI_API_KEY가 이미 .env에 설정되어 있습니다."
else
    echo "⚠️  .env 파일에 GEMINI_API_KEY를 추가해야 합니다."
    echo ""
    echo "다음 내용을 .env 파일에 추가하세요:"
    echo "GEMINI_API_KEY=your-gemini-api-key-here"
    echo ""
    echo "API 키 발급: https://aistudio.google.com/app/apikey"
fi

echo ""
echo "✅ 설치 완료!"
echo ""
echo "📝 다음 단계:"
echo "1. .env 파일에 GEMINI_API_KEY 추가 (필수)"
echo "2. 서버 재시작: bun run dev"
echo "3. 프론트엔드에서 사이드바 → 'Gemini Search' 메뉴 확인"
echo ""
echo "📖 자세한 사용법:"
echo "   - 기본 가이드: ../GEMINI_SEARCH_SETUP.md"
echo "   - Drive URL 방식 (간단!): ../GEMINI_DRIVE_URL_SIMPLE.md"

