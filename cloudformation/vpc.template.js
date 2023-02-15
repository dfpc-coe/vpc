import cf from '@mapbox/cloudfriend';
import VPC from './lib/vpc.js';

export default cf.merge({
    Description: 'Template for @tak-ps/vpc',
    Parameters: {
        GitSha: {
            Description: 'GitSha that is currently being deployed',
            Type: 'String'
        }
    },
    Resources: {
        Repository: {
            Type: 'AWS::ECR::Repository',
            Properties: {
                RepositoryName: cf.stackName
            }
        }
    }
}, vpc);
