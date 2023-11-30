const AWS = require("aws-sdk");
const { Storage } = require("@google-cloud/storage");
const fetch = require("node-fetch");
const mailgun = require("mailgun-js");
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const DOMAIN = process.env.DOMAIN;
const KEY = process.env.MAILGUN_API_KEY;
const mg = mailgun({
  apiKey: KEY,
  domain: DOMAIN,
});
exports.handler = async function handler(event) {
  try {
    
   const decodedPrivateKey = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
    const keyFileJson = JSON.parse(decodedPrivateKey);
      const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: keyFileJson, // Pass the parsed JSON content as credentials

    });
    const eventData = JSON.parse(event.Records[0].Sns.Message);
    const releaseUrl = eventData.submission_url;
    var recipientEmail = eventData.email;
    const assignmentId = eventData.assignment_id;
    const userId = eventData.user_id;
    console.log("URL:", releaseUrl);
    console.log("EMAIL:", recipientEmail);
    const response = await fetch(releaseUrl);
    if (!response.ok)
      throw new Error(`Failed to download release: ${response.statusText}`);
    const releaseData = await response.buffer();
    const bucketName = process.env.GOOGLE_STORAGE_BUCKET_NAME;
    const fileName = `${recipientEmail}/${assignmentId}/file${Date.now().toString()}.zip`;
    await storage.bucket(bucketName).file(fileName).save(releaseData);
    let signedUrl = await generateSignedUrl(storage, bucketName, fileName);
    await sendEmail(
      recipientEmail,
      fileName,
      "Download successful",
      `The release was successfully downloaded and uploaded to ${bucketName}`,
      "success"
    );
    await recordEmailEvent(recipientEmail, "SUCCESS EMAIL SENT");
  } catch (error) {
    console.error("Error:", error);
    await sendEmail(
      recipientEmail,
      null,
      "Download failed",
      `Error occurred: ${error.message}`,
      "error"
    );
    await recordEmailEvent(recipientEmail, "FAILURE EMAIL SENT");
  }
};

async function generateSignedUrl(storage, bucketName, fileName) {
  const options = {
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  };

  try {
    const [url] = await storage
      .bucket(bucketName)
      .file(fileName)
      .getSignedUrl(options);
    return url;
  } catch (err) {
    console.error("Error generating signed URL:", err);
    throw err;
  }
}

async function sendEmail(to, url, subject, message, status) {
  const data = {
    from: "noreply@demo.ritvikparamkusham.me",
    to: to,
    subject: subject,
    html:
      status == "success"
        ? `
    <html>
      <head>
      </head>
      <body>
        <p>Hello,</p>
        <p>Please find the path to GCP Bucket:</p>
        <p><b>${url}</b></p>
        <p>ola</p>
        <p></p>
      </body>
    </html>
  `
        : message,
  };
  await mg.messages().send(data);
}

async function recordEmailEvent(email, status) {
  const params = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Item: {
      id: Date.now().toString(),
      status: status,
      timestamp: new Date().toISOString(),
      email: email,
    },
  };
  await dynamoDB.put(params).promise();
}
// const AWS = require('aws-sdk');
// const { Storage } = require('@google-cloud/storage');
// const fs = require('fs');
// const mailgun = require('mailgun-js')({
//   apiKey: process.env.MAILGUN_API_KEY,
//   domain: process.env.DOMAIN,
// });

// // const docClient = new AWS.DynamoDB.DocumentClient();
// const dynamoDB = new AWS.DynamoDB();

// exports.handler = async (event, context) => {
//   try {
//     // let secretsManager = new AWS.SecretsManager();
//     const fetch = await require('node-fetch'); // Dynamic import for node-fetch

//     console.log(event);
//     const snsMessage = JSON.parse(event.Records[0].Sns.Message);
//     console.log(snsMessage);
//     const fileUrl = snsMessage.submission_url;
//     const recipient = snsMessage.email;
//     console.log(fileUrl);

