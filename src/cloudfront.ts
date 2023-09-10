import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { initCertificate } from './certificate';
import { Bucket } from '@pulumi/aws/s3';

interface Params {
  subdomain: string;
  domainName: string;
  isWebsite?: boolean;
  bucket: Bucket;
}

export const initCloudfront = async (params: Params) => {
  const tenMinutes = 60 * 10;
  const targetDomain = `${params.subdomain}.${params.domainName}`;
  const region = 'us-east-1';

  if (params.isWebsite) {
    const contentFile = new aws.s3.BucketObject(
      `${targetDomain}-distributionIndexFile`,
      {
        key: 'index.html',
        bucket: params.bucket,
        contentType: '.html',
        content: `
      <!doctype html>
      <html>

      <head>
        <meta charset="utf-8">
        <title>Super-amazing static website!</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      </head>

      <body>
        <h1>Testing</h1>
      </body>
      `,
      },
      {
        parent: params.bucket,
      }
    );
  }

  const hostedZoneId = await aws.route53
    .getZone({ name: params.domainName }, { async: true })
    .then((zone) => zone.zoneId);

  const certificateValidation = initCertificate({
    targetDomain,
    region,
    hostedZoneId,
  });

  const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
    `${targetDomain}-distributionOriginAccessIdentity`,
    {
      comment: 'this is needed to setup s3 polices and make s3 not public.',
    }
  );

  const bucketPolicy = new aws.s3.BucketPolicy(
    `${targetDomain}-distributionBucketPolicy`,
    {
      bucket: params.bucket.id, // refer to the bucket created earlier
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              AWS: originAccessIdentity.iamArn,
            }, // Only allow Cloudfront read access.
            Action: ['s3:GetObject'],
            Resource: [pulumi.interpolate`${params.bucket.arn}/*`], // Give Cloudfront access to the entire bucket.
          },
        ],
      }),
    }
  );

  const distributionArgs: aws.cloudfront.DistributionArgs = {
    enabled: true,
    aliases: [targetDomain],
    origins: [
      {
        originId: params.bucket.arn,
        domainName: params.bucket.bucketRegionalDomainName,
        s3OriginConfig: {
          originAccessIdentity:
            originAccessIdentity.cloudfrontAccessIdentityPath,
        },
      },
    ],
    defaultRootObject: params.isWebsite ? 'index.html' : undefined,
    defaultCacheBehavior: {
      targetOriginId: params.bucket.arn,

      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
      forwardedValues: {
        cookies: { forward: 'none' },
        queryString: false,
      },

      minTtl: 0,
      defaultTtl: tenMinutes,
      maxTtl: tenMinutes,
    },
    restrictions: {
      geoRestriction: {
        restrictionType: 'none',
      },
    },
    viewerCertificate: {
      acmCertificateArn: certificateValidation.certificateArn, // Per AWS, ACM certificate must be in the us-east-1 region.
      sslSupportMethod: 'sni-only',
    },
  };

  const distribution = new aws.cloudfront.Distribution(
    `${targetDomain}-Distribution`,
    distributionArgs
  );

  new aws.route53.Record(targetDomain, {
    name: params.subdomain,
    zoneId: hostedZoneId,
    type: 'A',
    aliases: [
      {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: true,
      },
    ],
  });

  return {
    distributionUrl: `https://${targetDomain}`,
    distributionDomainName: distribution.domainName,
    distributionId: distribution.id,
    distributionBucket: params.bucket.id,
  };
};
