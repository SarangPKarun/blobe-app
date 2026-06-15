###############################################################################
# Common Launch Template
###############################################################################

resource "aws_launch_template" "node_common" {
  name_prefix = "${var.cluster_name}-node-"

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      encrypted             = true
      kms_key_id            = var.kms_ebs_key_arn
      delete_on_termination = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.cluster_name}-node"
      Environment = var.environment
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name        = "${var.cluster_name}-node-volume"
      Environment = var.environment
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

###############################################################################
# System Node Group — ON_DEMAND, critical add-ons taint
###############################################################################

resource "aws_eks_node_group" "system" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-system"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  ami_type       = "BOTTLEROCKET_x86_64"
  capacity_type  = "ON_DEMAND"
  instance_types = [var.system_node_group.instance_type]

  scaling_config {
    min_size     = var.system_node_group.min_size
    max_size     = var.system_node_group.max_size
    desired_size = var.system_node_group.desired_size
  }

  launch_template {
    id      = aws_launch_template.node_common.id
    version = "$Latest"
  }

  taint {
    key    = "CriticalAddonsOnly"
    value  = "true"
    effect = "NO_SCHEDULE"
  }

  labels = {
    role        = "system"
    node-class  = "system"
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
    aws_iam_role_policy_attachment.node_ecr_policy,
  ]

  tags = {
    Name        = "${var.cluster_name}-system"
    Environment = var.environment
  }
}

###############################################################################
# General Node Group — ON_DEMAND
###############################################################################

resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-general"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  ami_type       = "BOTTLEROCKET_x86_64"
  capacity_type  = "ON_DEMAND"
  instance_types = var.general_node_group.instance_types

  scaling_config {
    min_size     = var.general_node_group.min_size
    max_size     = var.general_node_group.max_size
    desired_size = var.general_node_group.desired_size
  }

  launch_template {
    id      = aws_launch_template.node_common.id
    version = "$Latest"
  }

  labels = {
    role       = "general"
    node-class = "general"
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
    aws_iam_role_policy_attachment.node_ecr_policy,
  ]

  tags = {
    Name        = "${var.cluster_name}-general"
    Environment = var.environment
  }
}

###############################################################################
# Spot Node Group
###############################################################################

resource "aws_eks_node_group" "spot" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-spot"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  ami_type       = "BOTTLEROCKET_x86_64"
  capacity_type  = "SPOT"
  instance_types = var.general_node_group.spot_instance_types

  scaling_config {
    min_size     = 0
    max_size     = var.general_node_group.spot_max_size
    desired_size = 0
  }

  launch_template {
    id      = aws_launch_template.node_common.id
    version = "$Latest"
  }

  taint {
    key    = "spot"
    value  = "true"
    effect = "NO_SCHEDULE"
  }

  labels = {
    role                               = "general"
    node-class                         = "spot"
    "node.kubernetes.io/lifecycle"     = "spot"
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
    aws_iam_role_policy_attachment.node_ecr_policy,
  ]

  tags = {
    Name        = "${var.cluster_name}-spot"
    Environment = var.environment
  }
}

###############################################################################
# ML Node Group — ON_DEMAND, ml-workload taint
###############################################################################

resource "aws_eks_node_group" "ml" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-ml"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  ami_type       = "BOTTLEROCKET_x86_64"
  capacity_type  = "ON_DEMAND"
  instance_types = var.ml_node_group.instance_types

  scaling_config {
    min_size     = var.ml_node_group.min_size
    max_size     = var.ml_node_group.max_size
    desired_size = var.ml_node_group.desired_size
  }

  launch_template {
    id      = aws_launch_template.node_common.id
    version = "$Latest"
  }

  taint {
    key    = "ml-workload"
    value  = "true"
    effect = "NO_SCHEDULE"
  }

  labels = {
    role       = "ml"
    node-class = "ml"
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
    aws_iam_role_policy_attachment.node_ecr_policy,
  ]

  tags = {
    Name        = "${var.cluster_name}-ml"
    Environment = var.environment
  }
}
