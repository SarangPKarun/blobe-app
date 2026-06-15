output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "List of IDs of the data subnets"
  value       = aws_subnet.data[*].id
}

output "nat_gateway_ids" {
  description = "List of IDs of the NAT gateways"
  value       = aws_nat_gateway.main[*].id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "peering_connection_id" {
  description = "ID of the VPC peering connection (empty string if not created)"
  value       = length(aws_vpc_peering_connection.cross_region) > 0 ? aws_vpc_peering_connection.cross_region[0].id : ""
}
