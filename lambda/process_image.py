import os
import io
import boto3
from PIL import Image
import urllib.parse

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    # Extract the bucket and key information from the S3 event
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')

    print(bucket_name, object_key)
    
    # Check if the uploaded object is an image
    if object_key.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')) and not  object_key.endswith('_processed.jpg'):
        try:
            # Retrieve the object from S3
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            
            # Read the object content
            object_data = response['Body'].read()
            
            # Create a new file name with a prefix
            new_object_key = f"{os.path.splitext(object_key)[0]}_processed.jpg"
            
            # Convert the image to JPEG format
            image = Image.open(io.BytesIO(object_data))
            new_image_data = io.BytesIO()
            image.save(new_image_data, format='JPEG')
            new_image_data.seek(0)
            
            # Upload the new image to S3 with the new file name
            s3_client.upload_fileobj(new_image_data, bucket_name, new_object_key, ExtraArgs={'ContentType': 'image/jpeg'})
            print("success")
        
        except Exception as e:
            print(f'Error processing image: {str(e)}')
    else:
        print('File is not an image, no action taken')