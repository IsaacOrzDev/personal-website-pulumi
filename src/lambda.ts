import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

interface Params {
  handler: string;
  functionName: string;
  sourceFolderPath: string;
  sourceFileName: string;
  runtime: string;
  env: any;
}

export const initLambda = (params: Params) => {
  const lambdaHandlerRole = new aws.iam.Role(
    `lambdaHandlerRole-${params.handler}`,
    {
      assumeRolePolicy: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Effect: 'Allow',
            Sid: '',
          },
        ],
      },
    }
  );

  new aws.iam.RolePolicyAttachment(`lambdaFuncRoleAttach-${params.handler}`, {
    role: lambdaHandlerRole,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaExecute,
  });

  const archive: pulumi.asset.AssetMap = {};

  const lambda = new aws.lambda.Function(`lambda-${params.handler}`, {
    name: params.functionName,
    role: lambdaHandlerRole.arn,
    code: new pulumi.asset.AssetArchive({
      [params.sourceFileName]: new pulumi.asset.FileAsset(
        `${params.sourceFolderPath}${params.sourceFileName}`
      ),
    }),
    runtime: params.runtime,
    handler: params.handler,
    environment: {
      variables: params.env,
    },
  });

  return { lambda, lambdaHandlerRole };
};
