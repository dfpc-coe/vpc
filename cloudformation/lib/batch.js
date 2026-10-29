import cf from '@openaddresses/cloudfriend';

/*
 * A shared AWS Batch compute environment for long-running jobs that do not
 * belong on a service task (hours of work, their own memory budget, no
 * shell into the task). The VPC owns the compute environment and its
 * security group; each consumer stack defines its own job queue and job
 * definition against the exports below.
 *
 * No ServiceRole: for a MANAGED compute environment Batch uses its
 * service-linked role (AWSServiceRoleForBatch), creating it on first use.
 * Fargate compute environments update without interruption, so the vCPU
 * cap and the security group can change later without a replacement.
 */
export default {
    Resources: {
        BatchSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'batch-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'batch-sg']),
                GroupDescription: 'Batch Compute Environment SG (egress only; consumer stacks admit it where needed)',
                VpcId: cf.ref('VPC')
            }
        },
        BatchComputeEnvironment: {
            Type: 'AWS::Batch::ComputeEnvironment',
            Properties: {
                Type: 'MANAGED',
                State: 'ENABLED',
                ComputeEnvironmentName: cf.join('-', [cf.stackName, 'batch']),
                ComputeResources: {
                    Type: 'FARGATE',
                    MaxvCpus: 16,
                    SecurityGroupIds: [cf.ref('BatchSecurityGroup')],
                    Subnets: [
                        cf.ref('SubnetPrivateA'),
                        cf.ref('SubnetPrivateB')
                    ]
                }
            }
        }
    },
    Outputs: {
        BatchComputeEnvironment: {
            Description: 'Batch Compute Environment ARN for consumer job queues',
            Export: {
                Name: cf.join([cf.stackName, '-batch-compute-environment'])
            },
            Value: cf.ref('BatchComputeEnvironment')
        },
        BatchSecurityGroup: {
            Description: 'Batch Compute Environment SG',
            Export: {
                Name: cf.join([cf.stackName, '-batch-sg'])
            },
            Value: cf.ref('BatchSecurityGroup')
        }
    }
};
