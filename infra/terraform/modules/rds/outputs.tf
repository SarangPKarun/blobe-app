output "primary_endpoint" {
  description = "Connection endpoint of the primary RDS instance"
  value       = aws_db_instance.primary.endpoint
}

output "primary_port" {
  description = "Port of the primary RDS instance"
  value       = aws_db_instance.primary.port
}

output "replica_endpoint" {
  description = "Connection endpoint of the in-region read replica"
  value       = aws_db_instance.read_replica.endpoint
}

output "cross_region_replica_endpoint" {
  description = "Connection endpoint of the cross-region read replica (empty string if not created)"
  value       = var.create_cross_region_replica ? aws_db_instance.cross_region_replica[0].endpoint : ""
}

output "db_name" {
  description = "Name of the initial database"
  value       = aws_db_instance.primary.db_name
}

output "db_username" {
  description = "Master username for the RDS instance"
  value       = aws_db_instance.primary.username
}

output "master_password" {
  description = "Master password for the RDS instance"
  value       = random_password.db_master.result
  sensitive   = true
}

output "subnet_group_name" {
  description = "Name of the DB subnet group"
  value       = aws_db_subnet_group.main.name
}

output "security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}
