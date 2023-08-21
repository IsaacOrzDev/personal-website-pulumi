import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { Function } from '@pulumi/aws/lambda';
import { initCertificate } from './certificate';

interface Params {
  subdomain: string;
  domainName: string;
  stageName: string;
  routing: Array<{
    path?: string;
    httpMethod: string;
    lambda: Function;
  }>;
}

export const initApiGateway = async (params: Params) => {
  const targetDomain = `${params.subdomain}.${params.domainName}`;
  const region = 'us-west-1';

  let restApi = new aws.apigateway.RestApi('personalApi', {
    name: 'personalApi',
    description: 'This is my API for the personal webstie',
  });

  const resources = await Promise.all(
    params.routing
      .filter((item) => !!item.path)
      .map(async (item) => ({
        key: item.path!,
        value: new aws.apigateway.Resource(`apiResource-${item.path}`, {
          parentId: restApi.rootResourceId,
          pathPart: item.path!,
          restApi,
        }),
      }))
  );

  const methods = await Promise.all(
    params.routing.map(async (item) => {
      const key = item.path
        ? `${item.path}-${item.httpMethod}`
        : item.httpMethod;
      return {
        key,
        value: new aws.apigateway.Method(`apiMethod-${key}`, {
          httpMethod: item.httpMethod,
          authorization: 'NONE',
          apiKeyRequired: false,
          resourceId: item.path
            ? resources.find((resource) => resource.key === item.path!)!.value
                .id
            : restApi.rootResourceId,
          restApi,
        }),
      };
    })
  );

  const integrations = await Promise.all(
    params.routing.map(
      async (item) =>
        new aws.apigateway.Integration(
          `apiGatewayIntegration-${item.lambda.invokeArn}`,
          {
            httpMethod: item.httpMethod,
            resourceId: item.path
              ? resources.find((resource) => resource.key === item.path!)!.value
                  .id
              : restApi.rootResourceId,
            restApi,
            integrationHttpMethod: 'POST',
            type: 'AWS_PROXY',
            uri: item.lambda.invokeArn,
          }
        )
    )
  );

  const permissions = await Promise.all(
    params.routing.map(
      async (item) =>
        new aws.lambda.Permission(`apiGatewayInvoke-${item.lambda.invokeArn}`, {
          statementId: 'AllowAPIGatewayInvoke',
          action: 'lambda:InvokeFunction',
          function: item.lambda,
          principal: 'apigateway.amazonaws.com',
          sourceArn: pulumi.interpolate`${restApi.executionArn}/*/*`,
        })
    )
  );

  const deployment = new aws.apigateway.Deployment('deployment', {
    restApi,
    stageName: params.stageName,
  });

  const hostedZoneId = await aws.route53
    .getZone({ name: params.domainName }, { async: true })
    .then((zone) => zone.zoneId);

  const certificateValidation = initCertificate({
    targetDomain,
    region,
    hostedZoneId,
  });

  const apiGatewayDomainName = new aws.apigatewayv2.DomainName(
    `${targetDomain}DomainName`,
    {
      domainName: targetDomain,
      domainNameConfiguration: {
        certificateArn: certificateValidation.certificateArn,
        endpointType: 'REGIONAL',
        securityPolicy: 'TLS_1_2',
      },
    }
  );

  new aws.route53.Record(targetDomain, {
    name: params.subdomain,
    zoneId: hostedZoneId,
    type: 'A',
    aliases: [
      {
        name: apiGatewayDomainName.domainNameConfiguration.targetDomainName,
        zoneId: apiGatewayDomainName.domainNameConfiguration.hostedZoneId,
        evaluateTargetHealth: true,
      },
    ],
  });

  new aws.apigateway.BasePathMapping('apiMapping', {
    restApi,
    stageName: params.stageName,
    domainName: apiGatewayDomainName.id,
  });

  return {
    apiInvokeUrl: deployment.invokeUrl,
    apiUrl: `https://${targetDomain}`,
  };
};
