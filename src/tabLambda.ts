import { initLambda, initLambdaIamRole } from './lambda';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { Bucket } from '@pulumi/aws/s3';

export const initTagLambda = async (params: { table: aws.dynamodb.Table }) => {
  const lambdaRole = initLambdaIamRole({ name: 'tags.handler' });

  const policy = new aws.iam.RolePolicy('tagLambdaFuncRolePolicy', {
    role: lambdaRole,
    policy: pulumi.jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
          Resource: params.table.arn,
        },
      ],
    }),
  });

  const lambda = initLambda({
    role: lambdaRole,
    sourceFolderPath: './lambda/',
    functionName: 'personalTagsPy',
    sourceFileName: 'tags.py',
    handler: 'tags.lambda_handler',
    runtime: 'python3.10',
    env: {
      TABLE_NAME: params.table.id,
    },
    layers: [],
  });

  return lambda;
};
