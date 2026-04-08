import cf from '@openaddresses/cloudfriend';

const lifecyclePolicyText = JSON.stringify({
    rules: [{
        rulePriority: 1,
        description: 'Retain images tagged active',
        selection: {
            tagStatus: 'tagged',
            tagPrefixList: ['active'],
            countType: 'imageCountMoreThan',
            countNumber: 999999
        },
        action: {
            type: 'expire'
        }
    }, {
        rulePriority: 2,
        description: 'Expire images older than 30 days unless tagged active',
        selection: {
            tagStatus: 'any',
            countType: 'sinceImagePushed',
            countUnit: 'days',
            countNumber: 30
        },
        action: {
            type: 'expire'
        }
    }]
});

export default {
    Resources: {
        RepositoryCloudTAK: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-cloudtak-api']),
                LifecyclePolicy: {
                    LifecyclePolicyText: lifecyclePolicyText
                },
                RepositoryPolicyText: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ]
                    }]
                }
            }
        },
        RepositoryAuth: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-auth']),
                LifecyclePolicy: {
                    LifecyclePolicyText: lifecyclePolicyText
                },
                RepositoryPolicyText: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ]
                    }]
                }
            }
        },
        RepositoryCloudTAKTasks: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-cloudtak-tasks']),
                LifecyclePolicy: {
                    LifecyclePolicyText: lifecyclePolicyText
                },
                RepositoryPolicyText: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ]
                    },{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ],
                        Condition: {
                            StringLike: {
                                'aws:sourceArn': cf.join(['arn:', cf.partition, ':lambda:', cf.region, ':', cf.accountId, ':function:*'])
                            }
                        }
                    }]
                }
            }
        },
        RepositoryCloudTAKGeofence: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-cloudtak-geofence']),
                LifecyclePolicy: {
                    LifecyclePolicyText: lifecyclePolicyText
                },
                RepositoryPolicyText: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ]
                    }]
                }
            }
        },
        RepositoryCloudTAKMedia: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-cloudtak-media']),
                LifecyclePolicy: {
                    LifecyclePolicyText: lifecyclePolicyText
                },
                RepositoryPolicyText: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ]
                    }]
                }
            }
        },
        RepositoryTAKServer: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-takserver']),
                LifecyclePolicy: {
                    LifecyclePolicyText: lifecyclePolicyText
                },
                RepositoryPolicyText: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: [
                            'ecr:BatchGetImage',
                            'ecr:GetDownloadUrlForLayer'
                        ]
                    }]
                }
            }
        }
    }
};
