package dto

// 기본 응답 DTO
type ResponseDto struct {
	Message string      `json:"message"`
	Code    int         `json:"code"`
	Data    interface{} `json:"data"`
}