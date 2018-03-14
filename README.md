# lambda-control-ec2-guacamole
Lambda function to instantiate and control an EC2 instance.

I wrote this to manage a guacamole instance, but you could use it for any EC2 instance.

Once you've got an EC2 instance with guacamole setup this lambda function (and client html) lets you turn it on and off again, updating a Route53 DNS entry to point at the new instance.

You can avoid all this by using an Elastic Load Balancer but that will cost money, this doesn't ;)

To use:
- setup an EC2 instance you want to start and stop
- edit the lambda function to use your urls and hosted zone
- create an API gateway to access your lambda function
- edit the client html to use the same urls as the lambda function
