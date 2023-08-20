import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { Function } from '@pulumi/aws/lambda';

interface Params {
  subdomain: string;
  domainName: string;
  stageName: string;
  routing: Array<{
    path?: string;
    httpMethod: string;
    lambda: Function;
    // invokeArn: pulumi.Output<string>;
  }>;
}

export const initApiGateway = async (params: Params) => {
  const targetDomain = `${params.subdomain}.${params.domainName}`;

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

  //#region certificate

  const westRegion = new aws.Provider('api-west', {
    profile: aws.config.profile,
    region: 'us-west-1',
  });

  const certificate = new aws.acm.Certificate(
    'api-certificate',
    {
      domainName: targetDomain,
      validationMethod: 'DNS',
      subjectAlternativeNames: [],
    },
    {
      provider: westRegion,
    }
  );

  const hostedZoneId = aws.route53
    .getZone({ name: params.domainName }, { async: true })
    .then((zone) => zone.zoneId);

  const certificateValidationDomain = new aws.route53.Record(
    `${targetDomain}Validation`,
    {
      name: certificate.domainValidationOptions[0].resourceRecordName,
      zoneId: hostedZoneId,
      type: certificate.domainValidationOptions[0].resourceRecordType,
      records: [certificate.domainValidationOptions[0].resourceRecordValue],
      ttl: 60 * 10,
    }
  );

  const certificateValidation = new aws.acm.CertificateValidation(
    `${targetDomain}CertificateValidation`,
    {
      certificateArn: certificate.arn,
      validationRecordFqdns: [certificateValidationDomain.fqdn],
    },
    { provider: westRegion }
  );

  //#endregion

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

  return deployment.invokeUrl;
};
