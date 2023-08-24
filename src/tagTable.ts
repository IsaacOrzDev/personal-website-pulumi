import * as aws from '@pulumi/aws';

export const initTabTable = async (
  records: Array<{ name: string; url: string }>
) => {
  const tagDynamoDBTable = new aws.dynamodb.Table('tagTable', {
    attributes: [{ name: 'name', type: 'S' }],
    hashKey: 'name',
    billingMode: 'PAY_PER_REQUEST',
  });

  await Promise.all(
    records.map(async (item) => {
      new aws.dynamodb.TableItem(`tagTableItem-${item.name}`, {
        tableName: tagDynamoDBTable.id,
        hashKey: tagDynamoDBTable.hashKey,
        item: JSON.stringify({
          name: { S: item.name },
          url: { S: item.url },
        }),
      });
    })
  );

  return tagDynamoDBTable;
};
