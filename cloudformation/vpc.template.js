import cf from '@openaddresses/cloudfriend';
import VPC from './lib/vpc.js';
import KMS from './lib/kms.js';
import Connect from './lib/connect.js';
import ELBLogs from './lib/elb-logs.js';
import ECSCluster from './lib/ecs-cluster.js';

export default cf.merge({
    Description: 'Template for @tak-ps/vpc',
    Parameters: {
        GitSha: {
            Description: 'GitSha that is currently being deployed',
            Type: 'String'
        },
        HostedZoneID: {
            Description: 'Each VPC is designed to support a TAK environment on a single Hosted Zone',
            Type: 'String'
        },
        HostedZoneName: {
            Description: 'Each VPC is designed to support a TAK environment on a single Hosted Zone',
            Type: 'String'
        },
        Environment: {
            Description: 'StackName postfix of the environment - IE "dev", "staging", "prod"',
            Type: 'String',
            Default: 'cotak-prod'
        }
    },
    Resources: {
        Application: {
            Type: 'AWS::ServiceCatalogAppRegistry::Application',
            Properties: {
                Name: cf.ref('Environment'),
                Description: "TAK Server Application Stack"
            },
        },
        ApplicationAssociation: {
            Type: 'AWS::ServiceCatalogAppRegistry::ResourceAssociation',
            DependsOn: 'Application',
            Properties: {
                Application: cf.getAtt('Application', 'Arn'),
                Resource: cf.stackId,
                ResourceType: 'CFN_STACK'
            }
        }
    },
    Outputs: {
        ApplicationARN: {
            Description: 'Service Catalog Application ID',
            Export: {
                Name: cf.join([cf.stackName, '-application'])
            },
            Value: cf.ref('Application')
        },
        HostedZoneName: {
            Description: 'HostedZoneName for TAK Deployment',
            Export: {
                Name: cf.join([cf.stackName, '-hosted-zone-name'])
            },
            Value: cf.ref('HostedZoneName')
        },
        HostedZoneID: {
            Description: 'HostedZoneID for TAK Deployment',
            Export: {
                Name: cf.join([cf.stackName, '-hosted-zone-id'])
            },
            Value: cf.ref('HostedZoneID')
        }
    }
}, VPC, KMS, Connect, ELBLogs, ECSCluster);
