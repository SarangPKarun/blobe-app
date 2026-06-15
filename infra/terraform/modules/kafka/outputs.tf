output "bootstrap_brokers_sasl_iam" {
  description = "SASL/IAM bootstrap brokers connection string for the MSK cluster"
  value       = aws_msk_cluster.main.bootstrap_brokers_sasl_iam
}

output "cluster_arn" {
  description = "ARN of the MSK cluster"
  value       = aws_msk_cluster.main.arn
}

output "security_group_id" {
  description = "ID of the security group attached to the MSK cluster"
  value       = aws_security_group.msk.id
}

output "zookeeper_connect_string" {
  description = "ZooKeeper connection string for the MSK cluster"
  value       = aws_msk_cluster.main.zookeeper_connect_string
}
