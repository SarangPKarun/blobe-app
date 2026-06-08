package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	RedisURL           string
	KafkaBroker        string
	JWTSecret          string
	SageMakerEndpoint  string
	SageMakerTimeoutMs int
	MLEnabled          bool
	MLBlendWeight      float64 // fraction of ML score in the blended result (e.g. 0.7 = 70% ML / 30% algo)
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "3004"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/blobe?sslmode=disable"),
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379"),
		KafkaBroker:        getEnv("KAFKA_BROKER", "localhost:9092"),
		JWTSecret:          getEnv("JWT_SECRET", "super-secret-default-key-for-dev"),
		SageMakerEndpoint:  getEnv("SAGEMAKER_ENDPOINT", ""),
		SageMakerTimeoutMs: getEnvInt("SAGEMAKER_TIMEOUT_MS", 80),
		MLEnabled:          getEnvBool("ML_ENABLED", false),
		MLBlendWeight:      getEnvFloat("ML_BLEND_WEIGHT", 0.7),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func getEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}
