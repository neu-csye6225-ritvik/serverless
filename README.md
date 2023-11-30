# serverless
1. Lambda Function invoked by SNS topic in the webapp
2. Download the file from the submission url and put the content in the GCP bucket
3. Send the email to user who has created the submission with the path of the GCP bucket filename
4. Store the email status in the DynamoDb