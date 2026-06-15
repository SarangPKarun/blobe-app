# ============================================================
# Blobe — eu-west-1  (Disaster Recovery / standby region)
# ============================================================
#
# DR FAILOVER STEPS (manual runbook):
# ─────────────────────────────────────────────────────────────
# 1. ROUTE 53 — flip weighted/failover routing records so
#    api.blobe.app and globe.blobe.app resolve to eu-west-1
#    ALBs.
#
# 2. RDS — promote the eu-west-1 cross-region read replica to
#    standalone primary:
#      aws rds promote-read-replica \
#        --db-instance-identifier blobe-postgres-eu-west-1 \
#        --region eu-west-1
#    Then update app secrets (DATABASE_URL) in Secrets Manager
#    to point at the new primary endpoint.
#    NOTE: after promotion, scale up to db.r6g.2xlarge if
#    sustained write load is expected:
#      aws rds modify-db-instance \
#        --db-instance-identifier blobe-postgres-eu-west-1 \
#        --db-instance-class db.r6g.2xlarge \
#        --apply-immediately
#
# 3. REDIS — the eu-west-1 ElastiCache cluster is a secondary
#    member of the Global Datastore created in us-east-1.
#    Detach it and promote it to primary via the AWS Console
#    or CLI:
#      aws elasticache failover-global-replication-group \
#        --global-replication-group-id blobe-global \
#        --primary-region eu-west-1 \
#        --primary-replication-group-id blobe-redis-eu-west-1
#
# 4. KAFKA — MirrorMaker2 runs in us-east-1 and replicates to
#    eu-west-1. After failover, point producers/consumers at
#    the eu-west-1 MSK bootstrap brokers. MirrorMaker2 is NOT
#    deployed in this region (is_primary_region = false).
#
# 5. EKS — scale up node groups to production sizing:
#      general_node_group_max → 15  (same as us-east-1)
#    Update the HPA / Karpenter provisioner limits accordingly.
#
# 6. CLOUDFRONT — the CloudFront distribution is global and
#    deployed only from us-east-1. No CloudFront resources are
#    managed here. The CDN continues to serve cached content
#    and will route origin requests to the eu-west-1 ALB once
#    Route 53 is updated.
# ============================================================

locals {
  name_prefix = "blobe-${var.environment}"
}

# ──────────────────────────────────────────────────────────────
# KMS — one key per service category
# ──────────────────────────────────────────────────────────────
module "kms" {
  source      = "../../modules/kms"
  environment = var.environment
  region      = var.region
}

# ──────────────────────────────────────────────────────────────
# VPC
# Cross-region VPC peering back to us-east-1 is configured via
# the peer_* variables so RDS replica traffic stays private.
# ──────────────────────────────────────────────────────────────
module "vpc" {
  source = "../../modules/vpc"

  environment     = var.environment
  region          = var.region
  vpc_cidr        = var.vpc_cidr
  azs             = var.azs
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  data_subnets    = var.data_subnets

  # Peer back to us-east-1 VPC (10.0.0.0/16).
  # Populate these once the us-east-1 VPC ID is known (output
  # from the us_east_1 remote state or passed in as tfvars).
  peer_vpc_id   = try(data.terraform_remote_state.us_east_1.outputs.vpc_id, "")
  peer_vpc_cidr = "10.0.0.0/16"
  peer_region   = "us-east-1"
}

# ──────────────────────────────────────────────────────────────
# EKS
# DR cluster runs with a smaller max node count (var.general_node_group_max = 8).
# Scale up to 15 manually during an active failover.
# ──────────────────────────────────────────────────────────────
module "eks" {
  source = "../../modules/eks"

  cluster_name       = "${local.name_prefix}-eks-eu-west-1"
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  kms_ebs_key_arn    = module.kms.key_arns["ebs"]

  general_node_group = {
    instance_types      = ["m5.xlarge", "m5.2xlarge"]
    min_size            = 2
    max_size            = var.general_node_group_max # 8 in DR; bump to 15 on failover
    desired_size        = 2
    spot_instance_types = ["m5.xlarge", "m5.2xlarge", "m4.xlarge"]
    spot_max_size       = 6
  }
}

# ──────────────────────────────────────────────────────────────
# RDS (PostgreSQL)
# This instance is a cross-region read replica seeded from
# us-east-1. cross_region_replica is set to false here because
# the replica relationship is established FROM the primary
# (us-east-1 side). Promote it manually during DR failover.
# ──────────────────────────────────────────────────────────────
module "rds" {
  source = "../../modules/rds"

