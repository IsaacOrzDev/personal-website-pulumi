import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as mime from 'mime';
import * as fs from 'fs';

export const initDataBucket = async (params: { name: string }) => {
  const dataBucket = new aws.s3.Bucket(params.name, {
    forceDestroy: true,
  });

  let filePath = './content/data.json';

  try {
    fs.readFileSync('./data.json');
    filePath = './data.json';
  } catch {
    console.log('The file is not exist');
  }

  new aws.s3.BucketObject(
    `${params.name}-data.json`,
    {
      key: 'data.json',

      bucket: dataBucket,
      contentType: mime.getType(filePath) || undefined,
      source: new pulumi.asset.FileAsset(filePath),
    },
    {
      parent: dataBucket,
    }
  );

  return dataBucket;
};
