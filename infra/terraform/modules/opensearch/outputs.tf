output "domain_endpoint" {
  description = "VPC endpoint of the OpenSearch domain"
  value       = aws_opensearch_domain.main.endpoint
}

output "domain_arn" {
  description = "ARN of the OpenSearch domain"
  value       = aws_opensearch_domain.main.arn
}

output "domain_id" {
  description = "Unique identifier for the OpenSearch domain"
  value       = aws_opensearch_domain.main.domain_id
}

output "security_group_id" {
  description = "ID of the security group attached to the OpenSearch domain"
  value       = aws_security_group.opensearch.id
}

output "kibana_endpoint" {
  description = "Kibana (OpenSearch Dashboards) endpoint for the domain"
  value       = aws_opensearch_domain.main.kibana_endpoint
}
