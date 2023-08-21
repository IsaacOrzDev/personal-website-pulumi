import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as mime from 'mime';
import { crawlDirectory, getValue } from './utils';
import { initLambda, initLambdaIamRole } from './lambda';
import { lambdaLayers } from './lambdaLayers';

export const initImagesBucketAndLambda = async (params: { name: string }) => {
  const imagesFolderPath = './content/images';

  const imagesBucket = new aws.s3.Bucket(params.name, {
    forceDestroy: true,
  });

  const bucketAccessBlock = new aws.s3.BucketPublicAccessBlock(
    `${params.name}AccessBlock`,
    {
      bucket: imagesBucket.id,
      blockPublicPolicy: false,
    }
  );

  const bucketPolicy = new aws.s3.BucketPolicy(`${params.name}BucketPolicy`, {
    bucket: imagesBucket.id,
    policy: pulumi.jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [pulumi.interpolate`${imagesBucket.arn}/*`],
        },
      ],
    }),
  });

  const lambdaRole = initLambdaIamRole({ name: 'processImageLambda' });

  const bucketAccessPolicy = new aws.iam.Policy(
    'processImageLambdaS3ReadPolicy',
    {
      policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
              {
                  "Effect": "Allow",
                  "Action": "s3:GetObject",
                  "Resource": "arn:aws:s3:::${await getValue(
                    imagesBucket.id
                  )}/*"
              }
          ]
      }`,
    }
  );

  new aws.iam.RolePolicyAttachment(
    'processImageLambdaFuncRoleAttachForBucket',
    {
      role: lambdaRole,
      policyArn: bucketAccessPolicy.id,
    }
  );

  const lambda = initLambda({
    role: lambdaRole,
    sourceFolderPath: './lambda/',
    functionName: 'personalProcessImagePy',
    sourceFileName: 'process_image.py',
    handler: 'process_image.lambda_handler',
    runtime: 'python3.10',
    env: {},
    layers: [lambdaLayers.Pillow],
  });

  imagesBucket.onObjectCreated('newImageAdded', lambda, {
    event: '*',
  });

  new aws.s3.BucketObject(
    `${params.name}-testing.png`,
    {
      key: 'testing.png',

      bucket: imagesBucket,
      contentType: mime.getType('./content/testing.png') || undefined,
      source: new pulumi.asset.FileAsset('./content/testing.png'),
    },
    {
      parent: imagesBucket,
    }
  );

  // crawlDirectory('./content/images', (filePath: string) => {
  //   const relativeFilePath = filePath.replace(imagesFolderPath + '/', '');
  //   const contentFile = new aws.s3.BucketObject(
  //     `${params.name}-${relativeFilePath}`,
  //     {
  //       key: relativeFilePath,
  //       bucket: imagesBucket,
  //       contentType: mime.getType(filePath) || undefined,
  //       source: new pulumi.asset.FileAsset(filePath),
  //     },
  //     {
  //       parent: imagesBucket,
  //     }
  //   );
  // });

  return imagesBucket;
};
