terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

# ---------------------------------------------------------------------------
# Master password
# ---------------------------------------------------------------------------

resource "random_password" "db_master" {
  length  = 32
  special = true
}

# ---------------------------------------------------------------------------
# Subnet group
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name        = "${var.identifier}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "DB subnet group for ${var.identifier}"

  tags = {
    Name        = "${var.identifier}-subnet-group"
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# Security group — allow PostgreSQL (5432) from specified CIDRs
# ---------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name        = "${var.identifier}-rds-sg"
  description = "Allow PostgreSQL access to ${var.identifier} RDS"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from allowed CIDRs"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.identifier}-rds-sg"
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# Enhanced monitoring IAM role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "rds_enhanced_monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name               = "${var.identifier}-rds-enhanced-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_enhanced_monitoring_assume.json

  tags = {
    Name        = "${var.identifier}-rds-enhanced-monitoring"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ---------------------------------------------------------------------------
# Primary instance
# ---------------------------------------------------------------------------

resource "aws_db_instance" "primary" {
  identifier        = var.identifier
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  db_name  = var.db_name
  username = "blobe_admin"
  password = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "blobe-${var.environment}-final"

  multi_az = true

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = var.kms_key_arn

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name        = var.identifier
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# In-region read replica
# ---------------------------------------------------------------------------

resource "aws_db_instance" "read_replica" {
  identifier             = "${var.identifier}-replica"
  replicate_source_db    = aws_db_instance.primary.identifier
  instance_class         = var.replica_instance_class

  storage_encrypted      = true
  kms_key_id             = var.kms_key_arn
  skip_final_snapshot    = true

  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_arn

  tags = {
    Name        = "${var.identifier}-replica"
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# Cross-region read replica
# Requires provider alias aws.replica configured in the calling environment
# ---------------------------------------------------------------------------

resource "aws_db_instance" "cross_region_replica" {
  count = var.create_cross_region_replica ? 1 : 0

  provider = aws.replica

  identifier          = "${var.identifier}-xregion-replica"
  replicate_source_db = aws_db_instance.primary.arn
  instance_class      = var.replica_instance_class

  storage_encrypted   = true
  kms_key_id          = var.replica_kms_key_arn
  skip_final_snapshot = true

  backup_retention_period = 7

  tags = {
    Name        = "${var.identifier}-xregion-replica"
    Environment = var.environment
  }
}
