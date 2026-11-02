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
        },
        ACMRoot: {
            Type: 'AWS::CertificateManager::Certificate',
            Properties: {
                DomainName: cf.ref('HostedZoneName'),
                SubjectAlternativeNames: [
                    cf.join(['*.', cf.ref('HostedZoneName')]),
                    cf.join(['*.map.', cf.ref('HostedZoneName')])
                ],
                ValidationMethod: 'DNS',
                DomainValidationOptions: [{
                    DomainName: cf.ref('HostedZoneName'),
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
            Description: 'Deprecated ACM Certificate ARN without the apex domain, use ACMRoot',
            Value: cf.ref('ACM'),
            Export: {
                Name: cf.join([cf.stackName, '-acm'])
            }
        },
        ACMRoot: {
            Description: 'ACM Certificate ARN covering the apex domain, wildcard, and wildcard map subdomains',
            Value: cf.ref('ACMRoot'),
            Export: {
                Name: cf.join([cf.stackName, '-acm-root'])
            }
        }
    }
};
