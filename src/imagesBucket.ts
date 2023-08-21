import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as mime from 'mime';
import { crawlDirectory } from './utils';

export const initImagesBucket = (params: { name: string }) => {
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

  new aws.s3.BucketObject(
    `${params.name}-data.json`,
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

  crawlDirectory('./content/images', (filePath: string) => {
    const relativeFilePath = filePath.replace(imagesFolderPath + '/', '');
    const contentFile = new aws.s3.BucketObject(
      `${params.name}-${relativeFilePath}`,
      {
        key: relativeFilePath,
        bucket: imagesBucket,
        contentType: mime.getType(filePath) || undefined,
        source: new pulumi.asset.FileAsset(filePath),
      },
      {
        parent: imagesBucket,
      }
    );
  });

  return imagesBucket;
};
