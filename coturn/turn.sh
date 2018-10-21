#!/bin/bash
cd ~

rm -f ./external_ip

curl http://canhazip.com > ./external_ip

# set external ip using aws metadata
#if [ -z "$EXTERNAL_IP" ]; then
#    curl  http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null > ./external_ip
#else
#    echo $EXTERNAL_IP > ./external_ip
#fi

export EXTERNAL_IP=`cat ./external_ip`

echo external ip $EXTERNAL_IP

/usr/local/bin/turnserver --no-tcp --no-tls --no-dtls --no-tcp-relay --lt-cred-mech --user TEST:TEST -r turn -n
