exports.handler = (event, context, callback) => {
    
    //get action
    var action = "";
    if (event.queryStringParameters !== null && event.queryStringParameters !== undefined) {
      action = event.queryStringParameters.action;
    } 


    // do action
    if (action === "start"){
        startVM(callback);
    } else if (action === "status"){
        getStatus(callback);
    } else if (action === "updateR53"){
        var newIP = event.queryStringParameters.ip;
        updateR53(callback,newIP);
        rebootVM(callback); //needed on my Ubuntu server sometimes, so do it every time. It doesn't slow things down.
    } else if (action === "stop"){
        stopVM(callback);
    } else {
        failResponse(callback, "Unknown action: " + action);
    }
};

var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
const ec2IDforGuacamoleServer = "YOUR_INSTANCE_ID";
const guacHealthcheckURL = "http://your_url.com/healthcheck.html"; //returns "true" if it exists
const guacURL = "http://your_url.com";


function startVM(callback){
    console.log("=== Start VM ===");
    var params = {
        InstanceIds: [ec2IDforGuacamoleServer],
        DryRun: false
    };
    
    ec2.startInstances(params, function(err, data) {
            if (err) {
              return failResponse(callback, err);
            }
            return buildLambdaResponse(callback, { healthcheck: false, data });
    });    
}

function stopVM(callback){
    
    console.log("=== Stop VM ===");
    var params = {
        InstanceIds: [ec2IDforGuacamoleServer],
        DryRun: false
    };
    
    ec2.stopInstances(params, function(err, data) {
            if (err) {
              return failResponse(callback, err);
            }
            return buildLambdaResponse(callback, { healthcheck: false, data });
    });    
}


function rebootVM(callback){
    
    console.log("=== Reboot VM ===");
    var params = {
        InstanceIds: [ec2IDforGuacamoleServer],
        DryRun: false
    };
    
    ec2.rebootInstances(params, function(err, data) {
            if (err) {
              return failResponse(callback, err);
            }
            return buildLambdaResponse(callback, { healthcheck: false, data });
    });    
}


function getStatus(callback){
    
    var params = {
        InstanceIds: [ec2IDforGuacamoleServer],
        DryRun: false
    };
    
    var ec2data;
    
    ec2.describeInstances(params, function(err, data) {
            if (err) {
              return failResponse(callback, err);
            }
            ec2data = data;
            console.log("Status: EC2 state: " + data.Reservations[0].Instances[0].State.Name);
            console.log("Status: Public IP is: " + ec2data.Reservations[0].Instances[0].PublicIpAddress);
            
            getWebRequest(guacHealthcheckURL, function(err, data){
                  if (err){
                     return buildLambdaResponse(callback, { healthcheck: false, ec2data });
                  } else {
                     var healthValue = (data.trim() == "true");
                     console.log('Status: Healthcheck: ' + healthValue);
                     return buildLambdaResponse(callback, { healthcheck: healthValue, ec2data });
                  }
                });            
            
    });    
    
}


function updateR53(callback, newIP){
    
    console.log("=== Update DNS ===");
    console.log("Update: " + guacURL +" = " + newIP);
    var params = {
      ChangeBatch: {
       Changes: [
          {
         Action: "UPSERT", 
         ResourceRecordSet: {
          Name: guacURL, 
          ResourceRecords: [
             {
            Value: newIP
           }
          ], 
          TTL: 60, 
          Type: "A"
         }
        }
       ], 
       Comment: "Update the A record set from start_cyberVM"
      }, 
      HostedZoneId: "<YOUR_HOSTED_ZONE_ID>"
     };    

        
    var route53 = new AWS.Route53();
    route53.changeResourceRecordSets(params, function(err, data) {
       if (err){
           failResponse(callback, err);
       } else {
           buildLambdaResponse(callback,data);
       }
    });

}

//////////////////////////////////////////////////////
// Calling a webservice


var http = require('http');
 
function getWebRequest(url,doWebRequestCallBack) {
    //console.log("getWebRequest("+url+")");
    var request = http.get(url, function (res) {
        var webResponseString = '';
        //console.log('Status Code: ' + res.statusCode);
 
        if (res.statusCode != 200) {
            doWebRequestCallBack(new Error("Non 200 Response"));
        }
 
        res.on('data', function (data) {
            webResponseString += data;
        });
 
        res.on('end', function () {
            //console.log('Got some data: '+ webResponseString);            
            doWebRequestCallBack(null, webResponseString);
        });
    }).on('error', function (e) {
        //console.log("Communications error: " + e.message);
        doWebRequestCallBack(new Error(e.message));
    });
    
    request.setTimeout( 1000, function( ) {
    // handle timeout here
      request.abort();
      doWebRequestCallBack(null, "false");
      
    });

}



//////////////////////////////////////////////////////
//lambda API gateway helpers

function buildLambdaResponse(callback, responseBody){
    var response = {
        "statusCode": 200,
        "headers": {
            "access-control-allow-origin": "*"
        },
        "body": JSON.stringify(responseBody),
        "isBase64Encoded": false
    };  
    callback(null,response);
}

function failResponse(callback, areason)
{
  buildLambdaResponse(callback, { healthcheck: false, reason: areason });
}