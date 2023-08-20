import * as dotenv from 'dotenv';
import { initDataLambda } from './src/dataLambda';
import { initApiGateway } from './src/apiGateway';

dotenv.config();

const dataLambda = initDataLambda();

export const apiUrl = initApiGateway({
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
