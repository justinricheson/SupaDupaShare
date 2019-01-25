'use strict';

const AWS = require('aws-sdk');
const iot = new AWS.Iot();
const ec2 = new AWS.EC2();
const ecs = new AWS.ECS();
const sts = new AWS.STS();
const roleName = 'iot-notifications';

module.exports.getCredentials = (event, context, callback) => {

    iot.describeEndpoint({}, (err, iotData) => {
        if (err) {
            console.log(err);
            return callback(err);
        }
        
        sts.getCallerIdentity({}, (err, stsIdentityData) => {
            if (err) {
                console.log(err);
                return callback(err);
            }

            const params = {
                RoleArn: `arn:aws:iam::${stsIdentityData.Account}:role/${roleName}`,
                RoleSessionName: getRandomInt().toString()
            };

            sts.assumeRole(params, (err, stsRoleData) => {
                if (err) {
                    console.log(err);
                    return callback(err);
                }
                
                getTurnServers((err, ips) => {
                    if (err) {
                        console.log(err);
                        return callback(err);
                    }
                
                    const res = {
                        statusCode: 200,
                        headers: {
                            'Access-Control-Allow-Origin': '*'
                        },  
                        body: JSON.stringify({
                            iotEndpoint: iotData.endpointAddress,
                            region: getRegion(iotData.endpointAddress),
                            accessKey: stsRoleData.Credentials.AccessKeyId,
                            secretKey: stsRoleData.Credentials.SecretAccessKey,
                            sessionToken: stsRoleData.Credentials.SessionToken,
                            turnServers: ips
                       })
                    }

                    callback(null, res);
                });
            });
        });
    });
};

const getTurnServers = (callback) => {
    ecs.listTasks({}, (err, taskIdData) => {
        if (err) {
            callback(err);
            return;
        }
        
        if (taskIdData == null || taskIdData.taskArns == null || taskIdData.taskArns.length == 0) {
            console.log('No running turn tasks 1');
            callback(null, []);
            return
        }
        
        ecs.describeTasks({ tasks: taskIdData.taskArns }, (err, taskDetailData) => {
            if (err) {
                callback(err);
                return
            }
            
            if (taskDetailData == null || taskDetailData.tasks == null) {
                console.log('No running turn tasks 2');
                callback(null, []);
                return
            }
            
            var eniIds = [];
            taskDetailData.tasks.forEach(task => {
                task.attachments.forEach(attachment => {
                    attachment.details.forEach(detail => {
                        if (detail.name === "networkInterfaceId") {
                            eniIds.push(detail.value);
                        }
                    })
                })
            })
            
            ec2.describeNetworkInterfaces({ NetworkInterfaceIds: eniIds }, (err, eniData) => {
                if (err) {
                    callback(err);
                    return;
                }
                
                var ips = [];
                eniData.NetworkInterfaces.forEach(eni => {
                    if (eni.Association != null) {
                        ips.push(eni.Association.PublicIp);
                    }
                })
                
                callback(null, ips);
            });
        });
    });
}

const getRegion = (iotEndpoint) => {
  const partial = iotEndpoint.replace('.amazonaws.com', '');
  const iotIndex = iotEndpoint.indexOf('iot'); 
  return partial.substring(iotIndex + 4);
};

// Get random Int
const getRandomInt = () => {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};
