import * as dotenv from 'dotenv';
import { initDataLambda } from './src/dataLambda';
import { initApiGateway } from './src/apiGateway';
import { initDataBucket } from './src/dataBucket';
import { initCloudfront } from './src/cloudfront';
import { initImagesBucketAndLambda } from './src/imagesBucketAndLambda';
import { getValue } from './src/utils';

dotenv.config();

const run = async () => {
  const dataBucket = await initDataBucket({
    name: 'personalData',
  });

  const dataLambda = await initDataLambda({ bucket: dataBucket });

  const apiResponse = await initApiGateway({
    subdomain: 'api-personal',
    domainName: process.env.BASE_DOMAIN_NAME!,
    routing: [
      {
        httpMethod: 'GET',
        lambda: dataLambda,
      },
    ],
    stageName: 'prod',
  });

  const imagesBucket = await initImagesBucketAndLambda({
    name: 'personalImages',
  });

  const distributionResponse = await initCloudfront({
    subdomain: 'personal-v2',
    domainName: process.env.BASE_DOMAIN_NAME!,
    testingImageUrl: `https://${await getValue(
      imagesBucket.bucketDomainName
    )}/testing_processed.jpg`,
  });

  return {
    ...apiResponse,
    ...distributionResponse,
    imagesBucketUrl: imagesBucket.bucketDomainName,
  };
};

export const output = run();
