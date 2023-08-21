import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { initCertificate } from './certificate';

interface Params {
  subdomain: string;
  domainName: string;
}

export const initCloudfront = async (params: Params) => {
  const tenMinutes = 60 * 10;
  const targetDomain = `${params.subdomain}.${params.domainName}`;
  const region = 'us-east-1';

  const contentBucket = new aws.s3.Bucket('distributionContentBucket', {
    bucket: targetDomain,
    forceDestroy: true,
    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    website: {
      indexDocument: 'index.html',
    },
  });

  const contentFile = new aws.s3.BucketObject(
    'distributionIndexFile',
    {
      key: 'index.html',
      bucket: contentBucket,
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
      parent: contentBucket,
    }
  );

  const hostedZoneId = await aws.route53
    .getZone({ name: params.domainName }, { async: true })
    .then((zone) => zone.zoneId);

  const certificateValidation = initCertificate({
    targetDomain,
    region,
    hostedZoneId,
  });

  const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
    'distributionOriginAccessIdentity',
    {
      comment: 'this is needed to setup s3 polices and make s3 not public.',
    }
  );

  const bucketPolicy = new aws.s3.BucketPolicy('distributionBucketPolicy', {
    bucket: contentBucket.id, // refer to the bucket created earlier
    policy: pulumi.jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            AWS: originAccessIdentity.iamArn,
          }, // Only allow Cloudfront read access.
          Action: ['s3:GetObject'],
          Resource: [pulumi.interpolate`${contentBucket.arn}/*`], // Give Cloudfront access to the entire bucket.
        },
      ],
    }),
  });

  const distributionArgs: aws.cloudfront.DistributionArgs = {
    enabled: true,
    aliases: [targetDomain],
    origins: [
      {
        originId: contentBucket.arn,
        domainName: contentBucket.bucketRegionalDomainName,
        s3OriginConfig: {
          originAccessIdentity:
            originAccessIdentity.cloudfrontAccessIdentityPath,
        },
      },
    ],
    defaultRootObject: 'index.html',
    defaultCacheBehavior: {
      targetOriginId: contentBucket.arn,

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
    'Distribution',
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
    distributionBucket: contentBucket.id,
  };
};
