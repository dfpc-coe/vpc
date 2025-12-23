import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        ACM: {
            Type: 'AWS::CertificateManager::Certificate',
            Properties: {
                DomainName: cf.join(['*.', cf.ref('HostedZoneName')]),
                SubjectAlternativeNames: [
                    cf.join(['*.map.', cf.ref('HostedZoneName')])
                ],
                ValidationMethod: 'DNS',
                DomainValidationOptions: [{
                    DomainName: cf.ref('HostedZoneName'),
                    HostedZoneId: cf.ref('HostedZoneID')
                },{
                    DomainName: cf.join(['*.', cf.ref('HostedZoneName')]),
                    HostedZoneId: cf.ref('HostedZoneID')
                }, {
                    DomainName: cf.join(['*.map.', cf.ref('HostedZoneName')]),
                    HostedZoneId: cf.ref('HostedZoneID')
                }]
            }
        }
    },
    Outputs: {
        ACM: {
            Description: 'ACM Certificate ARN',
            Value: cf.ref('ACM'),
            Export: {
                Name: cf.join([cf.stackName, '-acm'])
            }
        }
    }
};
