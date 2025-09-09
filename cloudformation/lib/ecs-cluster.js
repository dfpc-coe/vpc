import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        ECSCluster: {
            Type: 'AWS::ECS::Cluster',
            Properties: {
                ClusterName: cf.stackName,
                ClusterSettings: [{
                    Name: 'containerInsights',
                    Value: 'enhanced'
                }],
                CapacityProviders: ['FARGATE'],
                DefaultCapacityProviderStrategy: [{
                    Base: 0,
                    CapacityProvider: 'FARGATE',
                    Weight: 0
                }]
            }
        },
    }
};
