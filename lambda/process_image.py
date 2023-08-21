import os
import io
import boto3
from PIL import Image
import urllib.parse

s3_client = boto3.client('s3')

def resize(object_key, image):
    if object_key.startswith('home/'):
        image.thumbnail((800, 800), Image.Resampling.LANCZOS)
    elif '_web' in object_key:
        image.thumbnail((540, 470), Image.Resampling.LANCZOS)
    elif '_responsive' in object_key:
        image.thumbnail((187.5, 406), Image.Resampling.LANCZOS)
    elif '_mobile' in object_key:
        image.thumbnail((240, 520), Image.Resampling.LANCZOS)
    elif '_ipad' in object_key:
        image.thumbnail((520, 384), Image.Resampling.LANCZOS)



def lambda_handler(event, context):
    # Extract the bucket and key information from the S3 event
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')

    print(bucket_name, object_key)
    
    # Check if the uploaded object is an image
    if object_key.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')) and not '_thumbnail' in object_key:
        try:
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            object_data = response['Body'].read()
            
            new_object_key = f"{os.path.splitext(object_key)[0]}_thumbnail.png"
            image = Image.open(io.BytesIO(object_data))
            resize(object_key=object_key, image=image)
            new_image_data = io.BytesIO()
            image.save(new_image_data, format='PNG')
            new_image_data.seek(0)
            
            # Upload the new image to S3 with the new file name
            s3_client.upload_fileobj(new_image_data, bucket_name, new_object_key, ExtraArgs={'ContentType': 'image/jpeg'})
            print("success")
        
        except Exception as e:
            print(f'Error processing image: {str(e)}')