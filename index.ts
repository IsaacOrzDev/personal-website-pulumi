import * as dotenv from 'dotenv';
import { initDataLambda } from './src/dataLambda';
import { initApiGateway } from './src/apiGateway';
import { initDataBucket } from './src/dataBucket';

dotenv.config();

const run = async () => {
  const dataBucket = await initDataBucket({
    name: 'personalData',
  });

  const dataLambda = await initDataLambda({ bucket: dataBucket });

  const apiUrl = await initApiGateway({
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

  return { apiUrl };
};

export const output = run();
