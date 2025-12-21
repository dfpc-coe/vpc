import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        LogBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region]),
                LifecycleConfiguration: {
                    Rules: [{
                        Id: 'MonthlyDelete',
                        ExpirationInDays: 30,
                        Status: 'Enabled'
                    }]
                }
            }
        },
        LogBucketPolicy: {
            Type: 'AWS::S3::BucketPolicy',
            Properties: {
                Bucket: cf.ref('LogBucket'),
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: {
                                AWS: cf.if(
                                    'OldPrincipal',
                                    cf.join([
                                        'arn:',
                                        cf.partition,
                                        ':iam::',
                                        { 'Fn::FindInMap': ['ELBRegion', cf.region, 'ELBAccount', { DefaultValue: 'DEFAULT' }] },
                                        ':root'
                                    ]),
                                    cf.noValue
                                ),
                                Service: cf.if(
                                    'NewPrincipal',
                                    'logdelivery.elasticloadbalancing.amazonaws.com',
                                    cf.noValue
                                )
                            },
                            Action: 's3:PutObject',
                            Resource: cf.join([cf.getAtt('LogBucket', 'Arn'), '/*'])
                        },{
                            Effect: 'Allow',
                            Principal: {
                                Service: 'delivery.logs.amazonaws.com'
                            },
                            Action: 's3:GetBucketAcl',
                            Resource: [
                                cf.join([cf.getAtt('LogBucket', 'Arn')]),
                                cf.join([cf.getAtt('LogBucket', 'Arn'), '/*'])
                            ],
                            Condition: {
                                StringEquals: {
                                    'aws:SourceAccount': cf.accountId
                                },
                                ArnLike: {
                                    'aws:SourceArn': cf.join(['arn:', cf.partition, ':logs:', cf.region, ':', cf.accountId, ':*'])
                                }
                            }
                        },{
                            Effect: 'Allow',
                            Principal: {
                                Service: 'delivery.logs.amazonaws.com'
                            },
                            Action: 's3:PutObject',
                            Resource: [
                                cf.join([cf.getAtt('LogBucket', 'Arn')]),
                                cf.join([cf.getAtt('LogBucket', 'Arn'), '/*'])
                            ],
                            Condition: {
                                StringEquals: {
                                    's3:x-amz-acl': 'bucket-owner-full-control',
                                    'aws:SourceAccount': cf.accountId
                                },
                                ArnLike: {
                                    'aws:SourceArn': cf.join(['arn:', cf.partition, ':logs:', cf.region, ':', cf.accountId, ':*'])
                                }
                            }
                        }
                    ]
                }
            }
        }
    },
    Conditions: {
        OldPrincipal: cf.notEquals({
            'Fn::FindInMap': ['ELBRegion', cf.region, 'ELBAccount', {
                DefaultValue: 'DEFAULT'
            }]
        }, 'DEFAULT'),
        NewPrincipal: cf.equals({
            'Fn::FindInMap': ['ELBRegion', cf.region, 'ELBAccount', {
                DefaultValue: 'DEFAULT'
            }]
        }, 'DEFAULT')
    },

    // This is necessary due to: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
    Mappings: {
        ELBRegion: {
            'us-gov-east-1': {                  // AWS GovCloud (US-East)
                ELBAccount: '190560391635'
            },
            'us-gov-west-1': {                  // AWS GovCloud (US-West)
                ELBAccount: '048591011584'
            },
            'us-east-1': {                      // US East (N. Virginia)
                ELBAccount: '127311923021'
            },
            'us-east-2': {                      // US East (Ohio)
                ELBAccount: '033677994240'
            },
            'us-west-1': {                      // US West (N. California)
                ELBAccount: '027434742980'
            },
            'us-west-2': {                      // US West (Oregon)
                ELBAccount: '797873946194'
            },
            'af-south-1': {                     // Africa (Cape Town)
                ELBAccount: '098369216593'
            },
            'ap-east-1': {                      // Asia Pacific (Hong Kong)
                ELBAccount: '754344448648'
            },
            'ap-southeast-3': {                 // Asia Pacific (Jakarta)
                ELBAccount: '589379963580'
            },
            'ap-south-1': {                     // Asia Pacific (Mumbai)
                ELBAccount: '718504428378'
            },
            'ap-northeast-3': {                 // Asia Pacific (Osaka)
                ELBAccount: '383597477331'
            },
            'ap-northeast-2': {                 // Asia Pacific (Seoul)
                ELBAccount: '600734575887'
            },
            'ap-southeast-1': {                 // Asia Pacific (Singapore)
                ELBAccount: '114774131450'
            },
            'ap-southeast-2': {                 // Asia Pacific (Sydney)
                ELBAccount: '783225319266'
            },
            'ap-northeast-1': {                 // Asia Pacific (Tokyo)
                ELBAccount: '582318560864'
            },
            'ca-central-1': {                   // Canada (Central)
                ELBAccount: '985666609251'
            },
            'eu-central-1': {                   // Europe (Frankfurt)
                ELBAccount: '054676820928'
            },
            'eu-west-1': {                      // Europe (Ireland)
                ELBAccount: '156460612806'
            },
            'eu-west-2': {                      // Europe (London)
                ELBAccount: '652711504416'
            },
            'eu-south-1': {                     // Europe (Milan)
                ELBAccount: '635631232127'
            },
            'eu-west-3': {                      // Europe (Paris)
                ELBAccount: '009996457667'
            },
            'eu-north-1': {                     // Europe (Stockholm)
                ELBAccount: '897822967062'
            },
            'me-south-1': {                     // Middle East (Bahrain)
                ELBAccount: '076674570225'
            },
            'sa-east-1': {                      // South America (São Paulo)
                ELBAccount: '507241528517'
            }
        }
    },
    Outputs: {
        LogBucket: {
            Description: 'ELB Log Bucket',
            Export: {
                Name: cf.join([cf.stackName, '-bucket'])
            },
            Value: cf.ref('LogBucket')
        }
    }
};
