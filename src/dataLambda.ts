import { initLambda } from './lambda';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

export const initDataLambda = () => {
  const { lambda, lambdaHandlerRole } = initLambda({
    sourceFolderPath: './lambda/',
    functionName: 'personalData',
    sourceFileName: 'data.js',
    handler: 'data.handler',
    runtime: 'nodejs16.x',
    env: {
      DATA_BUCKET_NAME: process.env.DATA_BUCKET_NAME!,
      BUCKET_OBJECT_KEY: 'data.json',
    },
  });

  const dataBucket = aws.s3.Bucket.get('data', process.env.DATA_BUCKET_NAME!);

  const bucketAccessPolicy = new aws.iam.Policy('lambdaS3ReadPolicy', {
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
              {
                  "Effect": "Allow",
                  "Action": "s3:GetObject",
                  "Resource": "arn:aws:s3:::${dataBucket.id}/*"
              }
          ]
      }`,
  });

  new aws.iam.RolePolicyAttachment('lambdaFuncRoleAttachForBucket', {
    role: lambdaHandlerRole,
    policyArn: bucketAccessPolicy.id,
  });

  return lambda;
};
