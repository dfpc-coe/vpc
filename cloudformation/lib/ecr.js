import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        RepositoryCloudTAK: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-cloudtak-api']),
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
        RepositoryCloudTAKGeofence: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.join([cf.stackName, '-cloudtak-geofence']),
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
