module "kms" {
  source      = "../../modules/kms"
  environment = var.environment
  region      = var.region
}

module "vpc" {
  source          = "../../modules/vpc"
  environment     = var.environment
  region          = var.region
  vpc_cidr        = var.vpc_cidr
  azs             = var.azs
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  data_subnets    = var.data_subnets
}

module "eks" {
  source             = "../../modules/eks"
  cluster_name       = "blobe-${var.environment}"
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  kms_ebs_key_arn    = module.kms.key_arns["ebs"]
  admin_cidrs        = var.admin_cidrs
}

module "rds" {
  source                      = "../../modules/rds"
  identifier                  = "blobe-${var.environment}"
  environment                 = var.environment
  vpc_id                      = module.vpc.vpc_id
  subnet_ids                  = module.vpc.data_subnet_ids
  kms_key_arn                 = module.kms.key_arns["rds"]
  instance_class              = var.rds_instance_class
  replica_instance_class      = var.rds_replica_instance_class
  allocated_storage           = var.rds_allocated_storage
  max_allocated_storage       = var.rds_max_allocated_storage
  allowed_cidr_blocks         = [module.vpc.vpc_cidr_block]
  create_cross_region_replica = true
  replica_region              = "eu-west-1"
  replica_kms_key_arn         = "TODO-set-after-eu-west-1-deploy"
}

module "redis" {
  source                 = "../../modules/redis"
  cluster_id             = "blobe-${var.environment}"
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.data_subnet_ids
  kms_key_arn            = module.kms.key_arns["elasticache"]
  node_type              = var.redis_node_type
  num_node_groups        = var.redis_num_node_groups
  allowed_cidr_blocks    = [module.vpc.vpc_cidr_block]
  enable_global_datastore = true
}

module "kafka" {
  source                 = "../../modules/kafka"
  cluster_name           = "blobe-${var.environment}"
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.data_subnet_ids
  kms_key_arn            = module.kms.key_arns["msk"]
  broker_instance_type   = var.msk_broker_instance_type
  number_of_broker_nodes = var.msk_broker_count
  broker_ebs_volume_size = var.msk_ebs_volume_size
  allowed_cidr_blocks    = [module.vpc.vpc_cidr_block]
  is_primary_region      = true
}

module "opensearch" {
  source                = "../../modules/opensearch"
  domain_name           = "blobe"
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.data_subnet_ids
  kms_key_arn           = module.kms.key_arns["s3"]
  data_instance_type    = var.opensearch_data_instance_type
  data_instance_count   = var.opensearch_data_instance_count
  allowed_cidr_blocks   = [module.vpc.vpc_cidr_block]
}

module "s3" {
  source            = "../../modules/s3"
  environment       = var.environment
  kms_key_arn       = module.kms.key_arns["s3"]
  is_primary_region = true
}

module "cloudfront" {
  source                         = "../../modules/cloudfront"
  environment                    = var.environment
  webview_bucket_regional_domain = module.s3.webview_bucket_regional_domain
  media_bucket_regional_domain   = module.s3.media_bucket_regional_domain
  acm_certificate_arn            = "TODO-from-global-module"
  access_logs_bucket             = "${module.s3.media_bucket_id}.s3.amazonaws.com"
}

module "secrets" {
  source      = "../../modules/secrets"
  environment = var.environment
  kms_key_arn = module.kms.key_arns["secrets"]
}
