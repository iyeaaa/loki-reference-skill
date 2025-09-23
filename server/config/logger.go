package config

import (
	"fmt"
	"os"
	"path/filepath"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const enableFileLogging = false

func InitLogger() (*zap.Logger, error) {
	var cores []zapcore.Core
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	// 파일 로깅이 활성화된 경우에만 파일에 로그를 저장
	if enableFileLogging {
		logFile := filepath.Join(".", "server.log")
		file, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, fmt.Errorf("can't open log file: %v", err)
		}
		cores = append(cores, zapcore.NewCore(
			zapcore.NewJSONEncoder(encoderConfig),
			zapcore.AddSync(file),
			zap.InfoLevel,
		))
	}

	// 콘솔 출력은 항상 활성화
	cores = append(cores, zapcore.NewCore(
		zapcore.NewConsoleEncoder(encoderConfig),
		zapcore.AddSync(os.Stdout),
		zap.InfoLevel,
	))

	core := zapcore.NewTee(cores...)
	return zap.New(core), nil
}