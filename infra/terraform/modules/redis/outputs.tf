output "primary_endpoint_address" {
  description = "Primary endpoint address for write operations"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint address for read operations"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "configuration_endpoint_address" {
  description = "Configuration endpoint address for cluster mode clients"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "auth_token" {
  description = "Redis AUTH token for client authentication"
  value       = random_password.redis_auth.result
  sensitive   = true
}

output "security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}
