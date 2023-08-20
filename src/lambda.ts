import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';

export const initLambdaIamRole = (params: { name: string }) => {
  const lambdaHandlerRole = new aws.iam.Role(
    `lambdaHandlerRole-${params.name}`,
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

  new aws.iam.RolePolicyAttachment(`lambdaFuncRoleAttach-${params.name}`, {
    role: lambdaHandlerRole,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaExecute,
  });

  return lambdaHandlerRole;
};

interface Params {
  handler: string;
  functionName: string;
  sourceFolderPath: string;
  sourceFileName: string;
  runtime: 'python3.10' | 'nodejs16.x';
  env: any;
  role: Role;
}

export const initLambda = (params: Params) => {
  const archive: pulumi.asset.AssetMap = {};

  const lambda = new aws.lambda.Function(`lambda-${params.handler}`, {
    name: params.functionName,
    role: params.role.arn,
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

  return lambda;
};
