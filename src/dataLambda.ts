import { initLambda, initLambdaIamRole } from './lambda';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { Bucket } from '@pulumi/aws/s3';

export const initDataLambda = (params: { bucket: Bucket }) => {
  const lambdaRole = initLambdaIamRole({ name: 'data.handler' });

  const bucketAccessPolicy = new aws.iam.Policy('lambdaS3ReadPolicy', {
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
              {
                  "Effect": "Allow",
                  "Action": "s3:GetObject",
                  "Resource": "arn:aws:s3:::${params.bucket.id}/*"
              }
          ]
      }`,
  });

  new aws.iam.RolePolicyAttachment('lambdaFuncRoleAttachForBucket', {
    role: lambdaRole,
    policyArn: bucketAccessPolicy.id,
  });

  const lambda = initLambda({
    role: lambdaRole,
    sourceFolderPath: './lambda/',
    functionName: 'personalData',
    sourceFileName: 'data.js',
    handler: 'data.handler',
    runtime: 'nodejs16.x',
    env: {
      DATA_BUCKET_NAME: params.bucket.id,
      BUCKET_OBJECT_KEY: 'data.json',
    },
  });

  return lambda;
};
