import * as aws from '@pulumi/aws';

export const initCicdUser = (params: { domainName: string }) => {
  const user = new aws.iam.User('cicdUser', {});

  const s3DeletePolicy = new aws.iam.Policy('cicdS3Policy', {
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:DeleteObject',
            's3:DeleteObjectVersion',
            's3:PutObject',
            's3:GetObject',
          ],
          Resource: `arn:aws:s3:::*.${params.domainName}/*`,
        },
        {
          Effect: 'Allow',
          Action: ['s3:ListBucket'],
          Resource: `arn:aws:s3:::*.${params.domainName}`,
        },
      ],
    }),
  });

  const s3PolicyAttachment = new aws.iam.UserPolicyAttachment(
    's3DeleteAttachment',
    {
      user: user.name,
      policyArn: s3DeletePolicy.arn,
    }
  );

  const cloudFrontPolicy = new aws.iam.Policy('cicdCloudFrontPolicy', {
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'cloudfront:CreateInvalidation',
          Resource: '*',
        },
      ],
    }),
  });

  const cloudFrontPolicyAttachment = new aws.iam.UserPolicyAttachment(
    'CloudFrontAttachment',
    {
      user: user.name,
      policyArn: cloudFrontPolicy.arn,
    }
  );

  return user;
};