//     // try {
//     //   const gcpSecretValue = await secretsManager.getSecretValue({ SecretId: process.env.GCP_SECRET_KEY }).promise();
//     //   console.log('GCP secret value:', gcpSecretValue.SecretString);

//     // } catch (error) {
//     //   console.error(error)
//     // }

//     // get the private key stored in env variables when google service account is created 
//     const decodedPrivateKey = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');

//     const keyFileJson = JSON.parse(decodedPrivateKey);

//     const storage = new Storage({
//       projectId: process.env.GCP_PROJECT_ID,
//       credentials: keyFileJson, // Pass the parsed JSON content as credentials

//     });

//     const user = snsMessage.user_id
//     const assign = snsMessage.assignment_id
//     const timestamp = new Date().toISOString();
//     const fileName = `${recipient}/${assign}/submision_${timestamp}.zip`; // Replace with the desired file name in GCS
//     // Download the file using node-fetch
//     const response = await fetch(fileUrl);
//     const fileBuffer = await response.buffer(); // Get the file content as a buffer

//     // const options = {
//     //   version: 'v4', // Specify the signed URL version
//     //   action: 'read', // Specify the action (read, write, delete, etc.)
//     //   expires: Date.now() + 15 * 60 * 1000, // URL expiration time (15 minutes from now)
//     // };

//     // let bucketURL;
//     // storage.bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME).file(fileName).getSignedUrl(options, (err, url) => {
//     //   if (err) {
//     //     console.error('Error generating signed URL:', err);
//     //   }
//     //   console.log('Signed URL:', url);
//     //   bucketURL = url;
//     //   // return url;
//     // })

//     const emailData = {
//       from: "noreply@demo.ritvikparamkusham.me",
//       to: "paramkusham.s@northeastern.edu",
//       subject: 'File Upload Notification',
//       text: `sns mail ${recipient} and bucket file url ${fileName}`
//     };

//     // Check if the file was saved successfully
//     if (response.ok) {
//       const bucket = storage.bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME);
//       const file = bucket.file(fileName);
//       await file.save(fileBuffer);


//       // console.log('File upload success or response is as expected:');
//       // await recordEmailEvent("Successful", recipient);

//       emailData.text = `File Download Successfully, stored in GCP bucket url ${fileName}`
//       await sendEmail(emailData, recipient);
//       console.log('File upload success or response is as expected:');
//       await recordEmailEvent("Successful", recipient);
//     } else {
//       // console.log('File upload failed or response is unexpected:');
//       // await recordEmailEvent('Successful', recipient);

//       emailData.text = response.data.toString()
//       await sendEmail(emailData, recipient);
//       console.log('File upload failed or response is unexpected:');
//       await recordEmailEvent(response.data, recipient);
//     }

//   } catch (error) {

//     const emailData = {
//       from: "noreply@demo.ritvikparamkusham.me",
//       to: "paramkusham.s@northeastern.edu",
//       subject: 'File Upload Notification',
//     };

//     // console.error('Error:', error);
//     // await recordEmailEvent('Success', recipient);

//     emailData.text = "File Download failed"
//     await sendEmail(emailData, recipient);
//     console.error('Error:', error);
//     recordEmailEvent('Success', recipient);

//     throw error;
//   }
// };

// async function sendEmail(data, recipient) {
//   return new Promise((resolve, reject) => {
//     mailgun.messages().send(data, (error, body) => {
//       if (error) {
//         console.log("Unsuccessful email sending")
//         reject(error);
//       } else {
//         console.log("Successful email sending")
//         resolve(body);
//       }
//     });
//   });
// }

// async function recordEmailEvent(status, recipient) {
//   const timestamp = new Date().toISOString();
//   const params = {
//     TableName: process.env.DYNAMODB_TABLE_NAME, // Get the table name from environment variables
//     Item: {
//       "id": { S: timestamp },
//       "status": { S: status },
//       "recipient": { S: recipient },
//     }
//   };
//   console.log(params);
//   dynamoDB.putItem(params, function (err, data) {
//     if (err) {
//       console.log("Error", err);
//     } else {
//       console.log("Success", data);
//     }
//   });
// }

