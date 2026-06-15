output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "Endpoint URL of the EKS cluster API server"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded certificate authority data for the EKS cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_oidc_issuer_url" {
  description = "OIDC issuer URL for the EKS cluster (used for IRSA)"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "oidc_provider_arn" {
  description = "ARN of the IAM OIDC provider for the EKS cluster"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "node_role_arn" {
  description = "ARN of the IAM role used by EKS worker nodes"
  value       = aws_iam_role.node.arn
}

output "irsa_role_arns" {
  description = "Map of service name to IRSA IAM role ARN"
  value = {
    post-service                  = aws_iam_role.post_service.arn
    notification-service          = aws_iam_role.notification_service.arn
    globe-service                 = aws_iam_role.globe_service.arn
    search-service                = aws_iam_role.search_service.arn
    moderation-service            = aws_iam_role.moderation_service.arn
    payment-service               = aws_iam_role.payment_service.arn
    user-service                  = aws_iam_role.user_service.arn
    chat-service                  = aws_iam_role.chat_service.arn
    trust-service                 = aws_iam_role.trust_service.arn
    ml-pipeline                   = aws_iam_role.ml_pipeline.arn
    keda-operator                 = aws_iam_role.keda_operator.arn
    external-secrets-operator     = aws_iam_role.external_secrets_operator.arn
    aws-load-balancer-controller  = aws_iam_role.aws_load_balancer_controller.arn
    cluster-autoscaler            = aws_iam_role.cluster_autoscaler.arn
  }
}
