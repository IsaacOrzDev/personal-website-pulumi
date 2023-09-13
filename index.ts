import * as dotenv from 'dotenv';
import { initDataLambda } from './src/dataLambda';
import { initApiGateway } from './src/apiGateway';
import { initDataBucket } from './src/dataBucket';
import { initCloudfront } from './src/cloudfront';
import { initImagesBucketAndLambda } from './src/imagesBucketAndLambda';
import { initTabTable } from './src/tagTable';
import tags from './content/tags.json';
import { initTagLambda } from './src/tabLambda';
import * as aws from '@pulumi/aws';
import { initCicdUser } from './src/cicdUser';

dotenv.config();

const run = async () => {
  const dataBucket = await initDataBucket({
    name: 'personalData',
  });

  const dataLambda = await initDataLambda({ bucket: dataBucket });

  const tagDynamoDBTable = await initTabTable(tags);

  const tagLambda = await initTagLambda({ table: tagDynamoDBTable });

  const apiResponse = await initApiGateway({
    subdomain: 'api-personal',
    domainName: process.env.BASE_DOMAIN_NAME!,
    routing: [
      {
        httpMethod: 'GET',
        lambda: dataLambda,
      },
      {
        httpMethod: 'GET',
        path: 'tags',
        lambda: tagLambda,
      },
    ],
    stageName: 'prod',
  });

  const imagesBucket = await initImagesBucketAndLambda({
    name: `personal-images.${process.env.BASE_DOMAIN_NAME}`,
  });

  const imagesDistributionResponse = await initCloudfront({
    subdomain: 'personal-images',
    domainName: process.env.BASE_DOMAIN_NAME!,
    bucket: imagesBucket,
  });

  const frontendBucket = new aws.s3.Bucket('frontendBucket', {
    bucket: `personal-dev.${process.env.BASE_DOMAIN_NAME}`,
    forceDestroy: true,
    website: {
      indexDocument: 'index.html',
    },
  });

  const frontendDistributionResponse = await initCloudfront({
    subdomain: 'personal-dev',
    domainName: process.env.BASE_DOMAIN_NAME!,
    bucket: frontendBucket,
    isWebsite: true,
  });

  const frontendProductionBucket = new aws.s3.Bucket(
    'frontendProductionBucket',
    {
      bucket: `personal.${process.env.BASE_DOMAIN_NAME}`,
      forceDestroy: true,
      website: {
        indexDocument: 'index.html',
      },
    }
  );

  const frontendProductionDistributionResponse = await initCloudfront({
    subdomain: 'personal',
    domainName: process.env.BASE_DOMAIN_NAME!,
    bucket: frontendProductionBucket,
    isWebsite: true,
  });

  const cicdUser = initCicdUser({
    domainName: process.env.BASE_DOMAIN_NAME!,
  });

  return {
    ...apiResponse,
    images: imagesDistributionResponse,
    frontend: frontendDistributionResponse,
    frontendProduction: frontendProductionDistributionResponse,
    cicdUser: {
      name: cicdUser.name,
      arn: cicdUser.arn,
    },
  };
};

export const output = run();
