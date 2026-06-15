resource "aws_iam_role" "msk_connect" {
  name        = "${var.cluster_name}-msk-connect-role"
  description = "IAM role for MSK Connect MirrorMaker2 connector"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "kafkaconnect.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  inline_policy {
    name = "msk-connect-kafka-access"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "kafka-cluster:Connect",
            "kafka:DescribeMscCluster",
            "kafka:GetBootstrapBrokers",
            "kafka:DescribeTopic",
            "kafka:CreateTopic",
            "kafka:DescribeGroup",
            "kafka:AlterGroup",
            "kafka:ReadData",
            "kafka:WriteData",
          ]
          Resource = aws_msk_cluster.main.arn
        }
      ]
    })
  }

  tags = {
    Name        = "${var.cluster_name}-msk-connect-role"
    Environment = var.environment
  }
}

resource "aws_mskconnect_connector" "mirrormaker2" {
  count = var.is_primary_region && var.dr_msk_bootstrap_brokers != "" ? 1 : 0

  name                = "blobe-mirrormaker2"
  kafkaconnect_version = "2.7.1"

  capacity {
    autoscaling {
      mcu_count        = 1
      min_worker_count = 1
      max_worker_count = 2

      scale_in_policy {
        cpu_utilization_percentage = 20
      }

      scale_out_policy {
        cpu_utilization_percentage = 80
      }
    }
  }

  connector_configuration = {
    "connector.class"                    = "org.apache.kafka.connect.mirror.MirrorSourceConnector"
    "source.cluster.alias"               = "primary"
    "target.cluster.alias"               = "dr"
    "source.cluster.bootstrap.servers"   = aws_msk_cluster.main.bootstrap_brokers_sasl_iam
    "target.cluster.bootstrap.servers"   = var.dr_msk_bootstrap_brokers
    "topics"                             = "posts,trust-votes,payments,chat.message,globe-events,moderation-queue"
    "replication.factor"                 = "3"
    "sync.topic.acls.enabled"            = "false"
    "emit.heartbeats.interval.seconds"   = "5"
    "refresh.topics.interval.seconds"    = "30"
    "security.protocol"                  = "SASL_SSL"
    "sasl.mechanism"                     = "AWS_MSK_IAM"
  }

  kafka_cluster {
    apache_kafka_cluster {
      bootstrap_servers = aws_msk_cluster.main.bootstrap_brokers_sasl_iam

      vpc {
        security_groups = [aws_security_group.msk.id]
        subnets         = var.subnet_ids
      }
    }
  }

  kafka_cluster_client_authentication {
    authentication_type = "IAM"
  }

  kafka_cluster_encryption_in_transit {
    encryption_type = "TLS"
  }

  service_execution_role_arn = aws_iam_role.msk_connect.arn

  tags = {
    Name        = "blobe-mirrormaker2"
    Environment = var.environment
  }
}
