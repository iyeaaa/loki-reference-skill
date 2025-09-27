package dto

// 번역 요청 DTO
type TranslationRequest struct {
	Text           string                 `json:"text" example:"안녕하세요" doc:"번역할 텍스트"`
	TargetLang     string                 `json:"targetLang" example:"en" doc:"번역 대상 언어 코드"`
	ElementContext map[string]interface{} `json:"elementContext,omitempty" doc:"HTML 요소 컨텍스트 정보"`
}

// 번역 응답 데이터
type TranslationData struct {
	OriginalText   string                 `json:"originalText" example:"안녕하세요"`
	TranslatedText string                 `json:"translatedText" example:"Hello"`
	SourceLang     string                 `json:"sourceLang" example:"ko"`
	TargetLang     string                 `json:"targetLang" example:"en"`
	ElementContext map[string]interface{} `json:"elementContext,omitempty" doc:"HTML 요소 컨텍스트 정보"`
}

// 번역 응답 DTO
type TranslationResponse struct {
	Message string          `json:"message"`
	Code    int             `json:"code"`
	Data    TranslationData `json:"data"`
}

// 언어 감지 요청 DTO
type LanguageDetectionRequest struct {
	Text string `json:"text" example:"안녕하세요" doc:"언어를 감지할 텍스트"`
}

// 언어 감지 응답 데이터
type LanguageDetectionData struct {
	Text       string  `json:"text" example:"안녕하세요"`
	Language   string  `json:"language" example:"ko"`
	Confidence float64 `json:"confidence" example:"0.95"`
}

// 언어 감지 응답 DTO
type LanguageDetectionResponse struct {
	Message string                `json:"message"`
	Code    int                   `json:"code"`
	Data    LanguageDetectionData `json:"data"`
}