# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### Pending Release

### v2.0.0

- :tada: Move to fully IPv6 support VPC

Notes:
- Change all ELBs from Dualstack to IPv4
- Scale all ECS Services to 0
- All ENIs with IPv6 Addresses have to be removed

### v1.6.0

- :rocket: Expose a NGW per AG to improve resiliency in case of an AG outage

### v1.5.0

- :tada: Add preliminary IPv6 support for VPC (Private Subnets) - note to deploy the Subnet A/B value of `AssignIpv6AddressOnCreation` must be commented out, deployed and then deployed again with the comment removed

### v1.4.0

- :tada: Add preliminary IPv6 support for VPC - note to deploy the Subnet A/B value of `AssignIpv6AddressOnCreation` must be commented out, deployed and then deployed again with the comment removed

### v1.3.0

- :rocket: Update deps & ESLint Config

### v1.2.0

- :tada: Add EC2 Instance Connect Endpoint

### v1.1.0

- :rocket: Add Release Action

### v1.0.0

- :rocket: Initial Release

