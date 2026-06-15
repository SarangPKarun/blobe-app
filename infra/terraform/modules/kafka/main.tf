resource "aws_security_group" "msk" {
  name        = "${var.cluster_name}-msk-sg"
  description = "Security group for MSK cluster ${var.cluster_name}"
  vpc_id      = var.vpc_id

  ingress {
    description = "SASL/TLS Kafka broker access"
    from_port   = 9098
    to_port     = 9098
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  ingress {
    description = "ZooKeeper within security group"
    from_port   = 2181
    to_port     = 2181
    protocol    = "tcp"
    self        = true
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.cluster_name}-msk-sg"
    Environment = var.environment
  }
}

resource "aws_msk_configuration" "main" {
  name              = "${var.cluster_name}-config"
  kafka_versions    = ["3.5.1"]
  description       = "MSK configuration for blobe ${var.environment}"

  server_properties = <<-EOT
    auto.create.topics.enable=false
    log.retention.hours=168
    log.retention.bytes=107374182400
    min.insync.replicas=2
    default.replication.factor=3
    num.partitions=6
    offsets.topic.replication.factor=3
    transaction.state.log.replication.factor=3
    transaction.state.log.min.isr=2
    compression.type=lz4
    log.segment.bytes=536870912
  EOT
}

resource "aws_cloudwatch_log_group" "msk" {
  name              = "/blobe/${var.environment}/msk"
  retention_in_days = 30

  tags = {
    Name        = "/blobe/${var.environment}/msk"
    Environment = var.environment
  }
}

resource "aws_msk_cluster" "main" {
  cluster_name           = "blobe-${var.environment}"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_ebs_volume_size

        provisioned_throughput {
          enabled           = true
          volume_throughput = 250
        }
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
    encryption_at_rest_kms_key_arn = var.kms_key_arn
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  client_authentication {
    sasl {
      iam = true
    }
  }

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }

  tags = {
    Name        = "blobe-${var.environment}"
    Environment = var.environment
  }

  depends_on = [aws_cloudwatch_log_group.msk]
}
