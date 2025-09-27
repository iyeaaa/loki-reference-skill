package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	db "server/db/sqlc"
	"server/dto"
	pkgredis "server/internal/pkg/redis"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sqlc-dev/pqtype"
	"go.uber.org/zap"
)

// Google Translate API 응답 구조체
type GoogleTranslateResponse struct {
	Data struct {
		Translations []struct {
			TranslatedText string `json:"translatedText"`
		} `json:"translations"`
	} `json:"data"`
}

// Qwen API 요청 구조체
type QwenTranslateRequest struct {
	Model              string          `json:"model"`
	Messages           []QwenMessage   `json:"messages"`
	MaxTokens          int             `json:"max_tokens"`
	Temperature        float64         `json:"temperature"`
	ChatTemplateKwargs map[string]bool `json:"chat_template_kwargs"`
}

// Qwen 메시지 구조체
type QwenMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Qwen API 응답 구조체
type QwenTranslateResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// CachedTranslation Redis에 저장할 번역 데이터 구조체
type CachedTranslation struct {
	OriginalText   string `json:"originalText"`
	TranslatedText string `json:"translatedText"`
	TargetLang     string `json:"targetLang"`
	Timestamp      int64  `json:"timestamp"`
}

// 전역 HTTP 클라이언트 추가
var (
	httpClient = &http.Client{
		Timeout: 60 * time.Second, // timeout을 30초로 증가
		Transport: &http.Transport{
			MaxIdleConns:        1000,
			MaxIdleConnsPerHost: 1000,
			IdleConnTimeout:     90 * time.Second,
			DisableCompression:  false,
			DisableKeepAlives:   false,
		},
	}
)

// generateCacheKey 번역 캐시 키 생성
func generateCacheKey(text, targetLang string) string {
	hash := sha256.Sum256([]byte(text + ":" + targetLang))
	return fmt.Sprintf("translation:%x", hash)
}

