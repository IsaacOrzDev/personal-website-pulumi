import * as aws from '@pulumi/aws';

interface Params {
  targetDomain: string;
  region: 'us-west-1' | 'us-east-1';
  hostedZoneId: string;
}

export const initCertificate = (params: Params) => {
  const provider = new aws.Provider(`${params.targetDomain}Provider`, {
    profile: aws.config.profile,
    region: params.region,
  });

  const certificate = new aws.acm.Certificate(
    `${params.targetDomain}Certificate`,
    {
      domainName: params.targetDomain,
      validationMethod: 'DNS',
      subjectAlternativeNames: [],
    },
    {
      provider,
    }
  );

  const certificateValidationDomain = new aws.route53.Record(
    `${params.targetDomain}Validation`,
    {
      name: certificate.domainValidationOptions[0].resourceRecordName,
      zoneId: params.hostedZoneId,
      type: certificate.domainValidationOptions[0].resourceRecordType,
      records: [certificate.domainValidationOptions[0].resourceRecordValue],
      ttl: 60 * 10,
    }
  );

  const certificateValidation = new aws.acm.CertificateValidation(
    `${params.targetDomain}CertificateValidation`,
    {
      certificateArn: certificate.arn,
      validationRecordFqdns: [certificateValidationDomain.fqdn],
    },
    { provider }
  );

  return certificateValidation;
};
