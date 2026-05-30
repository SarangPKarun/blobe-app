package config

import "os"

type Config struct {
	Port             string
	RedisURL         string
	KafkaBroker      string
	ElasticsearchURL string
	JWTSecret        string
}

func Load() *Config {
	return &Config{
		Port:             getEnv("PORT", "3005"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379"),
		KafkaBroker:      getEnv("KAFKA_BROKER", "localhost:9092"),
		ElasticsearchURL: getEnv("ELASTICSEARCH_URL", "http://localhost:9200"),
		JWTSecret:        getEnv("JWT_SECRET", "super-secret-default-key-for-dev"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