// HandleTranslate godoc
// @Summary Translate text
// @Description Translate text from one language to another using 3-tier lookup: Redis -> DB -> Google API
// @Tags Translation
// @Accept json
// @Produce json
// @Param request body dto.TranslationRequest true "Translation request"
// @Success 200 {object} dto.TranslationResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/translate [post]
func (h *Handler) HandleTranslate(c *gin.Context) {
	var request dto.TranslationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	h.logger.Info("Translation request received",
		zap.String("text", request.Text),
		zap.String("targetLang", request.TargetLang))

	// 1차: Redis 캐시에서 번역 결과 확인
	cacheKey := generateCacheKey(request.Text, request.TargetLang)
	h.logger.Debug("Checking Redis cache", zap.String("cacheKey", cacheKey), zap.String("text", request.Text), zap.String("targetLang", request.TargetLang))
	if cachedResult, err := getFromCache(c.Request.Context(), cacheKey); err == nil {
		h.logger.Info("Cache hit: Redis",
			zap.String("cacheKey", cacheKey),
			zap.String("source", "redis"),
			zap.String("targetLang", request.TargetLang))

		response := dto.TranslationResponse{
			Message: "Translation successful (cached)",
			Code:    http.StatusOK,
			Data: dto.TranslationData{
				OriginalText:   cachedResult.OriginalText,
				TranslatedText: cachedResult.TranslatedText,
				SourceLang:     "ko",
				TargetLang:     cachedResult.TargetLang,
				ElementContext: request.ElementContext,
			},
		}
		c.JSON(http.StatusOK, response)
		return
	}

	// 2차: DB에서 번역 확인 (승인됨 / 대기중 / 없음)
	// 2-1: 승인된 번역 확인
	h.logger.Debug("Checking DB for approved translation", zap.String("cacheKey", cacheKey), zap.String("targetLang", request.TargetLang))
	approvedRow, err := h.queries.GetApprovedTranslation(c.Request.Context(), db.GetApprovedTranslationParams{
		SourceText:     request.Text,
		TargetLanguage: request.TargetLang,
	})
	if err == nil {
		h.logger.Info("Cache hit: DB (approved)",
			zap.String("cacheKey", cacheKey),
			zap.String("source", "db_approved"),
			zap.String("targetLang", request.TargetLang))

		// Redis에 업데이트
		cachedData := CachedTranslation{
			OriginalText:   request.Text,
			TranslatedText: approvedRow.TranslatedText,
			TargetLang:     request.TargetLang,
			Timestamp:      time.Now().Unix(),
		}
		saveToCache(c.Request.Context(), cacheKey, cachedData)
		h.logger.Debug("Cached approved translation to Redis", zap.String("cacheKey", cacheKey))

		// element_context 파싱
		var elementContext map[string]interface{}
		if approvedRow.ElementContext.Valid && len(approvedRow.ElementContext.RawMessage) > 0 {
			if err := json.Unmarshal(approvedRow.ElementContext.RawMessage, &elementContext); err != nil {
				h.logger.Warn("Failed to unmarshal element context", zap.Error(err))
				elementContext = request.ElementContext // fallback to request context
			}
		} else {
			elementContext = request.ElementContext
		}

		response := dto.TranslationResponse{
			Message: "Translation successful (approved)",
			Code:    http.StatusOK,
			Data: dto.TranslationData{
				OriginalText:   request.Text,
				TranslatedText: approvedRow.TranslatedText,
				SourceLang:     "ko",
				TargetLang:     request.TargetLang,
				ElementContext: elementContext,
			},
		}
		c.JSON(http.StatusOK, response)
		return
	}

	// 2-2: 어떤 상태든 기존 번역이 있는지 확인
	h.logger.Debug("Checking DB for existing translation", zap.String("cacheKey", cacheKey), zap.String("sourceText", request.Text))
	existingTranslation, err := h.queries.GetTranslationBySourceAndTarget(c.Request.Context(), db.GetTranslationBySourceAndTargetParams{
		SourceText:     request.Text,
		TargetLanguage: request.TargetLang,
	})
	if err == nil {
		// 기존 번역이 있으면 (pending, rejected 등) 검수 대기 메시지 반환
		// 해당 번역의 리뷰 상태 확인
		reviewStatus, _ := h.queries.GetTranslationReviewStatus(c.Request.Context(), existingTranslation.ID)
		statusStr := "unknown"
		if reviewStatus.Valid {
			statusStr = string(reviewStatus.ReviewStatusEnum)
		}
		h.logger.Info("Cache hit: DB (existing)",
			zap.String("cacheKey", cacheKey),
			zap.String("source", "db_existing"),
			zap.String("status", statusStr),
			zap.String("translationId", existingTranslation.ID.String()))

		var message string
		var translatedText string

		// 실제 번역된 텍스트를 그대로 사용
		translatedText = existingTranslation.TranslatedText
		
		if reviewStatus.Valid {
			switch reviewStatus.ReviewStatusEnum {
			case db.ReviewStatusEnumPending:
				message = "Translation pending review"
			case db.ReviewStatusEnumExternalReview:
				message = "Translation under external review"
			case db.ReviewStatusEnumInternalReview:
				message = "Translation under internal review"
			case db.ReviewStatusEnumRejected:
				message = "Translation was rejected"
			case db.ReviewStatusEnumRevisionRequired:
				message = "Translation requires revision"
			default:
				message = "Translation pending review"
			}
		} else {
			message = "Translation pending review"
		}

		response := dto.TranslationResponse{
			Message: message,
			Code:    http.StatusOK,
			Data: dto.TranslationData{
				OriginalText:   request.Text,
				TranslatedText: translatedText,
				SourceLang:     "ko",
				TargetLang:     request.TargetLang,
				ElementContext: request.ElementContext,
			},
		}
		c.JSON(http.StatusOK, response)
		return
	}

	// 3차: 번역이 전혀 없는 경우에만 Translation API 호출 및 DB 저장
	h.logger.Info("Cache miss: No translation found",
		zap.String("cacheKey", cacheKey),
		zap.String("source", "none"),
		zap.String("action", "calling_api"))

	// 번역 엔진 확인
	translationEngine := os.Getenv("TRANSLATION_ENGINE")
	if translationEngine == "" {
		translationEngine = "google" // 기본값
	}

	var translatedText string

	if translationEngine == "qwen" {
		// Qwen 모델 사용
		qwenURL := os.Getenv("QWEN_API_URL")
		if qwenURL == "" {
			h.logger.Error("Qwen API URL not found")
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Qwen API URL is not configured",
			})
			return
		}
		h.logger.Info("Calling Qwen translation API",
			zap.String("engine", "qwen"),
			zap.String("apiURL", qwenURL),
			zap.String("sourceText", request.Text),
			zap.String("targetLang", request.TargetLang))
		translatedText, err = translateWithQwen(request.Text, request.TargetLang, qwenURL)
	} else {
		// Google Translate API 사용
		apiKey := os.Getenv("GOOGLE_TRANSLATE_API_KEY")
		if apiKey == "" {
			h.logger.Error("Google Translate API Key not found")
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Google Translate API key is not configured",
			})
			return
		}
		h.logger.Info("Calling Google Translate API",
			zap.String("engine", "google"),
			zap.String("sourceText", request.Text),
			zap.String("targetLang", request.TargetLang))
		translatedText, err = translateWithGoogle(request.Text, request.TargetLang, apiKey)
	}
	if err != nil {
		h.logger.Error("Translation failed",
			zap.String("engine", translationEngine),
			zap.String("sourceText", request.Text),
			zap.String("targetLang", request.TargetLang),
			zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "translation failed",
			"details": err.Error(),
		})
		return
	}

	h.logger.Info("Translation API response received",
		zap.String("engine", translationEngine),
		zap.String("sourceText", request.Text),
		zap.String("targetLang", request.TargetLang),
		zap.String("translatedText", translatedText))

	// 모든 활성 언어에 대해 번역 데이터 생성
	if err := h.createTranslationsForAllLanguages(c.Request.Context(), request.Text, request.TargetLang, translatedText, request.ElementContext, translationEngine); err != nil {
		h.logger.Error("Failed to save translations to DB", zap.Error(err))
		// DB 저장 실패 시 에러 반환
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save translations",
		})
		return
	}

	// Redis에는 저장하지 않음 (승인 후에만 Redis에 저장)
	// 실제 번역된 텍스트를 반환
	response := dto.TranslationResponse{
		Message: "Translation pending review",
		Code:    http.StatusOK,
		Data: dto.TranslationData{
			OriginalText:   request.Text,
			TranslatedText: translatedText, // 실제 번역된 텍스트 사용
			SourceLang:     "ko",
			TargetLang:     request.TargetLang,
			ElementContext: request.ElementContext,
		},
	}

	h.logger.Info("Translation saved for review",
		zap.String("originalText", request.Text),
		zap.String("translatedText", translatedText),
		zap.String("status", "pending"))

	c.JSON(http.StatusOK, response)
}

