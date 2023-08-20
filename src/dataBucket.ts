import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as mime from 'mime';

export const initDataBucket = async (params: { name: string }) => {
  const dataBucket = new aws.s3.Bucket(params.name, {
    forceDestroy: true,
  });

  new aws.s3.BucketObject(
    `${params.name}-data.json`,
    {
      key: 'data.json',

      bucket: dataBucket,
      contentType: mime.getType('./content/data.json') || undefined,
      source: new pulumi.asset.FileAsset('./content/data.json'),
    },
    {
      parent: dataBucket,
    }
  );

  return dataBucket;
};
