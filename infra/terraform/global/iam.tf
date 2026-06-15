# ---------------------------------------------------------------------------
# SageMaker Execution Role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "sagemaker_assume_role" {
  statement {
    sid     = "SageMakerTrust"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["sagemaker.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sagemaker_execution" {
  name               = "blobe-sagemaker-execution"
  description        = "Execution role for SageMaker training jobs and endpoints"
  assume_role_policy = data.aws_iam_policy_document.sagemaker_assume_role.json

  tags = {
    Name = "blobe-sagemaker-execution"
  }
}

resource "aws_iam_role_policy_attachment" "sagemaker_full_access" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

resource "aws_iam_role_policy_attachment" "sagemaker_s3_full_access" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "sagemaker_cloudwatch_logs" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

# ---------------------------------------------------------------------------
# EKS Node Extra Policy (Cluster Autoscaler discovery)
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "eks_node_extra" {
  statement {
    sid    = "EC2Describe"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeRegions",
      "ec2:DescribeRouteTables",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",
      "ec2:DescribeTags",
      "ec2:DescribeVolumes",
      "ec2:DescribeVpcs",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "AutoscalingDescribe"
    effect = "Allow"
    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeScalingActivities",
      "autoscaling:DescribeTags",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "EKSDescribe"
    effect = "Allow"
    actions = [
      "eks:DescribeCluster",
      "eks:DescribeNodegroup",
      "eks:DescribeFargateProfile",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "eks_node_extra" {
  name        = "blobe-eks-node-extra"
  description = "Extra permissions for EKS nodes — Cluster Autoscaler discovery"
  policy      = data.aws_iam_policy_document.eks_node_extra.json

  tags = {
    Name = "blobe-eks-node-extra"
  }
}

# ---------------------------------------------------------------------------
# Placeholder attachment — actual node role ARN supplied by the EKS module.
# Replace var.eks_node_role_name with the real role once the EKS module is
# applied; the attachment is kept here so the policy is managed globally.
# ---------------------------------------------------------------------------

variable "eks_node_role_name" {
  description = "Name of the EKS managed node IAM role (set after EKS module is applied)"
  type        = string
  default     = ""
}

resource "aws_iam_role_policy_attachment" "eks_node_extra" {
  count      = var.eks_node_role_name != "" ? 1 : 0
  role       = var.eks_node_role_name
  policy_arn = aws_iam_policy.eks_node_extra.arn
}
