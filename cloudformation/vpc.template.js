import cf from '@openaddresses/cloudfriend';
import VPC from './lib/vpc.js';
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
        }
    },
    Outputs: {
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
}, VPC, Connect, ELBLogs, ECSCluster);
