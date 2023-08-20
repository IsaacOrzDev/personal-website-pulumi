import boto3
import os
import json

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    bucket_name = os.environ['DATA_BUCKET_NAME']
    object_key = os.environ['BUCKET_OBJECT_KEY']

    headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': True,
    }
    
    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)

        object_data = json.loads(response['Body'].read().decode('utf-8'))
        
        return {
            'statusCode': 200,
            'body': json.dumps(object_data),
            'headers': headers
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': f'Error: {str(e)}',
            'headers': headers
        }