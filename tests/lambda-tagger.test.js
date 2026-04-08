import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import sinon from 'sinon';

const require = createRequire(import.meta.url);
const ecsSdk = require('@aws-sdk/client-ecs');
const ecrSdk = require('@aws-sdk/client-ecr');

const sourceUrl = new URL('../src/lambda-tagger.js', import.meta.url);
const sourcePath = fileURLToPath(sourceUrl);
const sourceDirectory = path.dirname(sourcePath);
const sourceCode = fs.readFileSync(sourceUrl, 'utf8');

function normalize(value) {
    return JSON.parse(JSON.stringify(value));
}

function loadLambdaTagger(env) {
    const module = { exports: {} };
    const sandbox = {
        console,
        module,
        exports: module.exports,
        process: {
            env: { ...env }
        },
        require
    };

    const wrapper = vm.runInNewContext(
        `(function (exports, require, module, __filename, __dirname, process) {${sourceCode}\n})`,
        sandbox,
        { filename: sourcePath }
    );

    wrapper(module.exports, require, module, sourcePath, sourceDirectory, sandbox.process);

    return module.exports.handler;
}

function setupTest(t, env) {
    const sandbox = sinon.createSandbox();

    t.after(() => sandbox.restore());

    return {
        ecsSend: sandbox.stub(ecsSdk.ECSClient.prototype, 'send'),
        ecrSend: sandbox.stub(ecrSdk.ECRClient.prototype, 'send'),
        handler: loadLambdaTagger(env)
    };
}

test('reconciles active tags, sanitizes names, and removes stale legacy tags', async (t) => {
    const putImageInputs = [];
    const deleteInputs = [];
    let digestLookups = 0;

    const { ecsSend, ecrSend, handler } = setupTest(t, {
        CLUSTER_NAME: 'tak-cluster',
        REPOSITORIES: ' stack-cloudtak-api , '
    });

    ecsSend.callsFake(async (command) => {
        if (command instanceof ecsSdk.ListServicesCommand) {
            assert.equal(command.input.cluster, 'tak-cluster');

            if (!command.input.nextToken) {
                return {
                    nextToken: 'page-2',
                    serviceArns: ['arn:service/api']
                };
            }

            return {
                serviceArns: ['arn:service/worker']
            };
        }

        if (command instanceof ecsSdk.DescribeServicesCommand) {
            assert.deepEqual(normalize(command.input.services), ['arn:service/api', 'arn:service/worker']);

            return {
                services: [{
                    serviceName: 'API Prod',
                    taskDefinition: 'taskdef-api'
                }, {
                    serviceName: 'Worker',
                    taskDefinition: 'taskdef-worker'
                }]
            };
        }

        if (command instanceof ecsSdk.DescribeTaskDefinitionCommand) {
            if (command.input.taskDefinition === 'taskdef-api') {
                return {
                    taskDefinition: {
                        containerDefinitions: [{
                            image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/stack-cloudtak-api:release-2026',
                            name: 'Web API'
                        }, {
                            image: 'public.ecr.aws/docker/library/nginx:latest',
                            name: 'Ignored'
                        }],
                        family: 'api-family'
                    }
                };
            }

            return {
                taskDefinition: {
                    containerDefinitions: [{
                        image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/stack-cloudtak-api:release-2026',
                        name: 'Queue Runner'
                    }],
                    family: 'worker-family'
                }
            };
        }

        throw new Error(`Unexpected ECS command: ${command.constructor.name}`);
    });

    ecrSend.callsFake(async (command) => {
        if (command instanceof ecrSdk.DescribeImagesCommand) {
            if (command.input.imageIds) {
                digestLookups += 1;

                assert.deepEqual(normalize(command.input.imageIds), [{
                    imageTag: 'release-2026'
                }]);

                return {
                    imageDetails: [{
                        imageDigest: 'sha256:release'
                    }]
                };
            }

            if (!command.input.nextToken) {
                return {
                    imageDetails: [{
                        imageDigest: 'sha256:old',
                        imageTags: ['active-api-prod-web-api']
                    }, {
                        imageDigest: 'sha256:stale',
                        imageTags: ['active', 'latest']
                    }],
                    nextToken: 'page-2'
                };
            }

            return {
                imageDetails: [{
                    imageDigest: 'sha256:release',
                    imageTags: ['active-worker-queue-runner']
                }]
            };
        }

        if (command instanceof ecrSdk.BatchGetImageCommand) {
            assert.deepEqual(normalize(command.input.imageIds), [{
                imageDigest: 'sha256:release'
            }]);

            return {
                images: [{
                    imageManifest: 'manifest-release'
                }]
            };
        }

        if (command instanceof ecrSdk.PutImageCommand) {
            putImageInputs.push(command.input);
            return {};
        }

        if (command instanceof ecrSdk.BatchDeleteImageCommand) {
            deleteInputs.push(command.input.imageIds);
            return {};
        }

        throw new Error(`Unexpected ECR command: ${command.constructor.name}`);
    });

    const result = await handler();

    assert.deepEqual(normalize(result), {
        repositories: 1,
        removed: 1,
        services: 2,
        updated: 1
    });
    assert.equal(digestLookups, 1);
    assert.deepEqual(normalize(putImageInputs), [{
        repositoryName: 'stack-cloudtak-api',
        imageManifest: 'manifest-release',
        imageTag: 'active-api-prod-web-api'
    }]);
    assert.deepEqual(normalize(deleteInputs), [[{
        imageTag: 'active'
    }]]);
});

