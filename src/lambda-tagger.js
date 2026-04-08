const { ECSClient, ListServicesCommand, DescribeServicesCommand, DescribeTaskDefinitionCommand } = require('@aws-sdk/client-ecs');
const { ECRClient, DescribeImagesCommand, BatchGetImageCommand, PutImageCommand, BatchDeleteImageCommand } = require('@aws-sdk/client-ecr');

const ecs = new ECSClient({});
const ecr = new ECRClient({});

const cluster = process.env.CLUSTER_NAME;
const repositories = new Set(process.env.REPOSITORIES.split(','));
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
}

async function fetchManifest(repository, digest) {
    const response = await ecr.send(new BatchGetImageCommand({
        repositoryName: repository,
        imageIds: [{ imageDigest: digest }]
    }));

    return response.images?.[0]?.imageManifest;
}

async function findDesiredActiveTags() {
    const desiredActiveTags = new Map();
    const serviceArns = await listServices();
    const services = await describeServices(serviceArns);

    for (const service of services) {
        const taskDefinition = await ecs.send(new DescribeTaskDefinitionCommand({
            taskDefinition: service.taskDefinition
        }));

        for (const containerDefinition of taskDefinition.taskDefinition?.containerDefinitions || []) {
            const image = parseImageReference(containerDefinition.image);

            if (!image || !repositories.has(image.repository)) {
                continue;
            }

            const activeTags = desiredActiveTags.get(image.repository) || new Map();
            const activeTag = tagFor(
                service.serviceName || taskDefinition.taskDefinition?.family || 'service',
                containerDefinition.name || 'container'
            );

            activeTags.set(activeTag, await resolveDigest(image.repository, image.reference));
            desiredActiveTags.set(image.repository, activeTags);
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
