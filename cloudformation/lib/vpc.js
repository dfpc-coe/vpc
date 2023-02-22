import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        VPC: {
            Type: 'AWS::EC2::VPC',
            Properties: {
                EnableDnsHostnames: true,
                EnableDnsSupport: true,
                CidrBlock: '10.0.0.0/16',
                Tags: [{
                    Key: 'Name',
                    Value: cf.join([cf.stackName])
                }]
            }
        },
        SubnetPublicA: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
                AvailabilityZone: cf.select(0, cf.getAzs(cf.region)),
                VpcId: cf.ref('VPC'),
                CidrBlock: '10.0.1.0/24',
                MapPublicIpOnLaunch: true,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join([cf.stackName, '-subnet-public-a'])
                }]
            }
        },
        SubnetPublicB: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
                AvailabilityZone: cf.select(1, cf.getAzs(cf.region)),
                VpcId: cf.ref('VPC'),
                CidrBlock: '10.0.2.0/24',
                MapPublicIpOnLaunch: true,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join([cf.stackName, '-subnet-public-b'])
                }]
            }
        },
        SubnetPrivateA: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
                AvailabilityZone: cf.select(0, cf.getAzs(cf.region)),
                VpcId: cf.ref('VPC'),
                CidrBlock: '10.0.3.0/24',
                MapPublicIpOnLaunch: false,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join([cf.stackName, '-subnet-private-a'])
                }]
            }
        },
        SubnetPrivateB: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
                AvailabilityZone: cf.select(1, cf.getAzs(cf.region)),
                VpcId: cf.ref('VPC'),
                CidrBlock: '10.0.4.0/24',
                MapPublicIpOnLaunch: false,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join([cf.stackName, '-subnet-private-b'])
                }]
            }
        },
        InternetGateway: {
            Type: 'AWS::EC2::InternetGateway',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                },{
                    Key: 'Network',
                    Value: 'Public'
                }]
            }
        },
        VPCIG: {
            Type: 'AWS::EC2::VPCGatewayAttachment',
            Properties: {
                InternetGatewayId: cf.ref('InternetGateway'),
                VpcId: cf.ref('VPC')
            }
        },
        PublicRouteTable: {
            Type: 'AWS::EC2::RouteTable',
            Properties: {
                VpcId: cf.ref('VPC'),
                Tags: [{
                    Key: 'Network',
                    Value: 'Public'
                },{
                    Key: 'Name',
                    Value: cf.join([cf.stackName, '-public'])
                }]
            }
        },
        PublicRoute: {
            Type: 'AWS::EC2::Route',
            DependsOn:  'VPCIG',
            Properties: {
                RouteTableId: cf.ref('PublicRouteTable'),
                DestinationCidrBlock: '0.0.0.0/0',
                GatewayId: cf.ref('InternetGateway')
            }
        },
        SubnetPublicAAssoc: {
            Type: 'AWS::EC2::SubnetRouteTableAssociation',
            Properties: {
                RouteTableId: cf.ref('PublicRouteTable'),
                SubnetId: cf.ref('SubnetPublicA')
            }
        },
        SubnetPublicBAssoc: {
            Type: 'AWS::EC2::SubnetRouteTableAssociation',
            Properties: {
                RouteTableId: cf.ref('PublicRouteTable'),
                SubnetId: cf.ref('SubnetPublicB')
            }
        },
        NatGateway: {
            Type: 'AWS::EC2::NatGateway',
            DependsOn: 'NatPublicIP',
            Properties:  {
                AllocationId: cf.getAtt('NatPublicIP', 'AllocationId'),
                SubnetId: cf.ref('SubnetPublicA'),
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                }]
            }
        },
        NatPublicIP: {
            Type: 'AWS::EC2::EIP',
            DependsOn: 'VPC',
            Properties: {
                Domain: 'vpc',
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                }]
            }
        },
        PrivateRouteTable: {
            Type: 'AWS::EC2::RouteTable',
            Properties: {
                VpcId: cf.ref('VPC'),
                Tags: [{
                    Key: 'Network',
                    Value: 'Private'
                },{
                    Key: 'Name',
                    Value: cf.join([cf.stackName, '-private'])
                }]
            }
        },
        PrivateRoute: {
            Type: 'AWS::EC2::Route',
            DependsOn:  'VPCIG',
            Properties: {
                RouteTableId: cf.ref('PrivateRouteTable'),
                DestinationCidrBlock: '0.0.0.0/0',
                NatGatewayId: cf.ref('NatGateway')
            }
        },
        SubnetPrivateAAssoc: {
            Type: 'AWS::EC2::SubnetRouteTableAssociation',
            Properties: {
                RouteTableId: cf.ref('PrivateRouteTable'),
                SubnetId: cf.ref('SubnetPrivateA')
            }
        },
        SubnetPrivateBAssoc: {
            Type: 'AWS::EC2::SubnetRouteTableAssociation',
            Properties: {
                RouteTableId: cf.ref('PrivateRouteTable'),
                SubnetId: cf.ref('SubnetPrivateB')
            }
        },
    },
};
