const { ECSClient, ListServicesCommand, DescribeServicesCommand, DescribeTaskDefinitionCommand } = require('@aws-sdk/client-ecs');
const { ECRClient, DescribeImagesCommand, BatchGetImageCommand, PutImageCommand, BatchDeleteImageCommand } = require('@aws-sdk/client-ecr');

const ecs = new ECSClient({});
const ecr = new ECRClient({});

const MAX_CONCURRENT_TASK_DEFINITIONS = 5;

function getRequiredEnv(name) {
    const value = process.env[name];

    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value.trim();
}

function parseRepositories(value) {
    const repositoryNames = value
        .split(',')
        .map((repository) => repository.trim())
        .filter(Boolean);

    if (repositoryNames.length === 0) {
        throw new Error('Missing required environment variable: REPOSITORIES must contain at least one repository name');
    }

    return new Set(repositoryNames);
}

async function mapWithConcurrency(items, concurrency, iteratee) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => {
        return worker();
    }));

    return results;
}

const cluster = getRequiredEnv('CLUSTER_NAME');
const repositories = parseRepositories(getRequiredEnv('REPOSITORIES'));
const imageDigestCache = {};

function tagFor(serviceName, containerName) {
    return `active-${serviceName}-${containerName}`
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}

async function listServices() {
    const serviceArns = [];
    let nextToken;

    do {
        const response = await ecs.send(new ListServicesCommand({
            cluster,
            maxResults: 10,
            nextToken
        }));

        serviceArns.push(...(response.serviceArns || []));
        nextToken = response.nextToken;
    } while (nextToken);

    return serviceArns;
}

async function describeServices(serviceArns) {
    const services = [];

    for (let index = 0; index < serviceArns.length; index += 10) {
        const response = await ecs.send(new DescribeServicesCommand({
            cluster,
            services: serviceArns.slice(index, index + 10)
        }));

        services.push(...(response.services || []));
    }

    return services;
}

function parseImageReference(image) {
    const firstSlash = image.indexOf('/');

    if (firstSlash < 0) {
        return undefined;
    }

    const repositoryReference = image.slice(firstSlash + 1);
    const digestSeparator = repositoryReference.lastIndexOf('@');
    const tagSeparator = repositoryReference.lastIndexOf(':');

    if (digestSeparator > 0) {
        return {
            repository: repositoryReference.slice(0, digestSeparator),
            reference: repositoryReference.slice(digestSeparator + 1)
        };
    }

    if (tagSeparator > 0) {
        return {
            repository: repositoryReference.slice(0, tagSeparator),
            reference: repositoryReference.slice(tagSeparator + 1)
        };
    }

    return undefined;
}

async function resolveDigest(repository, reference) {
    const cacheKey = `${repository}@${reference}`;

    if (imageDigestCache[cacheKey]) {
        return imageDigestCache[cacheKey];
    }

    imageDigestCache[cacheKey] = (async () => {
        const response = await ecr.send(new DescribeImagesCommand({
            repositoryName: repository,
            imageIds: [reference.startsWith('sha256:') ? {
                imageDigest: reference
            } : {
                imageTag: reference
            }]
        }));

        const digest = response.imageDetails?.[0]?.imageDigest;

        if (!digest) {
            throw new Error(`Missing digest for ${repository}:${reference}`);
        }

        imageDigestCache[cacheKey] = digest;
        return digest;
    })();

    try {
        return await imageDigestCache[cacheKey];
    } catch (error) {
        delete imageDigestCache[cacheKey];
        throw error;
    }
}

async function fetchManifest(repository, digest) {
    const response = await ecr.send(new BatchGetImageCommand({
        repositoryName: repository,
        imageIds: [{ imageDigest: digest }]
    }));

    return response.images?.[0]?.imageManifest;
}

async function collectServiceActiveTags(service) {
    const taskDefinition = await ecs.send(new DescribeTaskDefinitionCommand({
        taskDefinition: service.taskDefinition
    }));
    const serviceActiveTags = [];

    for (const containerDefinition of taskDefinition.taskDefinition?.containerDefinitions || []) {
        const image = parseImageReference(containerDefinition.image);

        if (!image || !repositories.has(image.repository)) {
            continue;
        }

        serviceActiveTags.push({
            imageDigest: await resolveDigest(image.repository, image.reference),
            imageTag: tagFor(
                service.serviceName || taskDefinition.taskDefinition?.family || 'service',
                containerDefinition.name || 'container'
            ),
            repository: image.repository
        });
    }

    return serviceActiveTags;
}

async function findDesiredActiveTags() {
    const desiredActiveTags = new Map();
    const serviceArns = await listServices();
    const services = await describeServices(serviceArns);
    const serviceActiveTags = await mapWithConcurrency(services, MAX_CONCURRENT_TASK_DEFINITIONS, collectServiceActiveTags);

    for (const repositoryActiveTags of serviceActiveTags) {
        for (const repositoryActiveTag of repositoryActiveTags) {
            const activeTags = desiredActiveTags.get(repositoryActiveTag.repository) || new Map();

            activeTags.set(repositoryActiveTag.imageTag, repositoryActiveTag.imageDigest);
            desiredActiveTags.set(repositoryActiveTag.repository, activeTags);
        }
    }

    return {
        desiredActiveTags,
        serviceCount: serviceArns.length
    };
}

async function listCurrentActiveTags(repository) {
    const activeTags = new Map();
    let nextToken;

    do {
        const response = await ecr.send(new DescribeImagesCommand({
            repositoryName: repository,
            maxResults: 1000,
            nextToken
        }));

        for (const imageDetail of response.imageDetails || []) {
            for (const imageTag of imageDetail.imageTags || []) {
                if (imageTag === 'active' || imageTag.startsWith('active-')) {
                    activeTags.set(imageTag, imageDetail.imageDigest);
                }
            }
        }

        nextToken = response.nextToken;
    } while (nextToken);

    return activeTags;
}

async function updateActiveTags(repository, desiredActiveTags) {
    const currentActiveTags = await listCurrentActiveTags(repository);
    let updated = 0;
    let removed = 0;

    for (const [imageTag, imageDigest] of desiredActiveTags) {
        if (currentActiveTags.get(imageTag) === imageDigest) {
            continue;
        }

        const imageManifest = await fetchManifest(repository, imageDigest);

        if (!imageManifest) {
            throw new Error(`Missing manifest for ${repository}@${imageDigest}`);
        }

        await ecr.send(new PutImageCommand({
            repositoryName: repository,
            imageManifest,
            imageTag
        }));

        updated += 1;
    }

    const staleTags = [];

    for (const [imageTag] of currentActiveTags) {
        if (!desiredActiveTags.has(imageTag)) {
            staleTags.push({ imageTag });
        }
    }

    for (let index = 0; index < staleTags.length; index += 100) {
        const batch = staleTags.slice(index, index + 100);

        await ecr.send(new BatchDeleteImageCommand({
            repositoryName: repository,
            imageIds: batch
        }));

        removed += batch.length;
    }

    return { updated, removed };
}

exports.handler = async () => {
    const { desiredActiveTags, serviceCount } = await findDesiredActiveTags();
    let updated = 0;
    let removed = 0;

    for (const repository of repositories) {
        const result = await updateActiveTags(repository, desiredActiveTags.get(repository) || new Map());
        updated += result.updated;
        removed += result.removed;
    }

    return {
        repositories: repositories.size,
        removed,
        services: serviceCount,
        updated
    };
};
