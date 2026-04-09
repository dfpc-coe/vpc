import fs from 'node:fs';
import cf from '@openaddresses/cloudfriend';

const repositoryNames = [
    'auth',
    'takserver',
    'cloudtak-api',
    'cloudtak-geofence',
    'cloudtak-media'
].map((suffix) => {
    return cf.join([cf.stackName, '-', suffix]);
});

const lambdaCode = fs.readFileSync(new URL('../../src/lambda-tagger.js', import.meta.url), 'utf8');

export default {
    Resources: {
        ECRActiveTaggerLogGroup: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join(['/aws/lambda/', cf.stackName, '-ecr-active']),
                RetentionInDays: 30
            }
        },
        ECRActiveTaggerRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: 'ecr-active-reconcile',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'logs:CreateLogStream',
                                'logs:PutLogEvents'
                            ],
                            Resource: cf.join(['arn:', cf.partition, ':logs:', cf.region, ':', cf.accountId, ':log-group:/aws/lambda/', cf.stackName, '-ecr-active:*'])
                        }, {
                            Effect: 'Allow',
                            Action: [
                                'ecs:ListServices',
                                'ecs:DescribeServices',
                                'ecs:DescribeTaskDefinition'
                            ],
                            Resource: '*'
                        }, {
                            Effect: 'Allow',
                            Action: [
                                'ecr:DescribeImages',
                                'ecr:BatchGetImage',
                                'ecr:PutImage',
                                'ecr:BatchDeleteImage'
                            ],
                            Resource: cf.join(['arn:', cf.partition, ':ecr:', cf.region, ':', cf.accountId, ':repository/', cf.stackName, '-*'])
                        }]
                    }
                }]
            }
        },
        ECRActiveTaggerFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
                Description: 'Tag in-use ECR images with active-* tags and remove stale active tags',
                FunctionName: cf.join([cf.stackName, '-ecr-active']),
                Handler: 'index.handler',
                MemorySize: 256,
                Role: cf.getAtt('ECRActiveTaggerRole', 'Arn'),
                Runtime: 'nodejs24.x',
                Timeout: 300,
                Environment: {
                    Variables: {
                        CLUSTER_NAME: cf.ref('ECSCluster'),
                        REPOSITORIES: cf.join(',', repositoryNames)
                    }
                },
                Code: {
                    ZipFile: lambdaCode
                }
            }
        },
        ECRActiveTaggerSchedule: {
            Type: 'AWS::Events::Rule',
            Properties: {
                Description: 'Run the ECR active tag reconciler once per day',
                ScheduleExpression: 'rate(1 day)',
                State: 'ENABLED',
                Targets: [{
                    Arn: cf.getAtt('ECRActiveTaggerFunction', 'Arn'),
                    Id: 'ECRActiveTagger'
                }]
            }
        },
        ECRActiveTaggerSchedulePermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                Action: 'lambda:InvokeFunction',
                FunctionName: cf.ref('ECRActiveTaggerFunction'),
                Principal: 'events.amazonaws.com',
                SourceArn: cf.getAtt('ECRActiveTaggerSchedule', 'Arn')
            }
        }
    }
};