// getFromCache Redis에서 번역 결과 조회
func getFromCache(ctx context.Context, key string) (*CachedTranslation, error) {
	redisClient := pkgredis.GetClient()
	if redisClient == nil {
		return nil, fmt.Errorf("redis client not available")
	}

	val, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var cached CachedTranslation
	if err := json.Unmarshal([]byte(val), &cached); err != nil {
		return nil, err
	}

	return &cached, nil
}

// saveToCache Redis에 번역 결과 저장 (무제한)
func saveToCache(ctx context.Context, key string, data CachedTranslation) {
	redisClient := pkgredis.GetClient()
	if redisClient == nil {
		zap.L().Warn("Redis client not available, skipping cache")
		return
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		zap.L().Error("Failed to marshal cache data", zap.Error(err))
		return
	}

	// TTL을 0으로 설정하여 무제한 캐시
	err = redisClient.Set(ctx, key, jsonData, 0).Err()
	if err != nil {
		zap.L().Error("Failed to save to cache", zap.Error(err))
		return
	}

	zap.L().Debug("Translation saved to cache (permanent)",
		zap.String("key", key))
}

// createTranslationsForAllLanguages 모든 활성 언어에 대해 번역 데이터를 생성합니다
func (h *Handler) createTranslationsForAllLanguages(ctx context.Context, sourceText, requestedLang, requestedTranslation string, elementContext map[string]interface{}, engine string) error {
	// 모든 활성 언어 조회
	activeLanguages, err := h.queries.ListActiveLanguages(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active languages: %w", err)
	}

	// Transaction 시작
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	qtx := h.queries.WithTx(tx)

	// element_context를 JSONB로 변환
	var contextJSON pqtype.NullRawMessage
	if elementContext != nil {
		jsonBytes, err := json.Marshal(elementContext)
		if err != nil {
			return fmt.Errorf("failed to marshal element context: %w", err)
		}
		contextJSON = pqtype.NullRawMessage{
			RawMessage: jsonBytes,
			Valid:      true,
		}
	}

	// 각 언어에 대해 번역 데이터 생성
	for _, lang := range activeLanguages {
		if lang.Code == "ko" {
			// 한국어는 원문이므로 번역하지 않음
			continue
		}

		var translatedText string
		var translationEngine string

		// 요청된 언어는 이미 번역된 텍스트 사용
		if lang.Code == requestedLang {
			translatedText = requestedTranslation
			translationEngine = engine
		} else {
			// 다른 언어들은 선택된 엔진으로 번역
			var translated string
			var err error

			if engine == "qwen" {
				qwenURL := os.Getenv("QWEN_API_URL")
				if qwenURL != "" {
					translated, err = translateWithQwen(sourceText, lang.Code, qwenURL)
				} else {
					err = fmt.Errorf("Qwen API URL not configured")
				}
			} else {
				apiKey := os.Getenv("GOOGLE_TRANSLATE_API_KEY")
				if apiKey != "" {
					translated, err = translateWithGoogle(sourceText, lang.Code, apiKey)
				} else {
					err = fmt.Errorf("Google API key not configured")
				}
			}

			if err != nil {
				h.logger.Warn("Failed to translate for language",
					zap.String("language", lang.Code),
					zap.Error(err))
				translatedText = sourceText // 번역 실패 시 원문 그대로 사용
				translationEngine = "pending"
			} else {
				translatedText = translated
				translationEngine = engine
			}
		}

		cacheKey := generateCacheKey(sourceText, lang.Code)

		// 60~95 사이의 랜덤 품질 점수 생성
		qualityScore := rand.Intn(36) + 60 // 60 ~ 95

		// translation_data에 저장 (upsert)
		translationID, err := qtx.UpsertTranslation(ctx, db.UpsertTranslationParams{
			SourceText:     sourceText,
			TargetLanguage: lang.Code,
			TranslatedText: translatedText,
			TranslationEngine: sql.NullString{
				String: translationEngine,
				Valid:  true,
			},
			RedisKey: sql.NullString{
				String: cacheKey,
				Valid:  true,
			},
			ElementContext: contextJSON,
			QualityConfidenceScore: sql.NullInt32{
				Int32: int32(qualityScore),
				Valid: true,
			},
		})
		if err != nil {
			return fmt.Errorf("failed to upsert translation data for %s: %w", lang.Code, err)
		}

		// translation_reviews에 검수 대기 상태로 저장
		err = qtx.CreateTranslationReview(ctx, db.CreateTranslationReviewParams{
			TranslationID: translationID,
			ReviewStatus: db.NullReviewStatusEnum{
				ReviewStatusEnum: db.ReviewStatusEnumPending,
				Valid:            true,
			},
			Priority: sql.NullInt32{
				Int32: 3,
				Valid: true,
			},
		})
		if err != nil {
			return fmt.Errorf("failed to create translation review for %s: %w", lang.Code, err)
		}

		h.logger.Info("Translation created",
			zap.String("translationID", translationID.String()),
			zap.String("language", lang.Code),
			zap.String("engine", translationEngine),
			zap.String("status", "pending"))
	}

	// Transaction commit
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// translateWithGoogle Google Translate API를 사용하여 번역을 수행합니다
func translateWithGoogle(text, targetLang, apiKey string) (string, error) {
	logger := zap.L()

	encodedText := url.QueryEscape(text)
	apiURL := fmt.Sprintf("https://translation.googleapis.com/language/translate/v2?q=%s&target=%s&format=text&key=%s",
		encodedText, targetLang, apiKey)

	req, err := http.NewRequest("POST", apiURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	logger.Debug("Google Translate API request prepared",
		zap.String("targetLang", targetLang),
		zap.String("text", text))

	start := time.Now()
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Error("Google Translate API request failed",
			zap.Error(err))
		return "", fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	latency := time.Since(start)
	logger.Info("Google Translate API response received",
		zap.Int("statusCode", resp.StatusCode),
		zap.Duration("latency", latency))

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("Google Translate API returned error status",
			zap.Int("statusCode", resp.StatusCode),
			zap.String("responseBody", string(body)))
		return "", fmt.Errorf("API request failed with status: %d, body: %s", resp.StatusCode, string(body))
	}

	var translateResp GoogleTranslateResponse
	if err := json.NewDecoder(resp.Body).Decode(&translateResp); err != nil {
		logger.Error("Failed to decode Google Translate response",
			zap.Error(err))
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(translateResp.Data.Translations) == 0 {
		logger.Error("No translations in Google Translate response",
			zap.Any("response", translateResp))
		return "", fmt.Errorf("no translations found in response")
	}

	translatedText := translateResp.Data.Translations[0].TranslatedText

	logger.Info("Google translation successful",
		zap.String("sourceText", text),
		zap.String("targetLang", targetLang),
		zap.String("translatedText", translatedText))

	return translatedText, nil
}

// translateWithQwen Qwen 모델을 사용하여 번역을 수행합니다
func translateWithQwen(text, targetLang, apiURL string) (string, error) {
	logger := zap.L()

	// 언어 코드를 언어 이름으로 매핑
	langMap := map[string]string{
		"en": "English",
		"zh": "Chinese",
		"ja": "Japanese",
		"es": "Spanish",
		"fr": "French",
		"de": "German",
		"ru": "Russian",
		"pt": "Portuguese",
		"it": "Italian",
		"nl": "Dutch",
		"pl": "Polish",
		"ar": "Arabic",
		"hi": "Hindi",
		"th": "Thai",
		"vi": "Vietnamese",
		"id": "Indonesian",
	}

	targetLangName, exists := langMap[targetLang]
	if !exists {
		targetLangName = targetLang // 매핑이 없으면 코드 그대로 사용
	}

	// Qwen API 요청 준비 - 하나은행 금융 앱 번역 최적화 프롬프트
	// Qwen3 32B 가이드라인 기반 최적화 (전체 영어 버전)
	systemPrompt := fmt.Sprintf(`You are a professional banking translator specialized in Hana Bank mobile applications. Please translate Korean text into natural and accurate %s. Preserve Korean proper names (like 홍길동 as Hong Gil-dong), keep Hana Bank service names unchanged (하나원큐, 하나머니, 하나페이), maintain all numbers and formatting exactly, and use formal banking terminology appropriate for financial services.`, targetLangName)

	userPrompt := fmt.Sprintf(`Translate the following Hana Bank mobile app text from Korean to %s:\n\n"%s"\n\nProvide only the translation without any explanations.`, targetLangName, text)

	reqBody := QwenTranslateRequest{
		Model: "Qwen/Qwen3-32B",
		Messages: []QwenMessage{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: userPrompt,
			},
		},
		MaxTokens:   500,
		Temperature: 0.3, // 번역은 일관성이 중요하므로 낮은 temperature
		ChatTemplateKwargs: map[string]bool{
			"enable_thinking": false,
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	logger.Debug("Qwen API request prepared",
		zap.String("url", apiURL+"/chat/completions"),
		zap.String("model", reqBody.Model),
		zap.String("systemPrompt", systemPrompt),
		zap.String("prompt", userPrompt),
		zap.Float64("temperature", reqBody.Temperature),
		zap.Int("maxTokens", reqBody.MaxTokens))

	// API 호출
	req, err := http.NewRequest("POST", apiURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	start := time.Now()
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Error("Qwen API request failed",
			zap.String("url", apiURL+"/chat/completions"),
			zap.Error(err))
		return "", fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	latency := time.Since(start)
	logger.Info("Qwen API response received",
		zap.Int("statusCode", resp.StatusCode),
		zap.Duration("latency", latency))

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("Qwen API returned error status",
			zap.Int("statusCode", resp.StatusCode),
			zap.String("responseBody", string(body)))
		return "", fmt.Errorf("API request failed with status: %d, body: %s", resp.StatusCode, string(body))
	}

	var qwenResp QwenTranslateResponse
	if err := json.NewDecoder(resp.Body).Decode(&qwenResp); err != nil {
		logger.Error("Failed to decode Qwen response",
			zap.Error(err))
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(qwenResp.Choices) == 0 {
		logger.Error("No translations in Qwen response",
			zap.Any("response", qwenResp))
		return "", fmt.Errorf("no translations found in response")
	}

	// 번역 결과 정제 (앞뒤 공백 제거)
	translatedText := strings.TrimSpace(qwenResp.Choices[0].Message.Content)

	logger.Info("Qwen translation successful",
		zap.String("sourceText", text),
		zap.String("targetLang", targetLang),
		zap.String("translatedText", translatedText))

	return translatedText, nil
}
