resource "aws_db_parameter_group" "postgres16" {
  name        = "${var.identifier}-postgres16"
  family      = "postgres16"
  description = "Custom parameter group for ${var.identifier} PostgreSQL 16"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,auto_explain"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "max_connections"
    value = "500"
  }

  parameter {
    name  = "work_mem"
    value = "65536"
  }

  parameter {
    name  = "effective_cache_size"
    value = "12582912"
  }

  # SSD-optimized: lower random_page_cost to reflect fast random I/O
  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  tags = {
    Name        = "${var.identifier}-postgres16"
    Environment = var.environment
  }
}