test('fails fast when required environment variables are missing or empty', () => {
    assert.throws(() => {
        loadLambdaTagger({
            REPOSITORIES: 'stack-cloudtak-api'
        });
    }, /Missing required environment variable: CLUSTER_NAME/);

    assert.throws(() => {
        loadLambdaTagger({
            CLUSTER_NAME: 'tak-cluster',
            REPOSITORIES: '   '
        });
    }, /Missing required environment variable: REPOSITORIES/);
});

test('skips updates when digest-based image references already match active tags', async (t) => {
    const batchGetCalls = [];
    const putImageCalls = [];
    const deleteCalls = [];
    const digestLookups = [];

    const { ecsSend, ecrSend, handler } = setupTest(t, {
        CLUSTER_NAME: 'tak-cluster',
        REPOSITORIES: 'stack-auth'
    });

    ecsSend.callsFake(async (command) => {
        if (command instanceof ecsSdk.ListServicesCommand) {
            return {
                serviceArns: ['arn:service/auth']
            };
        }

        if (command instanceof ecsSdk.DescribeServicesCommand) {
            return {
                services: [{
                    serviceName: 'Auth',
                    taskDefinition: 'taskdef-auth'
                }]
            };
        }

        if (command instanceof ecsSdk.DescribeTaskDefinitionCommand) {
            return {
                taskDefinition: {
                    containerDefinitions: [{
                        image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/stack-auth@sha256:current',
                        name: 'API'
                    }, {
                        image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/ignored:latest',
                        name: 'Ignored'
                    }],
                    family: 'auth-family'
                }
            };
        }

        throw new Error(`Unexpected ECS command: ${command.constructor.name}`);
    });

    ecrSend.callsFake(async (command) => {
        if (command instanceof ecrSdk.DescribeImagesCommand) {
            if (command.input.imageIds) {
                digestLookups.push(command.input.imageIds);

                return {
                    imageDetails: [{
                        imageDigest: 'sha256:current'
                    }]
                };
            }

            return {
                imageDetails: [{
                    imageDigest: 'sha256:current',
                    imageTags: ['active-auth-api']
                }]
            };
        }

        if (command instanceof ecrSdk.BatchGetImageCommand) {
            batchGetCalls.push(command.input);
            return {};
        }

        if (command instanceof ecrSdk.PutImageCommand) {
            putImageCalls.push(command.input);
            return {};
        }

        if (command instanceof ecrSdk.BatchDeleteImageCommand) {
            deleteCalls.push(command.input);
            return {};
        }

        throw new Error(`Unexpected ECR command: ${command.constructor.name}`);
    });

    const result = await handler();

    assert.deepEqual(normalize(result), {
        repositories: 1,
        removed: 0,
        services: 1,
        updated: 0
    });
    assert.deepEqual(normalize(digestLookups), [[{
        imageDigest: 'sha256:current'
    }]]);
    assert.deepEqual(normalize(batchGetCalls), []);
    assert.deepEqual(normalize(putImageCalls), []);
    assert.deepEqual(normalize(deleteCalls), []);
});

test('deletes stale active tags in batches of one hundred', async (t) => {
    const deleteBatches = [];

    const { ecsSend, ecrSend, handler } = setupTest(t, {
        CLUSTER_NAME: 'tak-cluster',
        REPOSITORIES: 'stack-cloudtak-api'
    });

    ecsSend.callsFake(async (command) => {
        if (command instanceof ecsSdk.ListServicesCommand) {
            return {
                serviceArns: []
            };
        }

        throw new Error(`Unexpected ECS command: ${command.constructor.name}`);
    });

    ecrSend.callsFake(async (command) => {
        if (command instanceof ecrSdk.DescribeImagesCommand) {
            return {
                imageDetails: Array.from({ length: 101 }, (_, index) => ({
                    imageDigest: `sha256:${index}`,
                    imageTags: [`active-stale-${index}`]
                }))
            };
        }

        if (command instanceof ecrSdk.BatchDeleteImageCommand) {
            deleteBatches.push(command.input.imageIds);
            return {};
        }

        throw new Error(`Unexpected ECR command: ${command.constructor.name}`);
    });

    const result = await handler();

    assert.deepEqual(normalize(result), {
        repositories: 1,
        removed: 101,
        services: 0,
        updated: 0
    });
    assert.equal(deleteBatches.length, 2);
    assert.equal(deleteBatches[0].length, 100);
    assert.equal(deleteBatches[1].length, 1);
    assert.deepEqual(normalize(deleteBatches[0][0]), { imageTag: 'active-stale-0' });
    assert.deepEqual(normalize(deleteBatches[1][0]), { imageTag: 'active-stale-100' });
});
