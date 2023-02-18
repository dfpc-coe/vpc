import cf from '@openaddresses/cloudfriend';
import VPC from './lib/vpc.js';

export default cf.merge({
    Description: 'Template for @tak-ps/vpc',
    Parameters: {
        GitSha: {
            Description: 'GitSha that is currently being deployed',
            Type: 'String'
        }
    }
}, VPC);