  identifier             = "${local.name_prefix}-postgres-eu-west-1"
  environment            = var.environment
  instance_class         = var.rds_instance_class         # db.r6g.xlarge; promote to r6g.2xlarge on failover
  replica_instance_class = var.rds_replica_instance_class
  subnet_ids             = module.vpc.data_subnet_ids
  vpc_id                 = module.vpc.vpc_id
  kms_key_arn            = module.kms.key_arns["rds"]
  allowed_cidr_blocks    = [var.vpc_cidr]

  # Cross-region replica is NOT created from this side.
  # The us-east-1 RDS module creates a replica that targets eu-west-1.
  create_cross_region_replica = false
  replica_region              = ""
  replica_kms_key_arn         = ""
}

# ──────────────────────────────────────────────────────────────
# ElastiCache (Redis)
# Deployed as a standalone cluster here. After the primary
# (us-east-1) Global Datastore is up, add this replication
# group as a secondary OUTSIDE of Terraform via AWS Console
# or CLI (Terraform does not manage Global Datastore membership
# for secondary regions):
#   aws elasticache create-global-replication-group \
#     --global-replication-group-id-suffix blobe-global \
#     --primary-replication-group-id blobe-redis-us-east-1
#   aws elasticache associate-global-replication-group \
#     --global-replication-group-id <id> \
#     --replication-group-id blobe-redis-eu-west-1 \
#     --replication-group-region eu-west-1
# ──────────────────────────────────────────────────────────────
module "redis" {
  source = "../../modules/redis"

  cluster_id          = "${local.name_prefix}-redis-eu-west-1"
  environment         = var.environment
  node_type           = var.redis_node_type
  num_node_groups     = var.redis_num_node_groups
  subnet_ids          = module.vpc.data_subnet_ids
  vpc_id              = module.vpc.vpc_id
  kms_key_arn         = module.kms.key_arns["elasticache"]
  allowed_cidr_blocks = [var.vpc_cidr]

  # Global Datastore membership is managed outside Terraform for
  # the secondary region — do NOT set enable_global_datastore here.
  enable_global_datastore = false
}

# ──────────────────────────────────────────────────────────────
# MSK (Kafka)
# is_primary_region = false suppresses MirrorMaker2 deployment.
# MirrorMaker2 runs in us-east-1 and replicates topics to this
# cluster. After DR failover, applications should be repointed
# to this cluster's bootstrap brokers.
# ──────────────────────────────────────────────────────────────
module "kafka" {
  source = "../../modules/kafka"

  cluster_name           = "${local.name_prefix}-msk-eu-west-1"
  environment            = var.environment
  number_of_broker_nodes = var.msk_broker_count
  broker_instance_type   = var.msk_broker_instance_type
  subnet_ids             = module.vpc.data_subnet_ids
  vpc_id                 = module.vpc.vpc_id
  kms_key_arn            = module.kms.key_arns["msk"]
  allowed_cidr_blocks    = [var.vpc_cidr]

  # No MirrorMaker2 in the DR region — replication is sourced from
  # us-east-1 (is_primary_region = true there).
  is_primary_region        = false
  dr_msk_bootstrap_brokers = ""
}

# ──────────────────────────────────────────────────────────────
# OpenSearch
# ──────────────────────────────────────────────────────────────
module "opensearch" {
  source = "../../modules/opensearch"

  domain_name         = "${local.name_prefix}-search-eu-west-1"
  environment         = var.environment
  data_instance_type  = var.opensearch_data_instance_type
  data_instance_count = var.opensearch_data_instance_count
  subnet_ids          = module.vpc.data_subnet_ids
  vpc_id              = module.vpc.vpc_id
  kms_key_arn         = module.kms.key_arns["s3"] # reuse s3 key for OS at-rest encryption
  allowed_cidr_blocks = [var.vpc_cidr]
}

# ──────────────────────────────────────────────────────────────
# S3 (media + web assets)
# In the DR region S3 is the replication TARGET — buckets are
# created here so us-east-1 can replicate into them.
# is_primary_region = false disables outbound replication rules.
# ──────────────────────────────────────────────────────────────
module "s3" {
  source = "../../modules/s3"

  environment       = var.environment
  kms_key_arn       = module.kms.key_arns["s3"]
  is_primary_region = false # replication destination, not source
}

# ──────────────────────────────────────────────────────────────
# Secrets Manager
# ──────────────────────────────────────────────────────────────
module "secrets" {
  source = "../../modules/secrets"

  environment     = var.environment
  kms_key_arn     = module.kms.key_arns["secrets"]
}

# ──────────────────────────────────────────────────────────────
# CloudFront — NOT deployed here
# CloudFront is a global service managed exclusively from the
# us-east-1 environment (ACM certs for CF must live in us-east-1).
# During DR failover, update the CloudFront origin to point at
# the eu-west-1 ALB — no Terraform changes required in this env.
# ──────────────────────────────────────────────────────────────
