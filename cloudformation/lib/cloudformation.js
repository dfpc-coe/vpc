import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        CloudFormationRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-cloudformation']),
                Description: 'Service Role assumed by CloudFormation to deploy stacks that depend on this VPC',
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'cloudformation.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole',
                        Condition: {
                            StringEquals: {
                                'aws:SourceAccount': cf.accountId
                            }
                        }
                    }]
                },
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/AdministratorAccess'])
                ]
            }
        }
    },
    Outputs: {
        CloudFormationRole: {
            Description: 'CloudFormation Service Role ARN',
            Export: {
                Name: cf.join([cf.stackName, '-cloudformation-role'])
            },
            Value: cf.getAtt('CloudFormationRole', 'Arn')
        }
    }
};
