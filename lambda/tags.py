import boto3
import os
import json

def lambda_handler(event, context):
  headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': True,
  }

  try:

    tableName = os.environ['TABLE_NAME']
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(tableName)
    response = table.scan()
    items = response['Items']
      
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response['Items'])

    result = {}
    for item in items:
       result[item['name']] = item['url']

    return {
      'statusCode': 200,
      'body': json.dumps(result),
      'headers': headers
    }
  except Exception as e:
    return {
        'statusCode': 500,
        'body': f'Error: {str(e)}',
        'headers': headers
    }    